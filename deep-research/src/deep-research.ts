// import pLimit from 'p-limit';
import { HarmBlockThreshold, HarmCategory, Schema, SchemaType } from '@google/generative-ai';

// import { reportAgentPrompt } from './prompt';
import { OutputManager } from './output-manager';
import { generateObject } from './ai/providers';
import { InformationCruncher } from './information-cruncher';
import { encode } from 'gpt-tokenizer';  // Add this import
import * as fs from 'fs/promises';
import path from 'path';
import { TokenTracker } from './token-tracker';

// Initialize output manager for coordinated console/progress output
export const output = new OutputManager();

// Allow the server to set the broadcast function
export function setBroadcastFn(broadcastFn: (message: string) => void) {
  // Directly update the broadcastFn on the output instance
  output['broadcastFn'] = broadcastFn;
}

// Replace console.log with output.log
function log(...args: any[]) {
  output.log(...args);
}

// increase this if you have higher API rate limits
const ConcurrencyLimit = 1;


// Update generateQueriesWithObjectives to use SchemaType
async function generateQueriesWithObjectives(context: string, numQueries: number): Promise<QueryWithObjective[]> {
  const schema: Schema = {
    type: SchemaType.OBJECT,
    properties: {
      queries: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            query: {
              type: SchemaType.STRING,
              description: "Short Very specific keyword to do serp query, get the website list under each query, scrape the websites and get 100% precise answer to the user's question. This must be 4-5 word max and should only use plain english."
            },
            objective: {
              type: SchemaType.STRING,
              description: "The highly detailed precise objective of the query that we generated for websites analyzing agent to scrape on and analyze whether this objective is met or not analyzing website content."
            }
          },
          required: ["query", "objective"]
        },
      }
    },
    required: ["queries"]
  };

  try {
    const { response } = await generateObject({
      system: `You are the high quality SERP query generating agent. Your role is to analyze the user’s query and followup questions list. Then generate a bunch of short very detailed serp queries that in total entirely summarizes the entire question user is asking. Such that if you scrape the list of websites that you get under each of these queires, there is 100% chance that user's question will be 100% precisely answered in great highly technical detail. Today is ${new Date().toISOString()}. Follow these instructions when responding:
    - Your serp query must be short and 100% targeted and precise that can accurately summarizes a domain of the entire question that user is aksing.
    - Use your reasoning ability to understand the user's question and asking. Then only generate the queries.
    `,
      prompt: `Given this research context, generate ${numQueries} strategic search queries to find the list of websites we can scrape and get the percise and 100% answer to the question user is asking below.

CONTEXT:
${context}
`,
      model: process.env.QUESTION_GENERATING_MODEL as string,
      generationConfig: {
        responseSchema: schema
      }
    });

    const result = JSON.parse(response.text());

    if (!result?.queries || !Array.isArray(result.queries) || result.queries.length === 0) {
      log('Failed to generate valid queries');
      throw new Error('No valid queries generated');
    }

    log(`Generated ${result.queries.length} queries`);
    return result.queries;

  } catch (error) {
    log('Error generating queries:', error);
    throw error;
  }
}

async function searchSerpResults(query: string): Promise<SearxResult[]> {
  output.log(`Searching for: ${query}`);
  output.log(`Connected with Searxng at: ${process.env.SEARXNG_BASE_URL}`);

  try {
    // Add error checking for SEARXNG_BASE_URL
    if (!process.env.SEARXNG_BASE_URL) {
      throw new Error('SEARXNG_BASE_URL not configured');
    }

    // Improve query formatting
    const formattedQuery = encodeURIComponent(query.trim());

    const response = await fetch(
      `${process.env.SEARXNG_BASE_URL}/search?q=${formattedQuery}&format=json&language=en&time_range=year&safesearch=0&engines=google,bing,duckduckgo`,
      {
        method: "GET",
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Search failed with status ${response.status}: ${await response.text()}`);
    }

    const data: SearxResponse = await response.json();

    if (!data.results?.length) {
      throw new Error(`No search results found for query: ${query}`);
    }

    log(`Search found ${data.results.length} results for query: ${query}`);
    return data.results.slice(0, 7);

  } catch (error) {
    log('Error during search:', error);
    // Don't return empty array, throw error to trigger proper error handling
    throw new Error(`Search failed: ${error.message}`);
  }
}

async function scrapeWebsites(urls: string[]): Promise<ScrapedContent[]> {
  output.log(`Attempting to scrape ${urls.length} URLs`);
  if (!urls.length) {
    log('No URLs to scrape');
    return [];
  }

  log(`Attempting to scrape ${urls.length} URLs`);

  const results = await Promise.all(urls.map(async url => {
    try {
      // Fix: Use correct docker host internal URL
      const response = await fetch(`${process.env.FIRECRAWL_BASE_URL}/v1/scrape`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.FIRECRAWL_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
          onlyMainContent: true,
          blockAds: true,
          timeout: 30000 // 30 second timeout
        })
      });

      if (!response.ok) {
        throw new Error(`Scraping failed with status ${response.status}`);
      }

      const data: FirecrawlResponse = await response.json();

      if (!data.success || !data.data?.markdown) {
        throw new Error(data.data?.metadata?.error || 'No content received');
      }

      log(`✅ Successfully scraped ${url}`);
      return {
        url,
        markdown: data.data.markdown
      };
    } catch (error) {
      log(`❌ Failed to scrape ${url}:`, error);
      return null;
    }
  }));

  const validResults = results.filter((r): r is ScrapedContent => r !== null);
  log(`Successfully scraped ${validResults.length} out of ${urls.length} URLs`);

  return validResults;
}

// Update analyzeWebsiteContent to use SchemaType
async function analyzeWebsiteContent(content: ScrapedContent, objective: string): Promise<WebsiteAnalysis | null> {
  output.log(`Analyzing website: ${content.url}`);
  log(`Started analyzing website: ${content.url}`, "🚀🚀");
  try {
    const schema: Schema = {
      description: "Short schema of precise conclusion of website analysis agent after analyzing scraped website content with the precise objective of the research given to you.",
      type: SchemaType.OBJECT,
      properties: {
        isRelevant: {
          type: SchemaType.BOOLEAN,
          description: "Does this website content precisely and completely addresses our objective?"
        },
        extractedInfo: {
          type: SchemaType.STRING,
          description: "Highly value packed, highly technical information that completely answering the objective of the query given to you extracted from the website."
        },
        supportingQuote: {
          type: SchemaType.STRING,
          description: "Direct quote that validates the findings"
        }
      },
      required: ["isRelevant", "extractedInfo", "supportingQuote"]
    };

    const { response } = await generateObject({
      system: `You are the Website Analysis Agent. Your task is to review the scraped content of a given website in relation to a specific research objective and extract all relevant, factual, and verifiable information. Only include details that directly contribute to the research objective. Today is ${new Date().toISOString()}. Follow these instructions when responding:

Requirements:
- Compare the website’s content against the provided research objective.
- Extract and list only factual information that clearly supports the objective.
- For each extracted point, include a precise citation (e.g., the URL or reference from the website).
- Give highly value packed points taken from website content that precisely meets the given objective to you. Make it at technical and as detailed as possible. Do not miss any important points, facts and figures if they serve to the given objective.
- Do not generate any additional commentary, opinions, or assumptions. If a section of the content is irrelevant, simply note its lack of relevance.
- Do not give your opinion. Do not hallucinate, whatever you will give as response, must be entire taken from the website content.
`,
      prompt: `Analyze the website and give me all the highly value packed, highly relevent information that precisely serves below objective of the query.:

OBJECTIVE: ${objective}

CONTENT:
${content.markdown}

After you analyze this content with the given objective, you need to return given response in json format.
Return:
1. isRelevant: true only if content directly addresses objective, if the website is not related to the objective at all, it should be false.
2. extractedInfo: important key findings highly relevent to the objective.
3. supportingQuote: any supporting quote that directly serve the objective.`,

      model: process.env.WEBSITE_ANALYZING_MODEL as string,
      generationConfig: {
        responseSchema: schema
      }
    });


    const websiteSummary: { isRelevant: boolean; extractedInfo: string, supportingQuote: string } = JSON.parse(response.text())

    if (!websiteSummary.isRelevant) {
      log(`Completed analyzing website: ${content.url} - Not relevant😔😔`);
      return null;
    }
    log(`Completed analyzing website: ${content.url} - Relevant 😀😀✅✅`);
    return {
      content: websiteSummary.extractedInfo,
      sourceUrl: content.url,
      sourceText: websiteSummary.supportingQuote,
      meetsObjective: true
    };

  } catch (error) {
    log(`Error analyzing content from ${content.url} 😭😭 :`, error);
    return null;
  }
}

export async function writeFinalReport({
  prompt,
  learnings,
  visitedUrls,
}: {
  prompt: string;
  learnings: TrackedLearning[];
  visitedUrls: string[];
}): Promise<{ report_title: string; report: string; sources: Array<{ id: number; url: string; title: string }> }> {
  try {
    // Add input validation
    if (!learnings || learnings.length === 0) {
      throw new Error('No research learnings provided for report generation');
    }

    if (!visitedUrls || visitedUrls.length === 0) {
      throw new Error('No source URLs provided for report generation');
    }

    log("Writing Final Report - 🥅🥅🥅🥅")

    // Create multiple crunchers if needed for large reports
    let processedLearnings: TrackedLearning[] = [];
    const MAX_REPORT_TOKENS = InformationCruncher.getMaxTokenLimit();
    let currentTokenCount = 0;

    // Group learnings by objectives to maintain coherence
    const learningsByObjective = learnings.reduce((acc, learning) => {
      const objective = learning.objective || 'general';
      if (!acc[objective]) {
        acc[objective] = [];
      }
      acc[objective].push(learning);
      return acc;
    }, {} as Record<string, TrackedLearning[]>);

    // Process each objective group separately
    for (const [objective, objectiveLearnings] of Object.entries(learningsByObjective)) {
      let currentBatch: TrackedLearning[] = [];
      let batchTokens = 0;

      for (const learning of objectiveLearnings) {
        const learningTokens = encode(learning.content + learning.sourceText).length;

        if (batchTokens + learningTokens > MAX_REPORT_TOKENS / 2) { // Use half max tokens per batch
          // Crunch current batch
          const batchCruncher = new InformationCruncher(objective);
          for (const item of currentBatch) {
            const crunchedInfo = await batchCruncher.addContent(
              item.content,
              item.sourceUrl,
              item.sourceText
            );

            if (crunchedInfo) {
              processedLearnings.push({
                content: crunchedInfo.content,
                sourceUrl: crunchedInfo.sources.map(s => s.url).join(', '),
                sourceText: crunchedInfo.sources.map(s => s.quote).join(' | '),
                objective: objective
              });
            }
          }

          // Reset batch
          currentBatch = [];
          batchTokens = 0;
        }

        currentBatch.push(learning);
        batchTokens += learningTokens;
      }

      // Process remaining batch
      if (currentBatch.length > 0) {
        const finalBatchCruncher = new InformationCruncher(objective);
        for (const item of currentBatch) {
          const crunchedInfo = await finalBatchCruncher.addContent(
            item.content,
            item.sourceUrl,
            item.sourceText
          );

          if (crunchedInfo) {
            processedLearnings.push({
              content: crunchedInfo.content,
              sourceUrl: crunchedInfo.sources.map(s => s.url).join(', '),
              sourceText: crunchedInfo.sources.map(s => s.quote).join(' | '),
              objective: objective
            });
          }
        }
      }
    }

    // Final crunching if still over token limit
    if (encode(processedLearnings.map(l => l.content + l.sourceText).join(' ')).length > MAX_REPORT_TOKENS) {
      const finalCruncher = new InformationCruncher("Final Report Integration");
      const finalProcessedLearnings: TrackedLearning[] = [];

      for (const learning of processedLearnings) {
        const crunchedInfo = await finalCruncher.addContent(
          learning.content,
          learning.sourceUrl,
          learning.sourceText
        );

        if (crunchedInfo) {
          finalProcessedLearnings.push({
            content: crunchedInfo.content,
            sourceUrl: crunchedInfo.sources.map(s => s.url).join(', '),
            sourceText: crunchedInfo.sources.map(s => s.quote).join(' | ')
          });
        }
      }

      processedLearnings = finalProcessedLearnings;
    }

    // Convert to XML format for report generation
    const learningsString = processedLearnings.map(learning =>
      `<learning>
      <content>${learning.content}</content>
      <source_url>${learning.sourceUrl}</source_url>
      <source_text>${learning.sourceText}</source_text>
    </learning>`
    ).join('\n');

    // Define strict schema for report generation

    // const fomrat = {
    //   reportTitle: "The short 3-5 word short summary of the report to show on sidebar of frontend. So that it is easiler to identify what report is this.",
    //   report: "The complete technical report in markdown format with citations",
    //   sources: [
    //     {
    //       id: 1,
    //       url: "Source URL",
    //       title: "Short most important piece of information extracted from this website."
    //     }
    //   ]
    // }
    const reportSchema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        report_title: {
          type: SchemaType.STRING,
          description: "Short 3-5 word summary about what this report is all about."
        },
        report: {
          type: SchemaType.STRING,
          description: "The complete technical report in markdown format with citations"
        },
        sources: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: {
                type: SchemaType.NUMBER,
                description: "Sequential number for the source"
              },
              url: {
                type: SchemaType.STRING,
                description: "Source URL"
              },
              title: {
                type: SchemaType.STRING,
                description: "Title or description of the source"
              }
            },
            required: ["id", "url", "title"]
          }
        }
      },
      required: ['report_title', "report", "sources"]
    };

    // Generate the actual report using the crunched learnings
    const { response } = await generateObject({
      system: `You are a Technical Research Report Writing Agent. Your task is to write a detailed technical report in markdown format. Follow these strict rules:
      - Write in clear markdown format
      - Every statement must end with a citation in format [n](url) where n is the sequential number
      - Citations must be numbered sequentially [1], [2], etc.
      - Each citation must link to one specific source URL
      - Ensure each source is used at least once
      - Write in highly technical and detailed manner
      - Include all facts, figures, and technical specifications
      - Create a References section at the end with numbered list of all sources
      - Each reference must have a title/description and URL`,
      prompt: `Write a comprehensive technical report using these research findings:

Research Context: ${prompt}

Research Findings:
${learnings.map((l, i) => `
Source ${i + 1}: ${l.sourceUrl}
Content: ${l.content}
Evidence: ${l.sourceText}
`).join('\n\n')}

Format Requirements:
1. Use proper markdown headers (#, ##)
2. Every statement must end with a citation in format [n](url)
3. Add a References section at the end
4. Ensure each citation is a clickable link
5. Be highly technical and detailed
6. Use clear section organization`,
      model: process.env.REPORT_WRITING_MODEL as string,
      generationConfig: {
        responseSchema: reportSchema
      }
    });

    // DONOT REMOVE THIS COMMENT.
    // THE RESULT WILL BE JSON BUT STRINGIFIED JSON.
    // WE NEED TO PARSE THAT STRING AND THEN PASS THE EXACT KEY'S VALUE THAT WE NEED TO SHOW AS REPORT ON FRONTEND AS FULL MARKDOWN.
    //IMPORTANT: DEFINE SCHEMA FOR THE EXACT FORMAT ABOVE.
    const parsedResponse = JSON.parse(response.text());
    return {
      report_title: parsedResponse.report_title,
      report: parsedResponse.report,
      sources: parsedResponse.sources
    };

  } catch (error) {
    log('Report Generation Error:', {
      error: error.message,
      stack: error.stack,
      learningsCount: learnings?.length || 0,
      urlsCount: visitedUrls?.length || 0
    });

    // Enhanced error output now includes an agentResults field (empty if not available)
    const errorOutput = await writeErrorOutput(error, {
      learnings: processedLearnings || learnings,
      visitedUrls,
      failedUrls: [],
      crunchedInfo: {
        processedLearnings,
        tokensUsed: encode(learningsString).length,
        objectives: Object.keys(learningsByObjective)
      },
      agentResults: [],  // ← Added empty agentResults array here
      researchContext: {
        prompt,
        totalSources: visitedUrls.length,
        timeStamp: new Date().toISOString()
      }
    });

    // Write to error-output.md
    await fs.writeFile(
      path.join(process.cwd(), 'error-output.md'),
      errorOutput,
      'utf-8'
    );

    throw error;
  }
}

// Add new type for tracking agent information
interface AgentResult {
  type: 'website-analyzer' | 'information-cruncher' | 'report-writer';
  objective: string;
  url?: string;
  extractedContent?: string;
  crunchedContent?: string;
  success: boolean;
  error?: string;
}

async function writeErrorOutput(error: Error, data: {
  learnings: TrackedLearning[],
  visitedUrls: string[],
  failedUrls: string[],
  crunchedInfo: any,
  agentResults: AgentResult[],  // Add this field
  researchContext?: {
    prompt: string,
    totalSources: number,
    timeStamp: string
  }
}): Promise<string> {
  const errorOutput = `
# Research Error Report
Time: ${new Date().toISOString()}
Error: ${error.message}

${data.researchContext ? `
## Research Context
- Original Query: ${data.researchContext.prompt}
- Total Sources Analyzed: ${data.researchContext.totalSources}
- Research Started: ${data.researchContext.timeStamp}
` : ''}

## Research Progress Summary
- Total Successful Scrapes: ${data.visitedUrls.length}
- Total Failed Scrapes: ${data.failedUrls.length}
- Total Extracted Learnings: ${data.learnings.length}

## Successfully Scraped Websites
${data.visitedUrls.map(url => `- ${url}`).join('\n')}

## Failed Scrapes (Critical Errors)
${data.failedUrls.map(url => `- ${url}`).join('\n')}

## Agent Results
${data.agentResults.map(agent => `
### ${agent.type} ${agent.success ? '✅' : '❌'}
- Objective: ${agent.objective}
${agent.url ? `- URL: ${agent.url}` : ''}
${agent.extractedContent ? `- Extracted Content: ${agent.extractedContent}` : ''}
${agent.crunchedContent ? `- Crunched Content: ${agent.crunchedContent}` : ''}
${agent.error ? `- Error: ${agent.error}` : ''}
`).join('\n')}

## Extracted Information
${data.learnings.map(learning => `
### Source: ${learning.sourceUrl}
${learning.content}

Supporting Quote:
> ${learning.sourceText}
`).join('\n')}

${data.crunchedInfo ? `
## Information Crunching Results
### Processed Learnings
${JSON.stringify(data.crunchedInfo.processedLearnings, null, 2)}

### Token Usage
- Total Tokens: ${data.crunchedInfo.tokensUsed}
- Token Limit: ${InformationCruncher.getMaxTokenLimit()}

### Research Objectives
${data.crunchedInfo.objectives.map((obj: string) => `- ${obj}`).join('\n')}

### Crunching Summary
- Total Crunching Operations: ${data.crunchedInfo.crunchingOperations || 0}
- Average Compression Ratio: ${data.crunchedInfo.compressionRatio || 'N/A'}
` : ''}

## System State
- Node Version: ${process.version}
- Error Stack: ${error.stack}
- Error Time: ${new Date().toISOString()}
- Memory Usage: ${JSON.stringify(process.memoryUsage())}
`;

  // Save error output to file
  const errorFilePath = path.join(process.cwd(), 'error-output.md');
  try {
    await fs.writeFile(errorFilePath, errorOutput, 'utf-8');
    log(`Error output saved to ${errorFilePath}`);
  } catch (writeError) {
    log(`Failed to write error output: ${writeError.message}`);
  }

  return errorOutput;
}

// Modify deepResearch to track agent results
export async function deepResearch({
  query_to_find_websites,
  breadth,
  depth,
  onProgress,
  signal,
  parentTokenCount = 0 // Track tokens from parent calls
}: {
  query_to_find_websites: string;
  breadth: number;
  depth: number;
  onProgress?: (progress: ResearchProgress) => void;
  signal?: AbortSignal;
  parentTokenCount?: number;
}): Promise<ResearchResult> {

  // Add input validation
  if (!query_to_find_websites?.trim()) {
    throw new Error('Query is required');
  }

  if (breadth < 1 || depth < 1) {
    throw new Error('Breadth and depth must be at least 1');
  }

  const MAX_TOTAL_TOKENS = InformationCruncher.getMaxTokenLimit();
  let totalTokenCount = parentTokenCount;
  let results: TrackedLearning[] = [];
  let visitedUrls: string[] = [];
  let failedUrls: string[] = [];
  let lastCrunchedInfo: any = null;

  let agentResults: AgentResult[] = [];
  let queries: QueryWithObjective[] = []; // <-- declare queries here
  const cruncher = new InformationCruncher("Initial Context"); // Initialize cruncher here
  const tokenTracker = new TokenTracker();

  log('Starting research with:', { depth, breadth });

  try {
    // Check for abort
    if (signal?.aborted) {
      throw new Error('Research aborted');
    }

    // Initialize a cruncher per SERP query
    const crunchers = new Map<string, InformationCruncher>();

    // Generate queries with objectives
    queries = await generateQueriesWithObjectives(
      query_to_find_websites,
      breadth
    );

    for (const query of queries) {
      // Create cruncher for this query's objective
      const cruncher = new InformationCruncher(query.objective);
      crunchers.set(query.query, cruncher);

      // Check for abort
      if (signal?.aborted) {
        throw new Error('Research aborted');
      }

      // Check total accumulated tokens including parent calls
      if (totalTokenCount >= MAX_TOTAL_TOKENS) {
        log('Reached maximum token limit. Stopping further research.');
        break;
      }

      // Search
      if (signal?.aborted) throw new Error('Research aborted');
      const searchResults = await searchSerpResults(query.query);

      // Scrape
      if (signal?.aborted) throw new Error('Research aborted');
      const scrapedContents = await scrapeWebsites(
        searchResults.map(r => r.url)
      );

      // Track failed scrapes as critical errors
      const scrapeFails = searchResults.map(r => r.url)
        .filter(url => !scrapedContents.find(c => c.url === url));
      failedUrls.push(...scrapeFails);

      for (const failedUrl of scrapeFails) {
        agentResults.push({
          type: 'website-analyzer',
          objective: query.objective,
          url: failedUrl,
          success: false,
          error: 'Failed to scrape website'
        });
      }

      // Track successful website analysis
      for (const content of scrapedContents) {
        try {
          const analysis = await analyzeWebsiteContent(content, query.objective);

          agentResults.push({
            type: 'website-analyzer',
            objective: query.objective,
            url: content.url,
            extractedContent: analysis?.content,
            success: !!analysis?.meetsObjective
          });

          // Track tokens for each analyzed website
          if (analysis && analysis.meetsObjective) {
            // Add to query's cruncher and check if we need to crunch
            const tokenStatus = tokenTracker.addTokens(
              query.query,
              analysis.content + analysis.sourceText
            );

            // If this query needs crunching
            if (tokenStatus.needsCrunching) {
              const crunchedInfo = await cruncher.addContent(
                analysis.content,
                analysis.sourceUrl,
                analysis.sourceText
              );

              if (crunchedInfo) {
                results.push({
                  content: crunchedInfo.content,
                  sourceUrl: crunchedInfo.sources.map(s => s.url).join(', '),
                  sourceText: crunchedInfo.sources.map(s => s.quote).join(' | '),
                  objective: query.objective
                });

                // Reset query tokens after crunching
                tokenTracker.resetQueryTokens(query.query);
              }
            } else {
              // Add directly if no crunching needed
              results.push({
                content: analysis.content,
                sourceUrl: analysis.sourceUrl,
                sourceText: analysis.sourceText,
                objective: query.objective
              });
            }

            // Check total token limit
            if (tokenTracker.exceedsMaxTokens()) {
              log('Reached maximum total token limit. Starting final crunching...');

              // Final crunch for all accumulated content
              for (const [queryId, queryCruncher] of crunchers) {
                const finalCrunch = await queryCruncher.finalCrunch();
                if (finalCrunch) {
                  results.push({
                    content: finalCrunch.content,
                    sourceUrl: finalCrunch.sources.map(s => s.url).join(', '),
                    sourceText: finalCrunch.sources.map(s => s.quote).join(' | '),
                    objective: queries.find(q => q.query === queryId)?.objective || 'general'
                  });
                }
              }
              break;
            }
          }
        } catch (analysisError) {
          agentResults.push({
            type: 'website-analyzer',
            objective: query.objective,
            url: content.url,
            success: false,
            error: analysisError.message
          });
        }
      }

      // Track information crunching
      // After processing website analysis, do final crunching
      const finalCrunch = await cruncher.finalCrunch();
      if (finalCrunch) {
        agentResults.push({
          type: 'information-cruncher',
          objective: query.objective,
          crunchedContent: finalCrunch.content,
          success: true
        });
        results.push({
          content: finalCrunch.content,
          sourceUrl: finalCrunch.sources.map(s => s.url).join(', '),
          sourceText: finalCrunch.sources.map(s => s.quote).join(' | '),
          objective: query.objective
        });
        lastCrunchedInfo = finalCrunch;
      }

      visitedUrls.push(...scrapedContents.map(c => c.url));

      // Handle depth with token awareness
      if (depth > 1 && totalTokenCount < MAX_TOTAL_TOKENS) {
        const contextString = [
          `Original Context: ${query_to_find_websites}`,
          `Current Findings: ${results.map(r => r.content).join('\n')}`,
          `Next Research Goal: ${query.objective}`
        ].join('\n');

        const deeperResults = await deepResearch({
          query_to_find_websites: contextString,
          breadth: Math.ceil(breadth / 2),
          depth: depth - 1,
          onProgress,
          signal,
          parentTokenCount: totalTokenCount
        });

        results.push(...deeperResults.learnings);
        visitedUrls.push(...deeperResults.visitedUrls);
      }
    }

    // Add validation before returning results
    if (!results.length || !visitedUrls.length) {
      throw new Error('No research results gathered. All queries failed or returned no data.');
    }

    return {
      learnings: results,
      visitedUrls: [...new Set(visitedUrls)]
    };

  } catch (error) {
    if (signal?.aborted) {
      throw new Error('Research aborted');
    }

    // Enhanced error handling
    const errorDetails = await writeErrorOutput(error, {
      learnings: results || [],
      visitedUrls,
      failedUrls,
      crunchedInfo: {
        ...lastCrunchedInfo,
        crunchingOperations: agentResults.filter(a => a.type === 'information-cruncher').length,
        compressionRatio: calculateCompressionRatio(results, lastCrunchedInfo),
        processedLearnings: results,
        tokensUsed: totalTokenCount,
        objectives: queries?.map(q => q.objective) || []
      },
      agentResults,
      researchContext: {
        prompt: query_to_find_websites,
        totalSources: visitedUrls.length,
        timeStamp: new Date().toISOString()
      }
    });

    // Log detailed error summary
    log('Research Error Summary:', {
      error: error.message,
      stack: error.stack,
      totalVisitedUrls: visitedUrls.length,
      totalFailedUrls: failedUrls.length,
      totalLearnings: results?.length || 0,
      totalQueries: queries?.length || 0,
      completedQueries: agentResults.filter(a => a.success).length
    });

    throw error;
  }
}

// Helper function to calculate compression ratio
function calculateCompressionRatio(originalResults: TrackedLearning[], crunchedInfo: any): number {
  if (!originalResults?.length || !crunchedInfo?.content) return 0;

  const originalTokens = encode(originalResults.map(r => r.content).join(' ')).length;
  const crunchedTokens = encode(crunchedInfo.content).length;

  return originalTokens > 0 ? (originalTokens - crunchedTokens) / originalTokens : 0;
}

// SearXNG interfaces
interface SearxResponse {
  results: SearxResult[];
  // other fields not needed
}

interface SearxResult {
  title: string;
  url: string;
  content: string;
  // other fields not needed
}

// Firecrawl interfaces
interface FirecrawlResponse {
  success: boolean;
  data: {
    markdown: string;
  }
  metadata: {
    title: string;
    sourceURL: string;
    error?: string;
    statusCode: number
  };
}

interface ScrapedContent {
  url: string;
  markdown: string;
}

export type ResearchProgress = {
  currentDepth: number;
  totalDepth: number;
  currentBreadth: number;
  totalBreadth: number;
  currentQuery?: string;
  totalQueries: number;
  completedQueries: number;
  analyzedWebsites?: number; // Add this field
};

// Add new types for source tracking
interface TrackedLearning {
  content: string;
  sourceUrl: string;
  sourceText: string;  // Original text snippet that led to this learning
}

type ProcessedResult = {
  learnings: TrackedLearning[];
  followUpQuestions: string[];
};

export type ResearchResult = {
  learnings: TrackedLearning[];
  visitedUrls: string[];
};

// New interface for query objectives
interface QueryWithObjective {
  query: string;
  objective: string;
}

// New interface for website analysis results
interface WebsiteAnalysis {
  content: string;
  sourceUrl: string;
  sourceText: string;
  meetsObjective: boolean;
}

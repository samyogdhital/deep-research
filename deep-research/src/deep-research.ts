// import pLimit from 'p-limit';
import { OutputManager } from './output-manager';
import { InformationCruncher } from './agent/information-cruncher';
import { encode } from 'gpt-tokenizer';  // Add this import
import * as fs from 'fs/promises';
import path from 'path';
import { TokenTracker } from './token-tracker';
import { generateQueriesWithObjectives, QueryWithObjective } from './agent/query-generator';
import { WebsiteAnalyzer } from './agent/website-analyzer';
import { ReportWriter, TrackedLearning, ReportResult } from './agent/report-writer';
import { SearxNG, SearxResult } from './searxng';
import { Firecrawl } from './firecrawl';

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

export async function writeFinalReport({
  prompt,
  learnings,
  visitedUrls,
}: {
  prompt: string;
  learnings: TrackedLearning[];
  visitedUrls: string[];
}): Promise<ReportResult> {
  try {
    const reportWriter = new ReportWriter(output);
    return await reportWriter.generateReport({
      prompt,
      learnings,
      visitedUrls
    });
  } catch (error) {
    log('Report Generation Error:', error);
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
  const cruncher = new InformationCruncher("Initial Context", output); // Initialize cruncher here
  const tokenTracker = new TokenTracker();
  const websiteAnalyzer = new WebsiteAnalyzer(output);
  const searxng = new SearxNG(output);
  const firecrawl = new Firecrawl(output);

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
      const searchResults = await searxng.search(query.query);

      // Scrape
      if (signal?.aborted) throw new Error('Research aborted');
      const scrapedContents = await firecrawl.scrapeWebsites(
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
          const analysis = await websiteAnalyzer.analyzeContent(content, query.objective);

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

type ProcessedResult = {
  learnings: TrackedLearning[];
  followUpQuestions: string[];
};

export type ResearchResult = {
  learnings: TrackedLearning[];
  visitedUrls: string[];
};

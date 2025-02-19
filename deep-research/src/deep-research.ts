// import pLimit from 'p-limit';
import { z } from 'zod';
import { SchemaType } from '@google/generative-ai';

import { systemPrompt } from './prompt';
import { OutputManager } from './output-manager';
import { generateObject } from './ai/providers';

// Initialize output manager for coordinated console/progress output
const output = new OutputManager();

// Replace console.log with output.log
function log(...args: any[]) {
  output.log(...args);
}

// increase this if you have higher API rate limits
const ConcurrencyLimit = 1;


// Update generateQueriesWithObjectives to use SchemaType
async function generateQueriesWithObjectives(context: string, numQueries: number): Promise<QueryWithObjective[]> {
  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      queries: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            query: {
              type: SchemaType.STRING,
              description: "Very specific keyword to do serp query highly related to user's prompt."
            },
            objective: {
              type: SchemaType.STRING,
              description: "The highly detailed objective of of this query that we generated for websites analyzing agent to scrape on and analyze whether this objective is met through that website content or not."
            }
          },
          required: ["query", "objective"]
        },
        minItems: 1,
        maxItems: numQueries
      }
    },
    required: ["queries"]
  };

  const { response } = await generateObject({
    system: systemPrompt(),
    prompt: `Given this research context, generate strategic search queries to find detailed information.

CONTEXT:
${context}

REQUIREMENTS:
1. Generate ${numQueries} different search queries
2. Each query should target a specific aspect
4. Focus on high-quality sources (academic, industry reports)

For each query:
- Make it specific and targeted and short query.
- Include an objective explaining what information we want to find.
- Follow the schema for structured json output.
`,
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseSchema: schema
    }
  });

  const query_objectives: { queries: QueryWithObjective[] } = JSON.parse(response.text())

  return query_objectives.queries
}

async function searchSerpResults(query: string): Promise<SearxResult[]> {
  try {
    // Improved query formatting
    // const formattedQuery = encodeURIComponent(query)
    //   .replace(/%20OR%20/g, ' OR ')
    //   .replace(/%22/g, '"');

    const response = await fetch(
      `http://localhost:8080/search?q=${query}&format=json&language=en&time_range=year&safesearch=0`,
      {
        method: "GET",
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Search failed with status ${response.status}`);
    }

    const data: SearxResponse = await response.json();
    log(`Search found ${data.results?.length || 0} results for query: ${query}`);

    if (!data.results?.length) {
      log('Warning: No search results found');
      return [];
    }

    // Take more results for better coverage
    // return data.results.slice(0, 5);  // Get top 5 results instead of just 1
    return data.results
  } catch (error) {
    log('Error during search:', error);
    return [];
  }
}

async function scrapeWebsites(urls: string[]): Promise<ScrapedContent[]> {
  if (!urls.length) {
    log('No URLs to scrape');
    return [];
  }

  log(`Attempting to scrape ${urls.length} URLs`);

  const results = await Promise.all(urls.map(async url => {
    try {
      // Fix: Use correct docker host internal URL
      const response = await fetch('http://host.docker.internal:3002/v1/scrape', {
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
  try {
    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        analysis: {
          type: SchemaType.OBJECT,
          properties: {
            isRelevant: {
              type: SchemaType.BOOLEAN,
              description: "Whether content directly addresses our objective"
            },
            extractedInfo: {
              type: SchemaType.STRING,
              description: "Concise, factual summary of relevant findings"
            },
            supportingQuote: {
              type: SchemaType.STRING,
              description: "Direct quote that validates the findings"
            }
          },
          required: ["isRelevant", "extractedInfo", "supportingQuote"]
        }
      },
      required: ["analysis"]
    };

    const { response } = await generateObject({
      system: systemPrompt(),
      prompt: `Analyze if this content matches our objective:

OBJECTIVE: ${objective}

CONTENT:
${content.markdown}

Return:
1. isRelevant: true only if content directly addresses objective
2. extractedInfo: key findings if relevant
3. supportingQuote: direct quote supporting findings`,

      model: 'gemini-2.0-flash-lite-preview-02-05',
      generationConfig: {
        responseSchema: schema
      }
    });


    const websiteSummary: { isRelevant: boolean; extractedInfo: string, supportingQuote: string } = JSON.parse(response.text())

    if (!websiteSummary.isRelevant) {
      return null;
    }

    return {
      content: websiteSummary.extractedInfo,
      sourceUrl: content.url,
      sourceText: websiteSummary.supportingQuote,
      meetsObjective: true
    };

  } catch (error) {
    log(`Error analyzing content from ${content.url}:`, error);
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
}) {
  const learningsString = learnings.map(learning =>
    `<learning>
      <content>${learning.content}</content>
      <source_url>${learning.sourceUrl}</source_url>
      <source_text>${learning.sourceText}</source_text>
    </learning>`
  ).join('\n');

  try {
    const schema = {
      type: SchemaType.STRING,
      description: "Markdown formatted research report"
    };

    const { response } = await generateObject({
      system: systemPrompt(),
      prompt: `Write a detailed research report addressing this query: "${prompt}"

Research findings:
${learningsString}

IMPORTANT:
- Return ONLY the markdown report text as a plain string.
- Do NOT include any markdown code fences, metadata, or explanations.
- Ensure every fact is cited as [Source: URL].
- And in the end there should be the list of all websites that you considered to write this report.

Use clear sections and proper markdown formatting.`,
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseSchema: schema
      }
    });

    const report = JSON.parse(response.text())
    return report;
  } catch (error) {
    log('Error generating report:', error);
    throw new Error('Failed to generate research report');
  }
}

// Modified main research function
export async function deepResearch({
  query_to_find_websites,
  breadth,
  depth,
  onProgress,
}: {
  query_to_find_websites: string;
  breadth: number;
  depth: number;
  onProgress?: (progress: ResearchProgress) => void;
}): Promise<ResearchResult> {
  // Generate queries with objectives
  const queries = await generateQueriesWithObjectives(
    query_to_find_websites,
    breadth
  );

  const results: TrackedLearning[] = [];
  const visitedUrls: string[] = [];

  // Process each query
  for (const query of queries) {
    // Search
    const searchResults = await searchSerpResults(query.query);

    // Scrape
    const scrapedContents = await scrapeWebsites(
      searchResults.map(r => r.url)
    );

    // Analyze each website
    const analyses = await Promise.all(
      scrapedContents.map(content =>
        analyzeWebsiteContent(content, query.objective)
      )
    );

    // Filter and collect relevant results
    const relevantAnalyses = analyses.filter(
      (a): a is WebsiteAnalysis => a !== null && a.meetsObjective
    );

    results.push(...relevantAnalyses.map(a => ({
      content: a.content,
      sourceUrl: a.sourceUrl,
      sourceText: a.sourceText
    })));

    visitedUrls.push(...scrapedContents.map(c => c.url));

    // Handle depth if needed
    if (depth > 1) {
      const deeperResults = await deepResearch({
        query_to_find_websites: `
          Original Context: ${query_to_find_websites}
          Current Findings: ${relevantAnalyses.map(a => a.content).join('\n')}
          Next Research Goal: ${query.objective}
        `,
        breadth: Math.ceil(breadth / 2),
        depth: depth - 1,
        onProgress
      });

      results.push(...deeperResults.learnings);
      visitedUrls.push(...deeperResults.visitedUrls);
    }
  }

  return {
    learnings: results,
    visitedUrls: [...new Set(visitedUrls)]
  };
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
    metadata: {
      title: string;
      sourceURL: string;
      error?: string;
      statusCode: number
    };
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

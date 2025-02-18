//TODO: Hit searxng api here directly and do not even run firecrawl for search
//  const result: {results:{title:string; url: string; content:string}[]} = await fetch(`http://docker.host.internal:8080?q=${serpQuery.query}&format=json`).then(res=>res.json())

// Remove this below firecrawl.search(...)... that is there below. Do not do through that package. Do directly through above api key. This abvoe api key gives the response to teh query in this typescript foramt {results:{title:string; url: string; content:string}[]}; So from here we are getting url and content. From content we can analyze if this website(url) has the information we need or not. When analyzing the array of response we get from the query by searxng, we analyze the content for each and only consider the url that actually highly relevent to the query the user need. Now this filtered list of websites we have, we call this below api from firecrawl.
// const options = {
//   method: 'POST',
//   headers: {Authorization: 'Bearer <token>', 'Content-Type': 'application/json'},
//   body: '{"formats":["markdown"]}'
// };

// fetch('https://api.firecrawl.dev/v1/scrape', options)
//   .then(response => response.json())
//   .then(response => console.log(response))
//   .catch(err => console.error(err));

// After we do that we get the data from the website in markdown format for each of these websites. We then consider that for the end report. Keep in mind we do not consider the response from searxng to write report, that one is only for selecting the right website to fetch actual content from.



// import FirecrawlApp, { SearchResponse } from '@mendable/firecrawl-js';
import { compact } from 'lodash-es';
// import pLimit from 'p-limit';
import { z } from 'zod';

import { generateObject, trimPrompt } from './ai';
import { systemPrompt } from './prompt';
import { OutputManager } from './output-manager';

// Initialize output manager for coordinated console/progress output
const output = new OutputManager();

// Replace console.log with output.log
function log(...args: any[]) {
  output.log(...args);
}



// increase this if you have higher API rate limits
const ConcurrencyLimit = 1;

// Initialize Firecrawl with optional API key and optional base url

// const firecrawl = new FirecrawlApp({
//   apiKey: process.env.FIRECRAWL_KEY ?? '',
//   apiUrl: process.env.FIRECRAWL_BASE_URL,
// });

// take en user query, return a list of SERP queries
async function generateSerpQueries({
  query_to_find_websites,
  numQueries = 2,
  previous_learnings_we_have,
}: {
  query_to_find_websites: string;
  numQueries?: number;

  // optional, if provided, the research will continue from the last learning
  previous_learnings_we_have?: string[];
}) {
  const { object } = await generateObject({
    system: systemPrompt(),
    prompt: `Given the following prompt from the user, generate a list of SERP queries to research the topic. Return a maximum of ${numQueries} queries, but feel free to return less if the original prompt is clear. Make sure each query is unique and not similar to each other: <prompt>${query_to_find_websites}</prompt>\n\n${previous_learnings_we_have
      ? `Here are some learnings from previous research, use them to generate more specific queries: ${previous_learnings_we_have.join(
        '\n',
      )}`
      : ''
      }`,
    schema: z.object({
      queries: z
        .array(
          z.object({
            query: z.string().describe('The SERP query'),
            researchGoal: z
              .string()
              .describe(
                'First talk about the goal of the research that this query is meant to accomplish, then go deeper into how to advance the research once the results are found, mention additional research directions. Be as specific as possible, especially for additional research directions.',
              ),
          }),
        )
        .describe(`List of SERP queries, max of ${numQueries}`),
    }),
    provider: 'gemini-2.0-flash'    // <-- use Gemini 2.0 flash model for SERP queries
  });
  log(
    `Created ${object.queries.length} queries`,
    object.queries,
  );

  return object.queries.slice(0, numQueries);
}

// Add URL validation helper
// function isValidUrl(urlString: string): boolean {
//   try {
//     new URL(urlString);
//     return true;
//   } catch {
//     return false;
//   }
// }

// async function analyzeRelevance(results: SerpResult[], researchGoal: string) {
//   const prompt = `Task: Analyze search results and rate their relevance to our research goal.

// Research Goal: "${researchGoal}"

// Format each result as:
// {
//   "url": "website-url",
//   "relevanceScore": 0.0-1.0,
//   "reason": "Brief explanation of relevance"
// }

// Search Results:
// ${results.slice(0, 2).map((r, i) => 
//   `Result ${i + 1}:
//   Title: ${r.title}
//   URL: ${r.url}
//   Preview: ${r.content?.substring(0, 200)}...`
// ).join('\n\n')}`;


//   try {
//     const {object} = await generateObject({
//       system: systemPrompt(),
//       prompt,
//       schema: z.object({
//         relevantUrls: z.array(z.object({
//           url: z.string(),
//           relevanceScore: z.number().min(0).max(1),
//           reason: z.string()
//         }))
//       }),
//       provider: { id: 'gemini-2.0-flash' }
//     });

//     return object.relevantUrls
//       .filter(r => r.relevanceScore > 0.7 && isValidUrl(r.url))
//       .map(r => {
//         log(`Selected ${r.url} (Score: ${r.relevanceScore}): ${r.reason}`);
//         return r.url;
//       });
//   } catch (error) {
//     log('Error analyzing relevance:', error);
//     // Return subset of original URLs as fallback
//     return results
//       .slice(0, 3)
//       .map(r => r.url)
//       .filter(isValidUrl);
//   }
// }

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

type ResearchResult = {
  learnings: TrackedLearning[];
  visitedUrls: string[];
};

// Update processSerpResult
async function processSerpResult({
  already_scraped_single_query,
  websiteScrapedContents,
  numLearnings = 3,
  numFollowUpQuestions = 3,
}: {
  already_scraped_single_query: string;
  websiteScrapedContents: ScrapedContent[];
  numLearnings?: number;
  numFollowUpQuestions?: number;
}): Promise<ProcessedResult> {

  const { object } = await generateObject({
    abortSignal: AbortSignal.timeout(60_000),
    system: systemPrompt(),
    prompt: `Analyze these scraped contents and generate learnings with their sources.
    
For each learning, specify:
1. The learning itself
2. The exact quote/text from the source that supports this learning
3. The source URL

Query: ${already_scraped_single_query}

Contents:
${websiteScrapedContents.map(content =>
      `URL: ${content.url}\nContent:\n${content.markdown}\n---\n`
    ).join('\n')}`,
    schema: z.object({
      learnings: z.array(z.object({
        content: z.string().describe('The learning/insight itself'),
        sourceUrl: z.string().describe('URL where this information was found'),
        sourceText: z.string().describe('Exact quote or text snippet that supports this learning')
      })),
      followUpQuestions: z.array(z.string())
    }),
    provider: 'gemini-2.0-flash'
  });

  return object;
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
  const learningsString = trimPrompt(
    learnings.map(learning =>
      `<learning>
        <content>${learning.content}</content>
        <source_url>${learning.sourceUrl}</source_url>
        <source_text>${learning.sourceText}</source_text>
      </learning>`
    ).join('\n'),
    150_000,
  );

  const res = await generateObject({
    system: systemPrompt(),
    prompt: `Write a comprehensive research report on the following topic. For each claim or information you include, cite the source using the provided source text and URL.

User query: ${prompt}

Research findings:
${learningsString}

Guidelines:
- Include citations for every fact/claim using [Source: URL]
- When citing, include relevant quotes from source_text
- Organize into clear sections with proper citations
- Maintain academic writing style
- Use markdown formatting`,
    schema: z.object({
      reportMarkdown: z.string()
    }),
    provider: 'gemini-2.0-flash-thinking-exp-01-21'
  });

  return res.object.reportMarkdown;
}

async function searchSerpResults(query: string): Promise<SearxResult[]> {
  try {
    // Fix: Use docker host internal URL and correct endpoint
    const response = await fetch(
      `http://localhost:8080/search?q=${encodeURIComponent(query)}&format=json`,
      {
        method: "GET",  // Changed to GET
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

    // Log first result for debugging
    if (data.results[0]) {
      log('First result sample:', {
        title: data.results[0].title,
        url: data.results[0].url.substring(0, 100),
        contentPreview: data.results[0].content.substring(0, 100)
      });
    }

    return data.results;
  } catch (error) {
    log('Error during search:', error);
    return [];
  }
}

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

// Generate queries with objectives
async function generateQueriesWithObjectives(context: string, numQueries: number): Promise<QueryWithObjective[]> {
  const { object } = await generateObject({
    system: systemPrompt(),
    prompt: `Analyze this research context and generate specific search queries with clear objectives:
    ${context}
    
    For each query, specify:
    1. The search query itself
    2. A detailed objective explaining what specific information we want to find
    
    Generate ${numQueries} different queries that will help gather comprehensive information.`,
    schema: z.object({
      queries: z.array(z.object({
        query: z.string(),
        objective: z.string()
      }))
    }),
    provider: 'gemini-2.0-flash'
  });

  return object.queries;
}

// Analyze single website content
async function analyzeWebsiteContent(
  content: ScrapedContent,
  objective: string
): Promise<WebsiteAnalysis | null> {
  try {
    const { object } = await generateObject({
      system: systemPrompt(),
      prompt: `Analyze this website content against our research objective.
      
      Objective: ${objective}
      
      Content:
      ${content.markdown}
      
      Extract only highly relevant, fact-based information that directly addresses the objective.
      If no relevant information is found, return null.`,
      schema: z.object({
        analysis: z.object({
          content: z.string(),
          sourceText: z.string(),
          meetsObjective: z.boolean()
        })
      }),
      provider: 'gemini-2.0-flash-lite-preview-02-05'
    });

    return {
      ...object.analysis,
      sourceUrl: content.url
    };

  } catch (error) {
    log(`Error analyzing content from ${content.url}:`, error);
    return null;
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

interface SerpResult {
  title: string;
  url: string;
  content: string;
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
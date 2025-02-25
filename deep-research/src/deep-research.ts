import { OutputManager } from './output-manager';
import { InformationCruncher } from './agent/information-cruncher';
import * as fs from 'fs/promises';
import path from 'path';
import { TokenTracker } from './token-tracker';
import { generateQueriesWithObjectives } from './agent/query-generator';
import { WebsiteAnalyzer } from './agent/website-analyzer';
import { type TrackedLearning } from './agent/report-writer';
import { SearxNG } from './searxng';
import { Firecrawl } from './firecrawl';
import { type AgentResult, type ResearchProgress, type ResearchResult } from './types';

// Initialize output manager
export const output = new OutputManager();

export function setBroadcastFn(broadcastFn: (message: string) => void) {
  output['broadcastFn'] = broadcastFn;
}

function log(...args: any[]) {
  output.log(...args);
}

async function writeErrorOutput(error: Error, data: {
  learnings: TrackedLearning[],
  visitedUrls: string[],
  failedUrls: string[],
  crunchedInfo: any,
  agentResults: AgentResult[],
  researchContext?: {
    prompt: string,
    totalSources: number,
    timeStamp: string
  }
}): Promise<string> {
  // Create error report with citations and sources
  const errorOutput = `
# Research Error Report
${new Date().toISOString()}
${error.message}

${data.researchContext ? `
Original Query: ${data.researchContext.prompt}
Sources Analyzed: ${data.researchContext.totalSources}
Research Started: ${data.researchContext.timeStamp}
` : ''}

## Research Status
Successful Scrapes: ${data.visitedUrls.length}
Failed Scrapes: ${data.failedUrls.length}
Extracted Learnings: ${data.learnings.length}

## Agent Results
${data.agentResults.map(agent => `
${agent.type} ${agent.success ? '✅' : '❌'}
Objective: ${agent.objective}
${agent.url ? `URL: ${agent.url}` : ''}
${agent.extractedContent ? `Content: ${agent.extractedContent}` : ''}
${agent.error ? `Error: ${agent.error}` : ''}
`).join('\n')}

## Extracted Information with Citations
${data.learnings.map(learning => `
Source: ${learning.sourceUrl}
${learning.content}
Quote: "${learning.sourceText}"
`).join('\n')}
`;

  const errorFilePath = path.join(process.cwd(), 'error-output.md');
  await fs.writeFile(errorFilePath, errorOutput, 'utf-8');
  return errorOutput;
}

export async function deepResearch({
  query_to_find_websites,
  breadth,
  depth,
  onProgress,
  signal,
  parentTokenCount = 0
}: {
  query_to_find_websites: string;
  breadth: number;
  depth: number;
  onProgress?: (progress: ResearchProgress) => void;
  signal?: AbortSignal;
  parentTokenCount?: number;
}): Promise<ResearchResult> {
  // Input validation
  if (!query_to_find_websites?.trim()) throw new Error('Query is required');
  if (breadth < 1 || depth < 1) throw new Error('Invalid depth or breadth');

  // Initialize agents and trackers
  const MAX_TOTAL_TOKENS = InformationCruncher.getMaxTokenLimit();
  const searxng = new SearxNG(output);
  const firecrawl = new Firecrawl(output);
  const websiteAnalyzer = new WebsiteAnalyzer(output);
  const tokenTracker = new TokenTracker();

  let totalTokenCount = parentTokenCount;
  let results: TrackedLearning[] = [];
  let visitedUrls: string[] = [];
  let failedUrls: string[] = [];
  let agentResults: AgentResult[] = [];
  let lastCrunchedInfo: any = null;

  try {
    // Core research logic
    const queries = await generateQueriesWithObjectives(query_to_find_websites, breadth);
    const crunchers = new Map<string, InformationCruncher>();

    for (const query of queries) {
      if (signal?.aborted) throw new Error('Research aborted');
      if (totalTokenCount >= MAX_TOTAL_TOKENS) {
        log('Token limit reached. Stopping research.');
        break;
      }

      // Initialize cruncher for this query
      const cruncher = new InformationCruncher(query.objective, output);
      crunchers.set(query.query, cruncher);

      // Search and scrape
      const searchResults = await searxng.search(query.query);
      const scrapedContents = await firecrawl.scrapeWebsites(searchResults.map(r => r.url));

      // Track failures
      const scrapeFails = searchResults.map(r => r.url)
        .filter(url => !scrapedContents.find(c => c.url === url));
      failedUrls.push(...scrapeFails);

      // Process successful scrapes
      // ...existing website analysis and crunching logic...

      // Handle depth recursion
      if (depth > 1 && totalTokenCount < MAX_TOTAL_TOKENS) {
        const contextString = [
          `Original Query: ${query_to_find_websites}`,
          `Current Findings: ${results.map(r => r.content).join('\n')}`,
          `Next Goal: ${query.objective}`
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

    return {
      learnings: results,
      visitedUrls: [...new Set(visitedUrls)]
    };

  } catch (error) {
    // Handle errors with detailed reporting
    const errorDetails = await writeErrorOutput(error, {
      learnings: results,
      visitedUrls,
      failedUrls,
      crunchedInfo: lastCrunchedInfo,
      agentResults,
      researchContext: {
        prompt: query_to_find_websites,
        totalSources: visitedUrls.length,
        timeStamp: new Date().toISOString()
      }
    });

    throw error;
  }
}

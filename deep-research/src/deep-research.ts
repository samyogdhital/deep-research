import { InformationCruncher, CrunchResult } from './agent/information-cruncher';
import { generateQueriesWithObjectives } from './agent/query-generator';
import { WebsiteAnalyzer } from './agent/website-analyzer';
import { type TrackedLearning } from './agent/report-writer';
import { SearxNG } from '../content-extraction/searxng';
import { Firecrawl } from '../content-extraction/firecrawl';
import { type AgentResult, type ResearchProgress, type ResearchResult, type ScrapedContent, type SearxResult } from './types';
import { encode } from 'gpt-tokenizer';
import { ResearchDB } from './db';
import { WebSocketManager } from './websocket';

// Define types for MVP
interface SerpQuery {
  query: string;
  objective: string;
  query_rank: number;
  successful_scraped_websites: ScrapedWebsite[];
  failedWebsites: string[];
}

interface ScrapedWebsite {
  url: string;
  title: string;
  description: string;
  isRelevant: number;
  extracted_from_website_analyzer_agent: string[];
}

interface InformationCrunchingResult {
  query_rank: number;
  crunched_information: Array<{
    url: string;
    content: string[];
  }>;
}

interface EnhancedSearchResult extends SearxResult, ScrapedContent {
  description?: string;
}

const MAX_RESULTS_PER_QUERY = 1; // Maximum number of results to process per query for MVP
const MAX_WORDS = 50000; // Maximum words before crunching

export async function deepResearch({
  query_to_find_websites,
  breadth,
  depth,
  signal,
  researchId,
  parentTokenCount = 0,
  parentFindings = [],
  currentDepth = 1,
  wsManager
}: {
  query_to_find_websites: string;
  breadth: number;
  depth: number;
  signal?: AbortSignal;
  researchId: string;
  parentTokenCount?: number;
  parentFindings?: TrackedLearning[];
  currentDepth?: number;
  wsManager?: WebSocketManager;
}): Promise<ResearchResult> {
  // Input validation
  if (!query_to_find_websites?.trim()) throw new Error('Query is required');
  if (breadth < 1 || depth < 1) throw new Error('Invalid depth or breadth');

  // Initialize agents and database
  const searxng = new SearxNG();
  const firecrawl = new Firecrawl();
  const websiteAnalyzer = new WebsiteAnalyzer();
  const db = await ResearchDB.getInstance();

  let results: TrackedLearning[] = [...parentFindings];
  let failedUrls: string[] = [];
  let totalTokenCount = parentTokenCount;
  let totalWordsAcrossQueries = 0;
  let crunchedResults = new Map<number, CrunchResult>();

  try {
    // Generate search queries with objectives
    const queries = await generateQueriesWithObjectives(query_to_find_websites, breadth);
    console.log(`Generated ${queries.length} queries for depth ${currentDepth}`);

    for (const query of queries) {
      if (signal?.aborted) throw new Error('Research aborted');

      // Save SERP query to database first
      const serpQuery: SerpQuery = {
        query: query.query,
        objective: query.objective,
        query_rank: queries.indexOf(query) + 1,
        successful_scraped_websites: [],
        failedWebsites: []
      };
      await db.addSerpQuery(researchId, serpQuery);

      // Emit new SERP query event after DB save
      if (wsManager) {
        await wsManager.handleNewSerpQuery(researchId);
      }

      // Search and scrape websites
      const searchResults: SearxResult[] = await searxng.search(query.query);
      const limitedResults = searchResults.slice(0, MAX_RESULTS_PER_QUERY);

      console.log(`Scraping ${limitedResults.length} URLs for query "${query.query}"`);
      const scrapedContents = await firecrawl.scrapeWebsites(limitedResults.map(r => r.url));

      // Map scraped content and update DB before emitting events
      const successfulScrapes: EnhancedSearchResult[] = scrapedContents.map(sc => {
        const searchResult = limitedResults.find(r => r.url === sc.url);
        return {
          ...searchResult!,
          ...sc
        };
      });

      // Handle failed scrapes
      const scrapeFails = limitedResults
        .filter(r => !scrapedContents.some(sc => sc.url === r.url))
        .map(r => r.url);

      failedUrls.push(...scrapeFails);

      // Update DB with failed URLs
      await db.updateSerpQueryResults(researchId, serpQuery.query_rank, [], scrapeFails);

      // Emit website scraped events after DB update
      if (wsManager) {
        for (const content of scrapedContents) {
          await wsManager.handleWebsiteScraped(researchId);
        }
      }

      // Process successful scrapes
      const cruncher = new InformationCruncher(query.objective);
      let queryResults: TrackedLearning[] = [];
      let queryWords = 0;

      // Analyze websites
      for (const content of successfulScrapes) {
        try {
          const analysis = await websiteAnalyzer.analyzeContent({
            url: content.url,
            markdown: content.markdown
          }, query.objective);

          if (analysis?.meetsObjective) {
            // Save to DB first
            const scrapedWebsite: ScrapedWebsite = {
              url: content.url,
              title: content.title,
              description: content.description || '',
              isRelevant: analysis.meetsObjective ? 8 : 5,
              extracted_from_website_analyzer_agent: [analysis.content]
            };
            serpQuery.successful_scraped_websites.push(scrapedWebsite);
            await db.updateSerpQueryResults(researchId, serpQuery.query_rank, serpQuery.successful_scraped_websites, serpQuery.failedWebsites);

            // Emit website analysis event after DB update
            if (wsManager) {
              await wsManager.handleWebsiteAnalysis(researchId);
            }

            // Track words and content
            const words = analysis.content.split(/\s+/).length;
            queryWords += words;
            totalWordsAcrossQueries += words;

            queryResults.push({
              content: analysis.content,
              sourceUrl: content.url,
              sourceText: analysis.sourceText
            });

            // Crunch information if needed
            if (totalWordsAcrossQueries >= MAX_WORDS) {
              if (wsManager) {
                await wsManager.handleCrunchingStart(researchId);
              }

              const crunchedInfo = await cruncher.addContent(
                queryResults.map(r => r.content).join('\n'),
                content.url,
                queryResults.map(r => r.sourceText).join('\n')
              );

              if (crunchedInfo) {
                // Save to DB first
                const crunchingResult: InformationCrunchingResult = {
                  query_rank: serpQuery.query_rank,
                  crunched_information: [{
                    url: content.url,
                    content: [crunchedInfo.content]
                  }]
                };
                await db.addCrunchedInformation(researchId, crunchingResult);

                // Emit crunching complete event after DB save
                if (wsManager) {
                  await wsManager.handleCrunchingComplete(researchId);
                }

                // Update results
                results = results.filter(r => !queryResults.some(qr => qr.sourceUrl === r.sourceUrl));
                results.push({
                  content: crunchedInfo.content,
                  sourceUrl: content.url,
                  sourceText: queryResults[0]?.sourceText || ''
                });

                queryWords = 0;
                queryResults = [];
              }
            }
          }
        } catch (error) {
          console.error(`Failed to analyze ${content.url}:`, error);
          failedUrls.push(content.url);
          serpQuery.failedWebsites.push(content.url);
          await db.updateSerpQueryResults(researchId, serpQuery.query_rank, serpQuery.successful_scraped_websites, serpQuery.failedWebsites);
          continue;
        }
      }

      // Add remaining uncrunched results if under word limit
      if (queryResults.length > 0 && totalWordsAcrossQueries < MAX_WORDS) {
        results.push(...queryResults);
      } else if (queryResults.length > 0 && queryResults[0]?.sourceUrl) {
        // Final crunch for remaining content
        const finalCrunch = await cruncher.finalCrunch();
        if (finalCrunch) {
          const crunchingResult: InformationCrunchingResult = {
            query_rank: serpQuery.query_rank,
            crunched_information: [{
              url: queryResults[0].sourceUrl,
              content: [finalCrunch.content]
            }]
          };
          await db.addCrunchedInformation(researchId, crunchingResult);
          crunchedResults.set(serpQuery.query_rank, finalCrunch);
        }
      }

      // Handle recursive depth if we found relevant content
      if (queryResults.length > 0 && currentDepth < depth) {
        console.log(`Starting depth ${currentDepth + 1} research...`);
        const nextBreadth = Math.ceil(breadth / 2); // Instead of Math.max(2, Math.floor(breadth / 2))
        const contextString = [
          query_to_find_websites,
          `Current Findings: ${results.map(r => r.content).join('\n')}`,
          `Next Goal: ${query.objective}`
        ].join('\n');

        const deeperResults = await deepResearch({
          query_to_find_websites: contextString,
          breadth: nextBreadth,
          depth,
          signal,
          researchId,
          parentTokenCount: totalTokenCount,
          parentFindings: results,
          currentDepth: currentDepth + 1,
          wsManager
        });

        results.push(...deeperResults.learnings);
        failedUrls.push(...deeperResults.failedUrls);
      }
    }

    // Final result
    return {
      learnings: results,
      failedUrls: [...new Set(failedUrls)]
    };

  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred during research');
  }
}

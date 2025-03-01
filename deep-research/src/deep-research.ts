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
  successful_scraped_websites: Array<{
    id: number;
    url: string;
    title: string;
    description: string;
    status: 'scraping' | 'analyzing' | 'analyzed';
    isRelevant: number;
    extracted_from_website_analyzer_agent: string[];
  }>;
  failedWebsites: Array<{
    website: string;
    stage: 'scraping' | 'analyzing';
  }>;
}

interface ScrapedWebsite {
  id: number;
  url: string;
  title: string;
  description: string;
  status: 'scraping' | 'analyzing' | 'analyzed';
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

const MAX_RESULTS_PER_QUERY = 3; // Maximum number of results to process per query for MVP
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

      // Initialize SERP query
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

      // Search for websites
      const searchResults: SearxResult[] = await searxng.search(query.query);
      const limitedResults = searchResults.slice(0, MAX_RESULTS_PER_QUERY);

      // Initialize website objects with IDs immediately
      serpQuery.successful_scraped_websites = limitedResults.map((result, index) => ({
        id: index + 1,
        url: result.url,
        title: result.title || result.url,
        description: result.content || '',
        status: 'scraping',
        isRelevant: 0,
        extracted_from_website_analyzer_agent: []
      }));

      // Save initial website objects and emit event
      await db.updateSerpQueryResults(researchId, serpQuery.query_rank, serpQuery.successful_scraped_websites, serpQuery.failedWebsites);
      if (wsManager) {
        await wsManager.handleNewSerpQuery(researchId);
      }

      // Scrape websites
      console.log(`Scraping ${limitedResults.length} URLs for query "${query.query}"`);
      const scrapedContents = await firecrawl.scrapeWebsites(limitedResults.map(r => r.url));

      // Handle failed scrapes
      const failedScrapes = limitedResults
        .filter(r => !scrapedContents.some(sc => sc.url === r.url))
        .map(r => ({
          website: r.url,
          stage: 'scraping' as const
        }));

      // Remove failed websites from successful_scraped_websites
      serpQuery.successful_scraped_websites = serpQuery.successful_scraped_websites
        .filter(w => !failedScrapes.some(f => f.website === w.url));
      serpQuery.failedWebsites = failedScrapes;

      // Update DB and emit event for failed scrapes
      await db.updateSerpQueryResults(researchId, serpQuery.query_rank, serpQuery.successful_scraped_websites, serpQuery.failedWebsites);
      if (wsManager) {
        await wsManager.handleWebsiteScraped(researchId);
      }

      // Process successful scrapes
      const cruncher = new InformationCruncher(query.objective);
      let queryResults: TrackedLearning[] = [];
      let queryWords = 0;

      // Analyze websites
      for (const content of scrapedContents) {
        try {
          // Find corresponding website object
          const website = serpQuery.successful_scraped_websites.find(w => w.url === content.url);
          if (!website) continue;

          // Update status to analyzing
          website.status = 'analyzing';
          await db.updateSerpQueryResults(researchId, serpQuery.query_rank, serpQuery.successful_scraped_websites, serpQuery.failedWebsites);
          if (wsManager) {
            await wsManager.handleWebsiteAnalysis(researchId);
          }

          const analysis = await websiteAnalyzer.analyzeContent({
            url: content.url,
            markdown: content.markdown
          }, query.objective);

          if (analysis?.meetsObjective) {
            // Update website with analysis results
            website.status = 'analyzed';
            website.isRelevant = analysis.meetsObjective ? 8 : 5;
            website.extracted_from_website_analyzer_agent = [analysis.content];

            // Save to DB and emit event
            await db.updateSerpQueryResults(researchId, serpQuery.query_rank, serpQuery.successful_scraped_websites, serpQuery.failedWebsites);
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

            // Handle information crunching
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
                const crunchingResult: InformationCrunchingResult = {
                  query_rank: serpQuery.query_rank,
                  crunched_information: [{
                    url: content.url,
                    content: [crunchedInfo.content]
                  }]
                };
                await db.addCrunchedInformation(researchId, crunchingResult);

                if (wsManager) {
                  await wsManager.handleCrunchingComplete(researchId);
                }

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

          // Move website to failed list with analyzing stage
          const failedWebsite = serpQuery.successful_scraped_websites.find(w => w.url === content.url);
          if (failedWebsite) {
            serpQuery.successful_scraped_websites = serpQuery.successful_scraped_websites.filter(w => w.url !== content.url);
            serpQuery.failedWebsites.push({
              website: content.url,
              stage: 'analyzing'
            });
            await db.updateSerpQueryResults(researchId, serpQuery.query_rank, serpQuery.successful_scraped_websites, serpQuery.failedWebsites);
            if (wsManager) {
              await wsManager.handleWebsiteAnalysis(researchId);
            }
          }
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

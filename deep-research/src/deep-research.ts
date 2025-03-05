import { InformationCruncher, CrunchResult } from './agent/information-cruncher';
import { generateQueriesWithObjectives } from './agent/query-generator';
import { WebsiteAnalyzer } from './agent/website-analyzer';
import { SearxNG } from '../content-extraction/searxng';
import { Firecrawl } from '../content-extraction/firecrawl';
import { type AgentResult, type ResearchProgress, type ResearchResult, type ScrapedContent, type SearxResult, WebsiteStatus } from './types';
import { encode } from 'gpt-tokenizer';
import { ResearchDB } from './db';
import { WebSocketManager } from './websocket';
import type { DBSchema } from './db';

// Define types for MVP
interface SerpQuery {
  query: string;
  objective: string;
  query_timestamp: number;
  depth_level: number;
  parent_query_timestamp: number;
  successful_scraped_websites: Array<{
    id: number;
    url: string;
    title: string;
    description: string;
    status: 'scraping' | 'analyzing' | 'analyzed';
    relevance_score: number;
    is_objective_met: boolean;
    core_content: string[];
    facts_figures: string[];
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
  relevance_score: number;
  is_objective_met: boolean;
  core_content: string[];
  facts_figures: string[];
}

interface InformationCrunchingResult {
  query_timestamp: number;
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
  depth,
  breadth,
  researchId,
  currentDepth = 1,
  parentQueryTimestamp = 0,
  wsManager,
  signal
}: {
  query_to_find_websites: string;
  depth: number;
  breadth: number;
  researchId: string;
  currentDepth?: number;
  parentQueryTimestamp?: number;
  wsManager?: WebSocketManager;
  signal?: AbortSignal;
}): Promise<ResearchResult> {
  // Input validation
  if (!query_to_find_websites?.trim()) throw new Error('Query is required');
  if (breadth < 1 || depth < 1) throw new Error('Invalid depth or breadth');

  // Initialize agents and database
  const searxng = new SearxNG();
  const firecrawl = new Firecrawl();
  const websiteAnalyzer = new WebsiteAnalyzer();
  const db = await ResearchDB.getInstance();

  let failedUrls: string[] = [];

  try {
    // Get fresh DB data right before generating queries
    const freshDbData = await db.getResearchData(researchId);
    if (!freshDbData) {
      throw new Error('Research data not found');
    }

    // Generate queries with fresh DB data
    const queries = await generateQueriesWithObjectives(
      freshDbData,
      currentDepth,
      Math.ceil(breadth / (currentDepth > 1 ? 2 : 1)), // Reduce breadth for child queries
      currentDepth > 1 ? parentQueryTimestamp : undefined // Only pass timestamp for depth > 1
    );
    console.log(`[Depth ${currentDepth}] Generated ${queries.length} queries`);

    // Create a promise for each query that includes its children
    const queryPromises = queries.map(async (query) => {
      console.log(`[Depth ${currentDepth}] Processing query: "${query.query}"`);

      const serpQuery: SerpQuery = {
        query: query.query,
        objective: query.objective,
        query_timestamp: Date.now(),
        depth_level: currentDepth,
        parent_query_timestamp: parentQueryTimestamp,
        successful_scraped_websites: [],
        failedWebsites: []
      };

      await db.addSerpQuery(researchId, serpQuery);
      if (wsManager) {
        await wsManager.handleNewSerpQuery(researchId);
      }

      // Process websites for this query
      await processWebsites(serpQuery, currentDepth, {
        searxng,
        firecrawl,
        websiteAnalyzer,
        db,
        researchId,
        wsManager
      });

      // If this query has results and we need to go deeper, process its children immediately
      if (currentDepth < depth && serpQuery.successful_scraped_websites.some(w => w.status === 'analyzed')) {
        // Get fresh DB data for child queries
        const freshChildDbData = await db.getResearchData(researchId);
        if (!freshChildDbData) {
          throw new Error('Research data not found for child queries');
        }

        // Generate and process child queries
        const childQueries = await generateQueriesWithObjectives(
          freshChildDbData,
          currentDepth + 1,
          Math.ceil(breadth / 2),
          serpQuery.query_timestamp // This is the parent timestamp for child queries
        );
        console.log(`[Depth ${currentDepth}] Generated ${childQueries.length} child queries for "${query.query}"`);

        // Process all child queries in parallel
        const childPromises = childQueries.map(childQuery => {
          console.log(`[Depth ${currentDepth}] Starting child query: "${childQuery.query}"`);
          return deepResearch({
            query_to_find_websites: childQuery.query,
            breadth: Math.ceil(breadth / 2),
            depth,
            researchId,
            currentDepth: currentDepth + 1,
            parentQueryTimestamp: serpQuery.query_timestamp,
            wsManager
          });
        });

        // Each child query processes independently
        const childResponses = await Promise.all(childPromises);
        childResponses.forEach(response => {
          failedUrls.push(...response.failedUrls);
        });
      }

      return {
        failed: failedUrls
      };
    });

    // Let each query process independently
    const allQueryResults = await Promise.all(queryPromises);

    // Combine failed URLs
    allQueryResults.forEach(result => {
      failedUrls.push(...result.failed);
    });

    return {
      failedUrls: [...new Set(failedUrls)]
    };
  } catch (error) {
    console.error(`[Depth ${currentDepth}] Error in deepResearch:`, error);
    throw error;
  }
}

// Add this helper function to process websites
async function processWebsites(
  serpQuery: SerpQuery,
  currentDepth: number,
  {
    searxng,
    firecrawl,
    websiteAnalyzer,
    db,
    researchId,
    wsManager
  }: {
    searxng: SearxNG;
    firecrawl: Firecrawl;
    websiteAnalyzer: WebsiteAnalyzer;
    db: ResearchDB;
    researchId: string;
    wsManager?: WebSocketManager;
  }
): Promise<void> {
  // Get search results
  const searchResults = await searxng.search(serpQuery.query);
  const limitedResults = searchResults.slice(0, MAX_RESULTS_PER_QUERY);
  console.log(`[Depth ${currentDepth}] Found ${searchResults.length} results, using ${limitedResults.length} for query "${serpQuery.query}"`);

  // Initialize website objects with IDs
  serpQuery.successful_scraped_websites = limitedResults.map((result: SearxResult, index: number) => ({
    id: index + 1,
    url: result.url,
    title: result.title || result.url,
    description: result.content || '',
    status: 'scraping',
    relevance_score: 0,
    is_objective_met: false,
    core_content: [],
    facts_figures: []
  }));

  // Save initial website objects and emit event
  await db.updateSerpQueryResults(researchId, serpQuery.query_timestamp, serpQuery.successful_scraped_websites, serpQuery.failedWebsites);
  if (wsManager) {
    await wsManager.handleGotWebsitesFromSerpQuery(researchId);
  }

  // Scrape websites
  console.log(`[Depth ${currentDepth}] Scraping ${limitedResults.length} URLs for query "${serpQuery.query}"`);
  for (const website of serpQuery.successful_scraped_websites) {
    if (wsManager) {
      await wsManager.handleWebsiteScraping(researchId, website);
    }
  }
  const scrapedContents = await firecrawl.scrapeWebsites(limitedResults.map(r => r.url));
  console.log(`[Depth ${currentDepth}] Successfully scraped ${scrapedContents.length} URLs for query "${serpQuery.query}"`);

  // Handle failed scrapes
  const failedScrapes = limitedResults
    .filter(r => !scrapedContents.some(sc => sc.url === r.url))
    .map(r => ({
      website: r.url,
      stage: 'scraping' as const
    }));

  if (failedScrapes.length > 0) {
    console.log(`[Depth ${currentDepth}] Failed to scrape ${failedScrapes.length} URLs for query "${serpQuery.query}":`, failedScrapes.map(f => f.website));
  }

  // Remove failed websites and update DB
  serpQuery.successful_scraped_websites = serpQuery.successful_scraped_websites
    .filter(w => !failedScrapes.some(f => f.website === w.url));
  serpQuery.failedWebsites = failedScrapes;
  await db.updateSerpQueryResults(researchId, serpQuery.query_timestamp, serpQuery.successful_scraped_websites, serpQuery.failedWebsites);

  // Process successful scrapes
  const cruncher = new InformationCruncher(serpQuery.objective);
  let successfulAnalyses = 0;

  // Analyze websites
  for (const content of scrapedContents) {
    try {
      const website = serpQuery.successful_scraped_websites.find(w => w.url === content.url);
      if (!website || !('id' in website)) continue;

      // Update status to analyzing and notify
      website.status = 'analyzing';
      await db.updateSerpQueryResults(researchId, serpQuery.query_timestamp, serpQuery.successful_scraped_websites, serpQuery.failedWebsites);
      if (wsManager) {
        await wsManager.handleWebsiteAnalyzing(researchId, website);
      }

      console.log(`[Depth ${currentDepth}] Analyzing website: ${content.url}`);
      const website_analysis = await websiteAnalyzer.analyzeContent({
        url: content.url,
        markdown: content.markdown
      }, serpQuery.objective);

      if (website_analysis?.is_objective_met) {
        successfulAnalyses++;
        website.status = 'analyzed';
        website.relevance_score = website_analysis.relevance_score;
        website.is_objective_met = website_analysis.is_objective_met;
        website.core_content = website_analysis.core_content;
        website.facts_figures = website_analysis.facts_figures;

        await db.updateSerpQueryResults(researchId, serpQuery.query_timestamp, serpQuery.successful_scraped_websites, serpQuery.failedWebsites);
        if (wsManager) {
          await wsManager.handleWebsiteAnalyzed(researchId, website);
        }
      }
    } catch (error) {
      console.error(`[Depth ${currentDepth}] Failed to analyze ${content.url}:`, error);
      const failedWebsite = serpQuery.successful_scraped_websites.find(w => w.url === content.url);
      if (failedWebsite) {
        serpQuery.successful_scraped_websites = serpQuery.successful_scraped_websites.filter(w => w.url !== content.url);
        serpQuery.failedWebsites.push({
          website: content.url,
          stage: 'analyzing'
        });
        await db.updateSerpQueryResults(researchId, serpQuery.query_timestamp, serpQuery.successful_scraped_websites, serpQuery.failedWebsites);
      }
      continue;
    }
  }

  console.log(`[Depth ${currentDepth}] Successfully analyzed ${successfulAnalyses} websites for query "${serpQuery.query}"`);
}

// Do not remove this comment at any cost. Below is the requirement for this current file.
// Reanalyze current solution that you proposed through analyzing @server.ts and @deep-research.ts, And tell me if I implement your above suggestion then will it parallelize every query and then go deeper on each of these query and then parallelize the child query infinitely if it has to go to infinite depth?

// Um yeah so in a minimal viable product way without doing too many unwanted changes and without without introducing a lot of points for error with your above implementation can be 100 percent make sure that our queries run parallely and after the after all queries get generated right after all queries get run and in massive parallelized state and after the all queries they are done executing then we generate the report so is this flow 100 percent being satisfied with your above implementation re analyze it again again ok and if it works then we will have to implement it if it does not then we will have to see for what what is the problem and do some other changes make sure that we don't want to make it unwantedly complex we just want to make it easy simple and does the does the core work done and that's it.

// Is your current suggestion handles there for each of the parallelized query differently that is what we need to do if the thing is parallelized then the depth doesn't work as like similarly for each of these parallelized query every parallelized query will complete its its response differently and so when it completes is its response then we increase its depth so if you see from the time perspective then the theft will not happen altogether but it will happen when it will happen right away it gets finished and when the queries are in parallel then you cannot guarantee the time so you need to handle that do you think your current implementation handle this in a minimal product way remember we want to go for minimal simple but actually guess the job done gets the core 100% done that is what we want ok.

// Reanalyze this one last time if you see this works pefectly then we are implementing this ok if not then we need to discuss.

// If everything is working perfectly and is simple and minimal then let's implement it rightaway ok?

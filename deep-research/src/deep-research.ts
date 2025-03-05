import { generateQueriesWithObjectives } from './agent/query-generator';
import { WebsiteAnalyzer } from './agent/website-analyzer';
import { SearxNG } from '../content-extraction/searxng';
import { Firecrawl } from '../content-extraction/firecrawl';
import { type ResearchResult, type SearxResult } from './types';
import { ResearchDB } from './db';
import { WebSocketManager } from './websocket';

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



const MAX_RESULTS_PER_QUERY = 3; // Maximum number of results to process per query for MVP

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
      breadth,
      currentDepth > 1 ? parentQueryTimestamp : undefined
    );
    console.log(`[Depth ${currentDepth}] Generated ${queries.length} queries`);

    // Create all serp queries
    const serpQueries = queries.map(query => ({
      query: query.query,
      objective: query.objective,
      query_timestamp: Date.now(),
      depth_level: currentDepth,
      parent_query_timestamp: parentQueryTimestamp,
      successful_scraped_websites: [],
      failedWebsites: []
    }));

    // Add all queries to DB and notify in parallel
    await Promise.all([
      ...serpQueries.map(serpQuery => db.addSerpQuery(researchId, serpQuery)),
      ...(wsManager ? serpQueries.map(() => wsManager.handleNewSerpQuery(researchId)) : [])
    ]);

    // Create a promise for each query's completion
    const queryPromises = serpQueries.map(async (serpQuery) => {
      try {
        console.log(`[Depth ${currentDepth}] Processing query: "${serpQuery.query}"`);

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
        if (currentDepth < depth && (serpQuery.successful_scraped_websites as ScrapedWebsite[]).some(w => w.status === 'analyzed')) {
          // Get fresh DB data for child queries
          const freshChildDbData = await db.getResearchData(researchId);
          if (!freshChildDbData) {
            throw new Error('Research data not found for child queries');
          }

          // Generate child queries
          const childQueries = await generateQueriesWithObjectives(
            freshChildDbData,
            currentDepth + 1,
            Math.ceil(breadth / 2),
            serpQuery.query_timestamp
          );
          console.log(`[Depth ${currentDepth}] Generated ${childQueries.length} child queries for "${serpQuery.query}"`);

          // Process all child queries in parallel and wait for them
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

          // Wait for all child queries to complete
          const childResults = await Promise.all(childPromises);
          childResults.forEach(result => {
            failedUrls.push(...result.failedUrls);
          });
        }
      } catch (error) {
        console.error(`[Depth ${currentDepth}] Error processing query "${serpQuery.query}":`, error);
        failedUrls.push(serpQuery.query);
      }
    });

    // Wait for all queries at this depth to complete
    await Promise.all(queryPromises);

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
  // Start search immediately and let it run in parallel
  const searchPromise = searxng.search(serpQuery.query);

  // Initialize empty website objects immediately
  serpQuery.successful_scraped_websites = [];
  serpQuery.failedWebsites = [];

  // Get search results
  const searchResults = await searchPromise;
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

  // Start scraping immediately
  const scrapePromise = firecrawl.scrapeWebsites(limitedResults.map(r => r.url));

  // First update DB
  await db.updateSerpQueryResults(researchId, serpQuery.query_timestamp, serpQuery.successful_scraped_websites, serpQuery.failedWebsites);

  // Then send WebSocket notifications
  if (wsManager) {
    await wsManager.handleGotWebsitesFromSerpQuery(researchId);
    await Promise.all(serpQuery.successful_scraped_websites.map(website =>
      wsManager.handleWebsiteScraping(researchId, website)
    ));
  }

  // Get scrape results
  const scrapedContents = await scrapePromise;
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

  // Process successful scrapes in parallel
  const analysisPromises = scrapedContents.map(async (content) => {
    try {
      const website = serpQuery.successful_scraped_websites.find(w => w.url === content.url);
      if (!website || !('id' in website)) return;

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
    }
  });

  // Wait for all analyses to complete
  await Promise.all(analysisPromises);
}

// Do not remove this comment at any cost. Below is the requirement for this current file.
// Reanalyze current solution that you proposed through analyzing @server.ts and @deep-research.ts, And tell me if I implement your above suggestion then will it parallelize every query and then go deeper on each of these query and then parallelize the child query infinitely if it has to go to infinite depth?

// Um yeah so in a minimal viable product way without doing too many unwanted changes and without without introducing a lot of points for error with your above implementation can be 100 percent make sure that our queries run parallely and after the after all queries get generated right after all queries get run and in massive parallelized state and after the all queries they are done executing then we generate the report so is this flow 100 percent being satisfied with your above implementation re analyze it again again ok and if it works then we will have to implement it if it does not then we will have to see for what what is the problem and do some other changes make sure that we don't want to make it unwantedly complex we just want to make it easy simple and does the does the core work done and that's it.

// Is your current suggestion handles there for each of the parallelized query differently that is what we need to do if the thing is parallelized then the depth doesn't work as like similarly for each of these parallelized query every parallelized query will complete its its response differently and so when it completes is its response then we increase its depth so if you see from the time perspective then the theft will not happen altogether but it will happen when it will happen right away it gets finished and when the queries are in parallel then you cannot guarantee the time so you need to handle that do you think your current implementation handle this in a minimal product way remember we want to go for minimal simple but actually guess the job done gets the core 100% done that is what we want ok.

// Reanalyze this one last time if you see this works pefectly then we are implementing this ok if not then we need to discuss.

// If everything is working perfectly and is simple and minimal then let's implement it rightaway ok?

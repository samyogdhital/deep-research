import { generateQueriesWithObjectives, QueryWithObjective } from './agent/query-generator';
import { WebsiteAnalysis, WebsiteAnalyzer } from './agent/website-analyzer';
import { SerpQueryAnalyzer } from './agent/serp-query-analyzer';
import { SearxNG } from '../content-extraction/searxng';
import { Firecrawl } from '../content-extraction/firecrawl';
import { DBSchema, ResearchDB } from './db/db';
import { WebSocketManager } from './websocket';
import { ScrapedWebsite, SerpQuery } from './db/schema';

async function deepResearch(researchId: string, is_deep_research: boolean, wsManager: WebSocketManager) {
  // Since everything is already in the database we don't even have to pass anything as parameter beside researchId when called inside @server.ts file.

  // Step 1. Let's get all the value from database.
  const db = await ResearchDB.getInstance();
  const researchData = await db.getResearchData(researchId);
  if (!researchData) throw new Error('Research data not found');

  const depth = researchData.depth;
  const breadth = researchData.breadth;

  // Step 2. generate initial top level serp queries.
  const initialSerpQueries = await generateQueriesWithObjectives(researchData, 1, breadth, 0);

  // Step 2.1 Save to databse and websocket event to notify frontend of new queries
  for (const query of initialSerpQueries) {
    const serpQuery: SerpQuery = {
      ...query,
      depth_level: 1,
      successful_scraped_websites: [],
      failedWebsites: [],
      parent_query_timestamp: 0
    };
    await db.addSerpQuery(researchId, serpQuery);
    await wsManager.handleNewSerpQuery(researchId);
  }

  // Step 4. Initialize searxng, firecrawl and websiteAnalyzer.
  const searxng = new SearxNG();
  const firecrawl = new Firecrawl();
  const websiteAnalyzer = new WebsiteAnalyzer();
  const serpQueryAnalyzer = new SerpQueryAnalyzer();

  // Process each query in parallel using native promises
  const processPromises = initialSerpQueries.map((serpQuery) =>
    (async (): Promise<WebsiteAnalysis[]> => {
      const processQueryAtDepth = async (serpQuery: QueryWithObjective, currentDepth: number, parentBreadth: number): Promise<WebsiteAnalysis[]> => {
        try {
          // Step 1. SearxNG this query.
          const searchResults: DBSchema['researches'][number]['serpQueries'][number]['successful_scraped_websites'] = (await searxng.search(serpQuery.query)).map((result, index) => ({
            id: index + 1,
            url: result.url,
            title: result.title || result.url,
            description: result.content || '',
            status: 'scraping',
            relevance_score: 0,
            is_objective_met: false,
            core_content: [],
            facts_figures: [],
          }));

          // Step 1.1. Save to database and notify frontend.
          await db.updateSerpQueryResults(researchId, serpQuery.query_timestamp, searchResults as ScrapedWebsite[], []);
          if (wsManager) await wsManager.handleGotWebsitesFromSerpQuery(researchId);
          await Promise.all(searchResults.map(website =>
            wsManager.handleWebsiteScraping(researchId, website)
          ));

          // Step 2. Scrape all the websites.
          const scrapedContents = await firecrawl.scrapeWebsites(searchResults.map(r => r.url));

          // Step 2.1: Update database with scraping results
          const failedScrapes = searchResults
            .filter(w => !scrapedContents.some(sc => sc.url === w.url))
            .map(w => ({ website: w.url, stage: 'failed' as const }));

          const successfulWebsites = searchResults.filter(w => scrapedContents.some(sc => sc.url === w.url));

          let analysisResults: WebsiteAnalysis[] = [];

          if (is_deep_research) {
            // Deep research mode: Analyze each website individually
            const analysisPromises = scrapedContents.map(async ({ url, markdown }) => {
              const website = successfulWebsites.find(w => w.url === url);
              if (!website) return null;

              // Set status to analyzing before individual analysis
              await db.updateWebsiteStatus(researchId, serpQuery.query_timestamp, url, {
                status: 'analyzing'
              });
              await wsManager.handleWebsiteAnalyzing(researchId, website);

              const websiteAnalysis = await websiteAnalyzer.analyzeContent(
                { url, markdown },
                serpQuery.objective
              );

              if (websiteAnalysis) {
                await db.updateWebsiteStatus(researchId, serpQuery.query_timestamp, url, {
                  status: 'analyzed',
                  relevance_score: websiteAnalysis.relevance_score,
                  is_objective_met: websiteAnalysis.is_objective_met,
                  core_content: websiteAnalysis.core_content,
                  facts_figures: websiteAnalysis.facts_figures
                });
                await wsManager.handleWebsiteAnalyzed(researchId, website);
                return websiteAnalysis;
              } else {
                await db.updateWebsiteStatus(researchId, serpQuery.query_timestamp, url, {
                  status: 'failed'
                });
                failedScrapes.push({ website: url, stage: 'failed' });
                await db.updateSerpQueryResults(researchId, serpQuery.query_timestamp, successfulWebsites.filter(w => w.url !== url), failedScrapes);
                return null;
              }
            });

            analysisResults = (await Promise.all(analysisPromises)).filter((analysis): analysis is WebsiteAnalysis => analysis !== null);
          } else {
            // Regular mode: Analyze all websites at once using serp-query-analyzer
            // Step 1: Update all websites to analyzing status in one database operation
            const websitesWithAnalyzingStatus = successfulWebsites.map(website => ({
              ...website,
              status: 'analyzing' as const
            }));
            await db.updateSerpQueryResults(researchId, serpQuery.query_timestamp, websitesWithAnalyzingStatus, failedScrapes);

            // Send individual websocket events for each website going to analyzing state
            await Promise.all(websitesWithAnalyzingStatus.map(website =>
              wsManager.handleWebsiteAnalyzing(researchId, website)
            ));

            // Step 2: Fire event for SERP analysis start
            await wsManager.handleAnalyzingSerpQuery(researchId);

            // Step 3: Perform SERP analysis
            const serpAnalysis = await serpQueryAnalyzer.analyzeSerpQuery({
              contents: scrapedContents,
              query: serpQuery.query,
              objective: serpQuery.objective,
              query_timestamp: serpQuery.query_timestamp,
              depth_level: currentDepth,
              parent_query_timestamp: serpQuery.parent_query_timestamp,
              failedWebsites: failedScrapes
            });

            // Step 4: Update database with analyzed results (status will be 'analyzed')
            const analyzedWebsites = serpAnalysis.successful_scraped_websites.map(website => ({
              ...website,
              status: 'analyzed' as const
            }));
            await db.updateSerpQueryResults(researchId, serpQuery.query_timestamp, analyzedWebsites, serpAnalysis.failedWebsites);

            // Send individual websocket events for each analyzed website
            await Promise.all(analyzedWebsites.map(website =>
              wsManager.handleWebsiteAnalyzed(researchId, website)
            ));

            // Step 5: Fire event for SERP analysis completion
            await wsManager.handleAnalyzedSerpQuery(researchId);

            analysisResults = serpAnalysis.successful_scraped_websites.map(website => ({
              websiteUrl: website.url,
              relevance_score: website.relevance_score,
              is_objective_met: website.is_objective_met,
              core_content: website.core_content,
              facts_figures: website.facts_figures
            }));
          }

          // Step 4: Generate and process child queries if not at max depth
          if (currentDepth < depth) {
            const current_depth_breadth_query = currentDepth === 1 ? breadth : Math.ceil(parentBreadth / 2);
            const childQueries = await generateQueriesWithObjectives(
              researchData,
              currentDepth + 1,
              current_depth_breadth_query,
              serpQuery.query_timestamp
            );

            const childPromises = childQueries.map(async (childQuery) => {
              const childSerpQuery: SerpQuery = {
                ...childQuery,
                depth_level: currentDepth + 1,
                successful_scraped_websites: [],
                failedWebsites: [],
                parent_query_timestamp: serpQuery.query_timestamp
              };
              await db.addSerpQuery(researchId, childSerpQuery);
              await wsManager.handleNewSerpQuery(researchId);

              return processQueryAtDepth(childQuery as QueryWithObjective, currentDepth + 1, current_depth_breadth_query);
            });

            const childResults = await Promise.all(childPromises);
            return [...analysisResults, ...childResults.flat()];
          }

          return analysisResults;
        } catch (error) {
          console.error(`Error processing query "${serpQuery.query}":`, error);
          return [];
        }
      };

      return processQueryAtDepth(serpQuery, 1, breadth);
    })()
  );

  const result = (await Promise.all(processPromises)).flat() as WebsiteAnalysis[];
  return result;
}

export { deepResearch }

// Do not remove this comment at any cost. Below is the requirement for this current file.
// Reanalyze current solution that you proposed through analyzing @server.ts and @deep-research.ts, And tell me if I implement your above suggestion then will it parallelize every query and then go deeper on each of these query and then parallelize the child query infinitely if it has to go to infinite depth?

// Um yeah so in a minimal viable product way without doing too many unwanted changes and without without introducing a lot of points for error with your above implementation can be 100 percent make sure that our queries run parallely and after the after all queries get generated right after all queries get run and in massive parallelized state and after the all queries they are done executing then we generate the report so is this flow 100 percent being satisfied with your above implementation re analyze it again again ok and if it works then we will have to implement it if it does not then we will have to see for what what is the problem and do some other changes make sure that we don't want to make it unwantedly complex we just want to make it easy simple and does the does the core work done and that's it.

// Is your current suggestion handles there for each of the parallelized query differently that is what we need to do if the thing is parallelized then the depth doesn't work as like similarly for each of these parallelized query every parallelized query will complete its its response differently and so when it completes is its response then we increase its depth so if you see from the time perspective then the theft will not happen altogether but it will happen when it will happen right away it gets finished and when the queries are in parallel then you cannot guarantee the time so you need to handle that do you think your current implementation handle this in a minimal product way remember we want to go for minimal simple but actually guess the job done gets the core 100% done that is what we want ok.

// Reanalyze this one last time if you see this works pefectly then we are implementing this ok if not then we need to discuss.

// If everything is working perfectly and is simple and minimal then let's implement it rightaway ok?

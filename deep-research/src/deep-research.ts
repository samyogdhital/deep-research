import { QueryWithObjectives } from './agent/query-generator';
import { WebsiteAnalyzer } from './agent/website-analyzer';
import { SerpQueryAnalyzer } from './agent/serp-query-analyzer';
import { SearxNG } from '../content-extraction/searxng';
import { Firecrawl } from '../content-extraction/firecrawl';
import { WebSocketManager } from './websocket';
import { ScrapedWebsite, SerpQuery } from './db/schema';
import { getLatestResearchFromDB } from '@utils/db-utils';

async function deepResearch(researchId: string, is_deep_research: boolean, wsManager: WebSocketManager) {
  const { researchData, db } = await getLatestResearchFromDB(researchId);
  if (!researchData) throw new Error('Research data not found');

  const depth = researchData.depth;
  const breadth = researchData.breadth;

  // Initialize tools
  const searxng = new SearxNG(wsManager);
  const firecrawl = new Firecrawl(wsManager);
  const queryWithObjectives = new QueryWithObjectives(wsManager);
  const websiteAnalyzer = new WebsiteAnalyzer(wsManager);
  const serpQueryAnalyzer = new SerpQueryAnalyzer(wsManager);

  // Track all running query promises to ensure we wait for all of them
  const runningQueries: Promise<void>[] = [];

  // Process each query - Define this function before using it
  const processQuery = async (currentQuery: SerpQuery): Promise<void> => {
    console.log("inside process query")

    try {
      // Step 1: Search the query for getting the websites list.
      const searxngWebsitesList = await searxng.search({ query: currentQuery.query, researchId, queryTimestamp: currentQuery.query_timestamp, parentQueryTimestamp: currentQuery.parent_query_timestamp })

      const transformedSearchResult = searxngWebsitesList.map((result, index) => ({
        id: index + 1,
        url: result.url,
        title: result.title || result.url,
        description: result.content || '',
        status: 'scraping' as const,
        relevance_score: 0,
        is_objective_met: false,
        core_content: [],
        facts_figures: [],
      })) as ScrapedWebsite[];

      // These will be in deep research file.
      await db.updateSerpQueryResults({
        report_id: researchId,
        queryTimestamp: currentQuery.query_timestamp,
        parentQueryTimestamp: currentQuery.parent_query_timestamp,
        successfulWebsites: transformedSearchResult,
        // serpQueryStage: 'in-progress' // you don't need to give it here. We have already set that in the searxng.ts file.
      });
      await wsManager.handleSerpQueryToInProgess(researchId);
      //--------------------------------


      const { researchData: updatedDataFromDB } = await getLatestResearchFromDB(researchId);
      const latestCurrentQuery = updatedDataFromDB.serpQueries.find(q => q.query_timestamp === currentQuery.query_timestamp) as SerpQuery;
      if (!latestCurrentQuery) throw new Error('Query not found after update');
      currentQuery = latestCurrentQuery; // I think we are setting latest data on the current query. If somewhere we are referencing it, it will be updated.
      await wsManager.handleAnalyzingSerpQuery(researchId); //Serp query is analyzing now.

      const websitesToProcess = currentQuery.successful_scraped_websites.filter(w =>
        w.status !== 'analyzed'
      );

      const websitesToScrape = websitesToProcess.map(w => ({ url: w.url, id: w.id }));
      const scrapedContents = await firecrawl.scrapeWebsites({ researchId, queryTimestamp: currentQuery.query_timestamp, websites: websitesToScrape, is_deep_research, objective: currentQuery.objective, websiteAnalyzer });

      // Now branch into mode-specific processing
      if (is_deep_research) {
        const { researchData: updatedDataFromDB } = await getLatestResearchFromDB(researchId);
        const latestCurrentQuery = updatedDataFromDB.serpQueries.find(q => q.query_timestamp === currentQuery.query_timestamp) as SerpQuery;
        if (!latestCurrentQuery) throw new Error('Query not found after update');
        currentQuery = latestCurrentQuery; // I think we are setting latest data on the current query. If somewhere we are referencing it, it will be updated.

        const analyzedWebsites = currentQuery.successful_scraped_websites.filter(w => w.status === 'analyzed');
        // Instead of throwing an error when no websites are analyzed, we'll log a warning and continue
        if (analyzedWebsites.length === 0) {
          console.log(`⚠️ Warning: No websites were successfully analyzed for query: "${currentQuery.query}"`);
        }

        // Finally changing this serp query status to completed.
        await db.updateSerpQueryResults({
          report_id: researchId,
          queryTimestamp: currentQuery.query_timestamp,
          parentQueryTimestamp: currentQuery.parent_query_timestamp,
          successfulWebsites: currentQuery.successful_scraped_websites, // Use all websites, not just analyzed ones
          serpQueryStage: 'completed'
        });
        await wsManager.handleAnalyzedSerpQuery(researchId);

      } else {
        const websiteContents = scrapedContents.map(content => ({
          url: content.url,
          markdown: content.markdown
        }));

        await serpQueryAnalyzer.analyzeSerpQuery({
          researchId: researchId,
          contents: websiteContents,
          query: currentQuery.query,
          objective: currentQuery.objective,
          query_timestamp: currentQuery.query_timestamp,
          depth_level: currentQuery.depth_level,
          parent_query_timestamp: currentQuery.parent_query_timestamp,
          stage: 'completed',
        });


      }

      // Generate and process child queries if not at max depth
      if (currentQuery.depth_level < depth) {
        const childQueries = await queryWithObjectives.generateQueriesWithObjectives(
          researchId,
          currentQuery.query_timestamp
        );

        // Process child queries in parallel and track them
        const childPromises = childQueries.map(async (q) => {
          const childPromise = processQuery(q);
          runningQueries.push(childPromise);
          return childPromise;
        });

        await Promise.all(childPromises);
      }

    } catch (error) {
      const failedQuery = {
        ...currentQuery,
        stage: 'failed' as const
      };
      await db.updateSerpQueryResults({
        report_id: researchId,
        queryTimestamp: currentQuery.query_timestamp,
        parentQueryTimestamp: currentQuery.parent_query_timestamp,
        successfulWebsites: failedQuery.successful_scraped_websites,
        serpQueryStage: 'failed'
      });
      await wsManager.handleSerpQueryFailed(researchId);
    }
  };

  // Generate top-level queries (depth 1)
  const newQueries = await queryWithObjectives.generateQueriesWithObjectives(
    researchId,
    0  // parent_query_timestamp of 0 indicates top-level queries
  );

  // Process top-level queries in parallel and track them
  const topLevelPromises = newQueries.map(async (query) => {
    const queryPromise = processQuery(query);
    runningQueries.push(queryPromise);
    return queryPromise;
  });

  // Wait for top-level queries to complete
  await Promise.all(topLevelPromises);

  // Wait for all running queries to complete (including child queries)
  await Promise.all(runningQueries);

  console.log("All queries at all depths have completed. Research process is finished.");
}

export { deepResearch }

// Do not remove this comment at any cost. Below is the requirement for this current file.
// Reanalyze current solution that you proposed through analyzing @server.ts and @deep-research.ts, And tell me if I implement your above suggestion then will it parallelize every query and then go deeper on each of these query and then parallelize the child query infinitely if it has to go to infinite depth?

// Um yeah so in a minimal viable product way without doing too many unwanted changes and without without introducing a lot of points for error with your above implementation can be 100 percent make sure that our queries run parallely and after the after all queries get generated right after all queries get run and in massive parallelized state and after the all queries they are done executing then we generate the report so is this flow 100 percent being satisfied with your above implementation re analyze it again again ok and if it works then we will have to implement it if it does not then we will have to see for what what is the problem and do some other changes make sure that we don't want to make it unwantedly complex we just want to make it easy simple and does the does the core work done and that's it.

// Is your current suggestion handles there for each of the parallelized query differently that is what we need to do if the thing is parallelized then the depth doesn't work as like similarly for each of these parallelized query every parallelized query will complete its its response differently and so when it completes is its response then we increase its depth so if you see from the time perspective then the theft will not happen altogether but it will happen when it will happen right away it gets finished and when the queries are in parallel then you cannot guarantee the time so you need to handle that do you think your current implementation handle this in a minimal product way remember we want to go for minimal simple but actually guess the job done gets the core 100% done that is what we want ok.

// Reanalyze this one last time if you see this works pefectly then we are implementing this ok if not then we need to discuss.

// If everything is working perfectly and is simple and minimal then let's implement it rightaway ok?

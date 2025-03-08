import { generateQueriesWithObjectives, QueryWithObjective } from './agent/query-generator';
import { WebsiteAnalysis, WebsiteAnalyzer } from './agent/website-analyzer';
import { SearxNG } from '../content-extraction/searxng';
import { Firecrawl } from '../content-extraction/firecrawl';
import { DBSchema, ResearchDB } from './db';
import { WebSocketManager } from './websocket';
import PQueue from 'p-queue';
import { ScrapedWebsite, SerpQuery } from './db/schema';




async function deepResearch(researchId: string, wsManager: WebSocketManager) {
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
          if (wsManager) await wsManager.handleGotWebsitesFromSerpQuery(researchId); await Promise.all(searchResults.map(website =>
            wsManager.handleWebsiteScraping(researchId, website) // Notify scraping start
          ));


          // Step 2. Scrape all the websites.
          const scrapedContents = await firecrawl.scrapeWebsites(searchResults.map(r => r.url));


          // Step 2.1: Update database with scraping results
          // First, identify which websites failed to scrape by checking which URLs from searchResults
          // don't appear in scrapedContents. Mark these as failed scrapes.
          const failedScrapes: DBSchema['researches'][number]['serpQueries'][number]['failedWebsites'] = searchResults
            .filter(w => !scrapedContents.some(sc => sc.url === w.url))
            .map(w => ({ website: w.url, stage: 'failed' }));

          // Then, identify which websites were successfully scraped by finding URLs that exist
          // in both searchResults and scrapedContents
          const successfulWebsites = searchResults.filter(w => scrapedContents.some(sc => sc.url === w.url));

          // For the successful websites, update their status to 'analyzing' since they'll be 
          // analyzed in the next step. We use 'as const' to ensure type safety.
          const updatedSuccessfulWebsites = successfulWebsites.map(w => ({
            ...w,
            status: 'analyzing' as const
          }));

          // Finally, update the database with both the successful websites (now marked for analysis)
          // and the failed scrapes
          await db.updateSerpQueryResults(researchId, serpQuery.query_timestamp, updatedSuccessfulWebsites, failedScrapes);


          // Step 3. Analyze the websites.
          const analysisPromises = scrapedContents.map(async ({ url, markdown }) => {
            const website = successfulWebsites.find(w => w.url === url);
            if (!website) return null;

            // Update the status of the website to 'analyzing'
            await db.updateWebsiteStatus(researchId, serpQuery.query_timestamp, url, {
              status: 'analyzing'
            });
            await wsManager.handleWebsiteAnalyzing(researchId, website);

            // Perform analysis on the website through website analyzing agent.
            const websiteAnalysis = await websiteAnalyzer.analyzeContent(
              { url, markdown },
              serpQuery.objective
            );

            if (websiteAnalysis) {
              // Update the website with analysis results
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
              // Mark website as failed
              await db.updateWebsiteStatus(researchId, serpQuery.query_timestamp, url, {
                status: 'failed'
              });
              failedScrapes.push({ website: url, stage: 'failed' });
              await db.updateSerpQueryResults(researchId, serpQuery.query_timestamp, updatedSuccessfulWebsites.filter(w => w.url !== url), failedScrapes);
              return null;
            }
          });

          // Collect results and filter out null values
          const allScrapedContents = (await Promise.all(analysisPromises)).filter(analysis => analysis !== null);

          // Step 4: Generate and process child queries if not at max depth
          if (currentDepth < depth) {

            // Generate child queries based on the current query's findings
            const current_depth_breadth_query = currentDepth === 1 ? breadth : Math.ceil(parentBreadth / 2);
            const childQueries = await generateQueriesWithObjectives(
              researchData,
              currentDepth + 1,
              current_depth_breadth_query,
              serpQuery.query_timestamp // Pass parent query ID or reference
            );

            // Step 4.1: Save child queries to database and notify
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

              // Process each child query immediately after adding it
              const childSearchResults = (await searxng.search(childQuery.query)).map((result, index) => ({
                id: index + 1,
                url: result.url,
                title: result.title || result.url,
                description: result.content || '',
                status: 'scraping' as const,
                relevance_score: 0,
                is_objective_met: false,
                core_content: [],
                facts_figures: [],
              }));

              // Update database and notify frontend for child query results
              await db.updateSerpQueryResults(researchId, childQuery.query_timestamp, childSearchResults as ScrapedWebsite[], []);
              if (wsManager) {
                await wsManager.handleGotWebsitesFromSerpQuery(researchId);
                await Promise.all(childSearchResults.map(website =>
                  wsManager.handleWebsiteScraping(researchId, website)
                ));
              }

              // Now process these websites through scraping and analysis
              const scrapedContents = await firecrawl.scrapeWebsites(childSearchResults.map(r => r.url));

              // Handle failed scrapes
              const failedScrapes = childSearchResults
                .filter(w => !scrapedContents.some(sc => sc.url === w.url))
                .map(w => ({ website: w.url, stage: 'failed' as const }));

              // Handle successful scrapes
              const successfulWebsites = childSearchResults.filter(w =>
                scrapedContents.some(sc => sc.url === w.url)
              );

              // Process analysis
              const analysisPromises = scrapedContents.map(async ({ url, markdown }) => {
                const website = successfulWebsites.find(w => w.url === url);
                if (!website) return null;

                // Update status to analyzing and notify
                await db.updateWebsiteStatus(researchId, childQuery.query_timestamp, url, {
                  status: 'analyzing'
                });
                await wsManager.handleWebsiteAnalyzing(researchId, website);

                const websiteAnalysis = await websiteAnalyzer.analyzeContent(
                  { url, markdown },
                  childQuery.objective
                );

                if (websiteAnalysis) {
                  await db.updateWebsiteStatus(researchId, childQuery.query_timestamp, url, {
                    status: 'analyzed',
                    relevance_score: websiteAnalysis.relevance_score,
                    is_objective_met: websiteAnalysis.is_objective_met,
                    core_content: websiteAnalysis.core_content,
                    facts_figures: websiteAnalysis.facts_figures
                  });
                  await wsManager.handleWebsiteAnalyzed(researchId, website);
                  return websiteAnalysis;
                } else {
                  await db.updateWebsiteStatus(researchId, childQuery.query_timestamp, url, {
                    status: 'failed'
                  });
                  failedScrapes.push({ website: url, stage: 'failed' as const });
                  await db.updateSerpQueryResults(
                    researchId,
                    childQuery.query_timestamp,
                    successfulWebsites.filter(w => w.url !== url),
                    failedScrapes
                  );
                  return null;
                }
              });

              const childAnalyses = (await Promise.all(analysisPromises)).filter((analysis): analysis is WebsiteAnalysis => analysis !== null);

              // Process next depth level if needed
              if (currentDepth + 1 < depth) {
                const nextDepthResults = await processQueryAtDepth(childQuery as QueryWithObjective, currentDepth + 1, current_depth_breadth_query);
                return [...childAnalyses, ...(nextDepthResults || [])];
              }

              return childAnalyses;
            });

            // Wait for all child queries to complete and collect their results
            const childResults = await Promise.all(childPromises);
            const allChildAnalyses = childResults.flat();

            // Combine parent and child results
            return [...allScrapedContents, ...allChildAnalyses];
          }

          return allScrapedContents;
        } catch (error) {
          console.error(`Error processing query "${serpQuery.query}":`, error);
          return []; // Return empty array on failure
        }
      }

      return processQueryAtDepth(serpQuery, 1, breadth);
    })()  // Immediately invoke the async function
  );

  const result = (await Promise.all(processPromises)).flat() as WebsiteAnalysis[];


  return result

}

export { deepResearch }

// Do not remove this comment at any cost. Below is the requirement for this current file.
// Reanalyze current solution that you proposed through analyzing @server.ts and @deep-research.ts, And tell me if I implement your above suggestion then will it parallelize every query and then go deeper on each of these query and then parallelize the child query infinitely if it has to go to infinite depth?

// Um yeah so in a minimal viable product way without doing too many unwanted changes and without without introducing a lot of points for error with your above implementation can be 100 percent make sure that our queries run parallely and after the after all queries get generated right after all queries get run and in massive parallelized state and after the all queries they are done executing then we generate the report so is this flow 100 percent being satisfied with your above implementation re analyze it again again ok and if it works then we will have to implement it if it does not then we will have to see for what what is the problem and do some other changes make sure that we don't want to make it unwantedly complex we just want to make it easy simple and does the does the core work done and that's it.

// Is your current suggestion handles there for each of the parallelized query differently that is what we need to do if the thing is parallelized then the depth doesn't work as like similarly for each of these parallelized query every parallelized query will complete its its response differently and so when it completes is its response then we increase its depth so if you see from the time perspective then the theft will not happen altogether but it will happen when it will happen right away it gets finished and when the queries are in parallel then you cannot guarantee the time so you need to handle that do you think your current implementation handle this in a minimal product way remember we want to go for minimal simple but actually guess the job done gets the core 100% done that is what we want ok.

// Reanalyze this one last time if you see this works pefectly then we are implementing this ok if not then we need to discuss.

// If everything is working perfectly and is simple and minimal then let's implement it rightaway ok?

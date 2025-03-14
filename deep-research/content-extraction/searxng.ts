import { SearxResponse, SearxResult } from '../src/types';
import { WebSocketManager } from '../src/websocket';
import { getLatestResearchFromDB } from '@/utils/db-utils';
export class SearxNG {
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 1000; // 1 second delay between retries

    constructor(private wsManager: WebSocketManager) { }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async attemptSearch(query: string): Promise<SearxResult[]> {
        if (!process.env.SEARXNG_BASE_URL) {
            throw new Error('SEARXNG_BASE_URL not configured');
        }

        const formattedQuery = query.trim();
        const url = `${process.env.SEARXNG_BASE_URL}/search?q=${encodeURIComponent(formattedQuery)}&format=json`;

        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Search failed with status ${response.status}`);
            }

            const text = await response.text();
            const data: SearxResponse = JSON.parse(text);
            const results = data.results || [];

            // Filter out results without URLs and map to SearxResult type
            const validResults = results
                .filter(r => r.url && r.title)
                .map(r => ({
                    url: r.url,
                    title: r.title,
                    content: r.content,
                } as SearxResult));

            return validResults.slice(0, 10);
            // return validResults;
        } catch (error) {
            console.error(`Search attempt failed:`, error);
            throw error;
        }
    }

    async search({ query, researchId, queryTimestamp, parentQueryTimestamp }: { query: string, researchId: string, queryTimestamp: number, parentQueryTimestamp: number }): Promise<SearxResult[]> {

        const { db } = await getLatestResearchFromDB(researchId);


        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                console.log(`Search attempt ${attempt} for query: ${query}`);
                const results = await this.attemptSearch(query);

                // If we got results, return them immediately
                if (results.length > 0) {
                    await db.updateSerpQueryResults({
                        report_id: researchId,
                        queryTimestamp,
                        parentQueryTimestamp,
                        successfulWebsites: [], // empty array cause we have not scraped any websites from firecrawl yet.
                        serpQueryStage: 'in-progress'
                    });

                    // Fire got website from serp query websocket event
                    await this.wsManager.handleGotWebsitesFromSerpQuery(researchId);
                    return results;
                }

                // If no results and not last attempt, wait before retrying
                if (attempt < this.MAX_RETRIES) {
                    console.log(`No results on attempt ${attempt}, retrying in ${this.RETRY_DELAY}ms...`);
                    await this.delay(this.RETRY_DELAY);
                }
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < this.MAX_RETRIES) {
                    console.log(`Search failed on attempt ${attempt}, retrying in ${this.RETRY_DELAY}ms...`);

                    await this.delay(this.RETRY_DELAY);
                }
            }
        }

        // If we get here, all attempts failed
        console.log(`❌❌ Searxng failed after ${this.MAX_RETRIES} attempts: ${lastError?.message || 'No results found'}`);

        await db.updateSerpQueryResults({
            report_id: researchId,
            queryTimestamp,
            parentQueryTimestamp,
            successfulWebsites: [], // empty array cause we have not scraped any websites from firecrawl yet.
            serpQueryStage: 'failed'
        });
        await this.wsManager.handleWebsitesFromSerpQueryFailed(researchId);

        throw new Error(`Search failed after ${this.MAX_RETRIES} attempts: ${lastError?.message || 'No results found'}`);
    }
}
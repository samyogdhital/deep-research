import { OutputManager } from '../src/output-manager';
import { SearxResponse, SearxResult } from '../src/types';


export class SearxNG {
    private output: OutputManager;

    constructor(output: OutputManager) {
        this.output = output;
    }

    private log(...args: any[]) {
        this.output.log(...args);
    }

    async search(query: string): Promise<SearxResult[]> {
        this.log(`Searching for: ${query}`);
        this.log(`Connected with Searxng at: ${process.env.SEARXNG_BASE_URL}`);

        try {
            if (!process.env.SEARXNG_BASE_URL) {
                throw new Error('SEARXNG_BASE_URL not configured');
            }

            const formattedQuery = encodeURIComponent(query.trim());
            const response = await fetch(
                `${process.env.SEARXNG_BASE_URL}/search?q=${formattedQuery}&format=json&language=en&time_range=year&safesearch=0&engines=google,bing,duckduckgo`,
                {
                    method: "GET",
                    headers: {
                        'Accept': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Search failed with status ${response.status}: ${await response.text()}`);
            }

            const data: SearxResponse = await response.json();

            if (!data.results?.length) {
                throw new Error(`No search results found for query: ${query}`);
            }

            this.log(`Search found ${data.results.length} results for query: ${query}`);
            return data.results.slice(0, 7);

        } catch (error) {
            this.log('Error during search:', error);
            throw new Error(`Search failed: ${error.message}`);
        }
    }
}
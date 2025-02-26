import { OutputManager } from '../src/output-manager';
import { SearxResponse, SearxResult } from '../src/types';

export class SearxNG {
    private output: OutputManager;

    constructor(output: OutputManager) {
        this.output = output;
    }

    private log(...args: any[]) {
        console.log('[SearxNG]', ...args);
        this.output.log(...args);
    }

    async search(query: string): Promise<SearxResult[]> {
        console.log(`[SearxNG] Starting search for: ${query}`);

        try {
            if (!process.env.SEARXNG_BASE_URL) {
                console.error('[SearxNG] Missing configuration:', {
                    hasBaseUrl: !!process.env.SEARXNG_BASE_URL
                });
                throw new Error('SEARXNG_BASE_URL not configured');
            }

            const formattedQuery = encodeURIComponent(query.trim());
            const url = `${process.env.SEARXNG_BASE_URL}/search?q=${formattedQuery}&format=json&language=en&time_range=year`;

            console.log(`[SearxNG] Making request:`, {
                url,
                query: formattedQuery
            });

            const response = await fetch(url, {
                method: "GET",
                headers: {
                    'Accept': 'application/json'
                }
            });

            console.log(`[SearxNG] Response status:`, {
                status: response.status,
                ok: response.ok,
                statusText: response.statusText
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[SearxNG] Search failed:`, {
                    status: response.status,
                    error: errorText
                });
                throw new Error(`Search failed with status ${response.status}`);
            }

            const text = await response.text();
            console.log(`[SearxNG] Raw response:`, text.substring(0, 200) + '...');

            const data: SearxResponse = JSON.parse(text);
            const results = data.results || [];

            console.log(`[SearxNG] Search results:`, {
                total: results.length,
                sample: results.slice(0, 2).map(r => ({
                    url: r.url,
                    title: r.title
                }))
            });

            // Filter out results without URLs and map to SearxResult type
            const validResults = results
                .filter(r => r.url && r.title)
                .map(r => ({
                    url: r.url,
                    title: r.title,
                    content: '',  // Will be populated by scraper
                    markdown: ''  // Will be populated by scraper
                } as SearxResult));

            console.log(`[SearxNG] Search complete:`, {
                query,
                totalResults: results.length,
                validResults: validResults.length,
                returnedResults: Math.min(validResults.length, 7)
            });

            return validResults.slice(0, 7);

        } catch (error) {
            console.error(`[SearxNG] Search error:`, error);
            return []; // Return empty array instead of throwing
        }
    }
}
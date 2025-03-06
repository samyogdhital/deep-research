import { SearxResponse, SearxResult } from '../src/types';

export class SearxNG {
    constructor() { }

    async search(query: string): Promise<SearxResult[]> {
        try {
            if (!process.env.SEARXNG_BASE_URL) {
                throw new Error('SEARXNG_BASE_URL not configured');
            }

            const formattedQuery = query.trim();
            const url = `${process.env.SEARXNG_BASE_URL}/search?q=${encodeURIComponent(formattedQuery)}&format=json`;
            // &language=en&time_range=year
            console.log({ url })

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

            return validResults.slice(0, 7);

        } catch (error) {
            console.log(`❌❌ Searxng file throws error: ${error}`)
            return []; // Return empty array instead of throwing
        }
    }
}
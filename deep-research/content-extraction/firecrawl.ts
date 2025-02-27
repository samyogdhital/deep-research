import { FirecrawlResponse, ScrapedContent } from '../src/types';

export class Firecrawl {
    constructor() { }

    async scrapeWebsites(urls: string[]): Promise<ScrapedContent[]> {
        // Validate base URL is configured
        if (!process.env.FIRECRAWL_BASE_URL) {
            throw new Error('FIRECRAWL_BASE_URL not configured');
        }

        // Process URLs sequentially to avoid overwhelming the service
        const results: (ScrapedContent | null)[] = [];
        for (const url of urls) {
            try {
                // Construct request
                const requestBody = {
                    url,
                    formats: ['markdown'],
                    onlyMainContent: true,
                    timeout: 30000,
                    blockAds: true
                };

                const response = await fetch(`${process.env.FIRECRAWL_BASE_URL}/v1/scrape`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    results.push(null);
                    continue;
                }

                // Read and parse response
                const text = await response.text();
                let data: FirecrawlResponse;
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    results.push(null);
                    continue;
                }

                // Validate response structure
                if (!data.success || !data.data?.markdown) {
                    results.push(null);
                    continue;
                }

                const markdown = data.data.markdown.trim();
                if (!markdown) {
                    results.push(null);
                    continue;
                }

                results.push({
                    url,
                    markdown
                });

            } catch (error) {
                results.push(null);
            }
        }

        return results.filter((r): r is ScrapedContent => r !== null);
    }
}
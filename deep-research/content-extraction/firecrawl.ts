import { OutputManager } from '../src/output-manager';
import { FirecrawlResponse, ScrapedContent } from '../src/types';

export class Firecrawl {
    private output: OutputManager;

    constructor(output: OutputManager) {
        this.output = output;
    }

    private log(...args: any[]) {
        console.log('[Firecrawl]', ...args);
        this.output.log(...args);
    }

    async scrapeWebsites(urls: string[]): Promise<ScrapedContent[]> {
        // Validate base URL is configured
        if (!process.env.FIRECRAWL_BASE_URL) {
            console.error('[Firecrawl] Missing configuration:', {
                hasBaseUrl: !!process.env.FIRECRAWL_BASE_URL,
                baseUrl: process.env.FIRECRAWL_BASE_URL
            });
            return [];
        }

        // Process URLs sequentially to avoid overwhelming the service
        const results: (ScrapedContent | null)[] = [];
        for (const url of urls) {
            try {
                console.log(`\n[Firecrawl] Processing URL: ${url}`);

                // Construct request
                const requestBody = {
                    url,
                    formats: ['markdown'],
                    onlyMainContent: true,
                    timeout: 30000,
                    blockAds: true
                };

                console.log(`[Firecrawl] Making request to: ${process.env.FIRECRAWL_BASE_URL}/v1/scrape`);
                console.log('[Firecrawl] Request body:', requestBody);

                const response = await fetch(`${process.env.FIRECRAWL_BASE_URL}/v1/scrape`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                console.log(`[Firecrawl] Response for ${url}:`, {
                    status: response.status,
                    ok: response.ok,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries())
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`[Firecrawl] Failed to scrape ${url}:`, {
                        status: response.status,
                        error: errorText
                    });
                    results.push(null);
                    continue;
                }

                // Read and parse response
                const text = await response.text();
                console.log(`[Firecrawl] Response preview for ${url}:`,
                    text.length > 200 ? text.substring(0, 200) + '...' : text
                );

                let data: FirecrawlResponse;
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    console.error(`[Firecrawl] JSON parse error for ${url}:`, e);
                    results.push(null);
                    continue;
                }

                // Validate response structure
                if (!data.success) {
                    console.error(`[Firecrawl] Unsuccessful response for ${url}:`, data);
                    results.push(null);
                    continue;
                }

                if (!data.data?.markdown) {
                    console.error(`[Firecrawl] Missing markdown content for ${url}:`, data);
                    results.push(null);
                    continue;
                }

                const markdown = data.data.markdown.trim();
                if (!markdown) {
                    console.error(`[Firecrawl] Empty content for ${url}`);
                    results.push(null);
                    continue;
                }

                console.log(`[Firecrawl] Successfully scraped ${url} (${markdown.length} chars)`);
                results.push({
                    url,
                    markdown
                });

            } catch (error) {
                console.error(`[Firecrawl] Error processing ${url}:`, {
                    error: error instanceof Error ? error.message : error,
                    stack: error instanceof Error ? error.stack : undefined
                });
                results.push(null);
            }
        }

        const validResults = results.filter((r): r is ScrapedContent => r !== null);
        console.log(`\n[Firecrawl] Scraping summary:`, {
            total: urls.length,
            successful: validResults.length,
            failed: urls.length - validResults.length,
            successUrls: validResults.map(r => r.url)
        });

        return validResults;
    }
}
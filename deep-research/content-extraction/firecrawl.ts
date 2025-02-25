import { OutputManager } from '../src/output-manager';
import { FirecrawlResponse, ScrapedContent } from '../src/types';


export class Firecrawl {
    private output: OutputManager;

    constructor(output: OutputManager) {
        this.output = output;
    }

    private log(...args: any[]) {
        this.output.log(...args);
    }

    async scrapeWebsites(urls: string[]): Promise<ScrapedContent[]> {
        this.log(`Attempting to scrape ${urls.length} URLs`);
        if (!urls.length) {
            this.log('No URLs to scrape');
            return [];
        }

        const results = await Promise.all(urls.map(async url => {
            try {
                const response = await fetch(`${process.env.FIRECRAWL_BASE_URL}/v1/scrape`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.FIRECRAWL_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        url,
                        formats: ['markdown'],
                        onlyMainContent: true,
                        blockAds: true,
                        timeout: 30000
                    })
                });

                if (!response.ok) {
                    throw new Error(`Scraping failed with status ${response.status}`);
                }

                const data: FirecrawlResponse = await response.json();

                if (!data.success || !data.data?.markdown) {
                    throw new Error(data.data?.metadata?.error || 'No content received');
                }

                this.log(`✅ Successfully scraped ${url}`);
                return {
                    url,
                    markdown: data.data.markdown
                };
            } catch (error) {
                this.log(`❌ Failed to scrape ${url}:`, error);
                return null;
            }
        }));

        const validResults = results.filter((r): r is ScrapedContent => r !== null);
        this.log(`Successfully scraped ${validResults.length} out of ${urls.length} URLs`);

        return validResults;
    }
}
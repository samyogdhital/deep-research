import { FirecrawlResponse, ScrapedContent } from '../src/types';
import { ResearchDB } from '../src/db/db';
import { WebSocketManager } from '../src/websocket';
import { WebsiteAnalyzer } from '@/src/agent/website-analyzer';

export class Firecrawl {
    private readonly MAX_RETRIES = 2;
    private readonly SCRAPE_TIMEOUT = 5000; // 10 seconds

    constructor(private wsManager: WebSocketManager) { }

    private async attemptScrape(url: string): Promise<ScrapedContent | null> {
        if (!process.env.FIRECRAWL_BASE_URL) {
            throw new Error('FIRECRAWL_BASE_URL not configured');
        }

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
            return null;
        }

        const text = await response.text();
        let data: FirecrawlResponse;
        try {
            data = JSON.parse(text);
        } catch (e) {
            return null;
        }

        if (!data.success || !data.data?.markdown) {
            return null;
        }

        const markdown = data.data.markdown.trim();
        if (!markdown) {
            return null;
        }

        return {
            url,
            markdown
        };
    }

    async scrapeWebsites({ researchId, queryTimestamp, websites, is_deep_research, objective, websiteAnalyzer }: { researchId: string, queryTimestamp: number, websites: { url: string, id: number }[], is_deep_research: boolean, objective: string, websiteAnalyzer?: WebsiteAnalyzer }): Promise<ScrapedContent[]> {
        const db = await ResearchDB.getInstance();

        // Scrape all URLs at once that we get from searxng in parallel to absolutely save time.
        const results = await Promise.all(
            websites.map(async (website) => {
                for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
                    try {
                        const scrapePromise = this.attemptScrape(website.url);
                        const result = await Promise.race([
                            scrapePromise,
                            new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('Timeout')), this.SCRAPE_TIMEOUT)
                            )
                        ]) as ScrapedContent | null;

                        if (result) {
                            // Update website status to scraped in DB
                            await db.updateWebsiteStatus(researchId, queryTimestamp, website.url, {
                                status: 'scraped',
                                description: result.markdown
                            });

                            // Notify frontend via websocket
                            await this.wsManager.handleWebsiteScraped(researchId);

                            // Check if on deep research mode, if it is then we immediately analyze all the content for individual website right then and there.
                            if (is_deep_research && websiteAnalyzer) {
                                await websiteAnalyzer.analyzeContent({
                                    researchId,
                                    query_timestamp: queryTimestamp,
                                    url: website.url,
                                    content: result.markdown,
                                    objective: objective
                                });
                            }

                            return result;
                        }
                    } catch (error) {
                        if (attempt === this.MAX_RETRIES) {
                            console.log(`❌❌ Failed to scrape ${website.url}: ${error}`);
                            await db.removeWebsiteFromSuccessfulScrapedWebsites(researchId, website.url);

                            // Notify frontend about failed website
                            await this.wsManager.handleWebsiteScrapingFailed(researchId);
                        }
                    }
                }
                return null;
            })
        );

        return results.filter((r): r is ScrapedContent => r !== null);
    }
}
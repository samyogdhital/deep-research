// IMPORTANT: Do not remove the comment at all.
// Step 1: Information crunching agent will get the informations extracted by the single or multiple website analyze agent. The website analyzing agent got the objective from query-generator agent. Query generator agent understood the user's question in very detail. Then it generated the set of very precise and directed serp query to meet certain objective. That means Query generator agent generates serp query and very detailed objective of that query. If the websites that we get from hitting that serp query on to the search engine, we scrape those, there is very high probability that the objective, the exact information the user is looking for with deep research will be achieved. So there will be multiple serp query, each query have clear objective. If we combine all the websites we scrape from each of these serp query, the overall goal of user's deep research will complete with precise answer the user is looking for. And every successfully scraped website will trigger the website analyzing agent. These website analyzing agent will get the content from the website and extract the information to meet the objective given by the query-generator agent. So the information crunching agent will get the list of informations from one or more website analyzing agent under specific serp query. And this information crunching agent will crunch the information to get the most precise and accurate information information and churing out still somewhat unrelated information and precisely meeting the objective of that serp query the query generator agent has given.
// Step 2: The information crunching agent must only remove the information that is absolutely unnecessary. Since the website analyzer agent is per website basis, this cruncher agent is per serp query basis. And the crunched information this agent generates must have most important information that met the objective with each information citated to the original website. Make sure every information that you the agent responds must be cited by the exact website taken from. And thats how we are significantly crunching the informations but we are never removing the source where it was taken from.

import { generateObject } from '../ai/providers';
import { Schema, SchemaType } from '@google/generative-ai';
import { encode } from 'gpt-tokenizer';

export interface CrunchResult {
    content: string;
    sources: Array<{ url: string; quote: string }>;
}

export class InformationCruncher {
    private static readonly MAX_TOKENS = 50000;
    private static readonly MAX_WORDS = 50000;
    private objective: string;
    private contents: Array<{ content: string; url: string; quote: string }> = [];
    private totalWords = 0;
    private querySpecificContent = new Map<string, {
        content: string,
        sources: Array<{ url: string, quote: string }>,
        tokens: number,
        words: number
    }>();

    constructor(objective: string) {
        this.objective = objective;
    }

    static getMaxTokenLimit(): number {
        return InformationCruncher.MAX_TOKENS;
    }

    static getMaxWordLimit(): number {
        return InformationCruncher.MAX_WORDS;
    }

    async addContent(content: string, sourceUrl: string, sourceText: string): Promise<CrunchResult | null> {
        const words = content.split(/\s+/).length;
        this.totalWords += words;
        this.contents.push({ content, url: sourceUrl, quote: sourceText });

        if (this.shouldCrunch()) {
            return await this.crunchContent();
        }
        return null;
    }

    private shouldCrunch(): boolean {
        return this.totalWords >= InformationCruncher.MAX_WORDS;
    }

    async crunchContent(): Promise<CrunchResult> {
        const schema: Schema = {
            type: SchemaType.OBJECT,
            properties: {
                content: {
                    type: SchemaType.STRING,
                    description: "Synthesized and compressed information that maintains technical accuracy"
                },
                sources: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            url: { type: SchemaType.STRING },
                            quote: { type: SchemaType.STRING }
                        },
                        required: ["url", "quote"]
                    }
                }
            },
            required: ["content", "sources"]
        };

        const { response } = await generateObject({
            system: `You are an Information Synthesis Agent. Your task is to combine and compress information while maintaining technical accuracy and source traceability.`,
            prompt: `Synthesize this information related to: ${this.objective}

Information to process:
${this.contents.map(c => `
Content: ${c.content}
Source: ${c.url}
Quote: ${c.quote}
`).join('\n---\n')}

Requirements:
1. Combine overlapping information while preserving source attribution
2. Maintain technical accuracy and precision
3. Keep important details, numbers, and technical specifications
4. Remove redundancy while ensuring no loss of unique insights
5. Preserve source traceability for each piece of information
6. Ensure the synthesized content is well-structured and logically organized
7. Keep the most relevant and impactful information from each source`,
            model: process.env.CRUNCHING_MODEL as string,
            generationConfig: {
                responseSchema: schema
            }
        });

        const result = JSON.parse(response.text());

        // Reset counters after crunching
        this.contents = [];
        this.totalWords = 0;

        return result;
    }

    async finalCrunch(): Promise<CrunchResult | null> {
        return this.contents.length > 0 ? this.crunchContent() : null;
    }

    async crunchQueryContent(queryId: string, objective: string): Promise<CrunchResult | null> {
        const content = this.querySpecificContent.get(queryId);
        if (!content) return null;

        // Use the same crunching logic but with query-specific content
        this.objective = objective;
        this.contents = content.sources.map(s => ({
            content: content.content,
            url: s.url,
            quote: s.quote
        }));
        this.totalWords = content.words;

        return this.crunchContent();
    }
}
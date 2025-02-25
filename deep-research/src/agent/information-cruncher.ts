// IMPORTANT: Do not remove the comment at all.
// Step 1: Information crunching agent will get the informations extracted by the single or multiple website analyze agent. The website analyzing agent got the objective from query-generator agent. Query generator agent understood the user's question in very detail. Then it generated the set of very precise and directed serp query to meet certain objective. That means Query generator agent generates serp query and very detailed objective of that query. If the websites that we get from hitting that serp query on to the search engine, we scrape those, there is very high probability that the objective, the exact information the user is looking for with deep research will be achieved. So there will be multiple serp query, each query have clear objective. If we combine all the websites we scrape from each of these serp query, the overall goal of user's deep research will complete with precise answer the user is looking for. And every successfully scraped website will trigger the website analyzing agent. These website analyzing agent will get the content from the website and extract the information to meet the objective given by the query-generator agent. So the information crunching agent will get the list of informations from one or more website analyzing agent under specific serp query. And this information crunching agent will crunch the information to get the most precise and accurate information information and churing out still somewhat unrelated information and precisely meeting the objective of that serp query the query generator agent has given.
// Step 2: The information crunching agent must only remove the information that is absolutely unnecessary. Since the website analyzer agent is per website basis, this cruncher agent is per serp query basis. And the crunched information this agent generates must have most important information that met the objective with each information citated to the original website. Make sure every information that you the agent responds must be cited by the exact website taken from. And thats how we are significantly crunching the informations but we are never removing the source where it was taken from.

import { generateObject } from '../ai/providers';
import { Schema, SchemaType } from '@google/generative-ai';
import { OutputManager } from '../output-manager';
import { encode } from 'gpt-tokenizer';

export interface CrunchResult {
    content: string;
    sources: Array<{ url: string; quote: string }>;
}

export class InformationCruncher {
    private static readonly MAX_TOKENS = 50000;
    private output: OutputManager;
    private objective: string;
    private contents: Array<{ content: string; url: string; quote: string }> = [];

    constructor(objective: string, output: OutputManager) {
        this.objective = objective;
        this.output = output;
    }

    static getMaxTokenLimit(): number {
        return InformationCruncher.MAX_TOKENS;
    }

    async addContent(content: string, sourceUrl: string, sourceText: string): Promise<CrunchResult | null> {
        this.contents.push({ content, url: sourceUrl, quote: sourceText });

        if (this.shouldCrunch()) {
            return await this.crunchContent();
        }
        return null;
    }

    private shouldCrunch(): boolean {
        const totalTokens = encode(this.contents.map(c => c.content + c.quote).join(' ')).length;
        return totalTokens > InformationCruncher.MAX_TOKENS / 2;
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
            system: `You are an Information Synthesis Agent. Combine and compress information while maintaining technical accuracy.`,
            prompt: `Synthesize this information related to: ${this.objective}

Information to process:
${this.contents.map(c => `
Content: ${c.content}
Source: ${c.url}
Quote: ${c.quote}
`).join('\n---\n')}

Requirements:
1. Combine overlapping information
2. Maintain technical accuracy
3. Keep important details and numbers
4. Remove redundancy
5. Preserve source traceability`,
            model: process.env.CRUNCHING_MODEL as string,
            generationConfig: {
                responseSchema: schema
            }
        });

        const result = JSON.parse(response.text());
        this.contents = []; // Reset after crunching
        return result;
    }

    async finalCrunch(): Promise<CrunchResult | null> {
        return this.contents.length > 0 ? this.crunchContent() : null;
    }
}
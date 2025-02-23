import { encode } from 'gpt-tokenizer';
import { generateObject } from './ai/providers';
import { Schema, SchemaType } from '@google/generative-ai';

interface Source {
    url: string;
    quote: string;
}

interface CrunchedInfo {
    content: string;
    sources: Source[];
}

export class InformationCruncher {
    private static readonly MAX_TOKENS = 50000;
    private content: string[] = [];
    private sources: Source[] = [];
    private objective: string;
    private currentTokenCount = 0;

    constructor(objective: string) {
        this.objective = objective;
    }

    static getMaxTokenLimit(): number {
        return InformationCruncher.MAX_TOKENS;
    }

    async addContent(content: string, sourceUrl: string, sourceQuote: string): Promise<CrunchedInfo | null> {
        const newTokens = encode(content).length;

        if (this.currentTokenCount + newTokens > InformationCruncher.MAX_TOKENS) {
            // If adding new content would exceed token limit, crunch first
            const crunchedInfo = await this.crunchContent();
            // Reset after crunching
            this.content = [content];
            this.sources = [{ url: sourceUrl, quote: sourceQuote }];
            this.currentTokenCount = newTokens;
            return crunchedInfo;
        }

        this.content.push(content);
        this.sources.push({ url: sourceUrl, quote: sourceQuote });
        this.currentTokenCount += newTokens;
        return null;
    }

    async crunchContent(): Promise<CrunchedInfo> {
        if (this.content.length === 0) return null;

        const schema: Schema = {
            type: SchemaType.OBJECT,
            properties: {
                crunchedContent: {
                    type: SchemaType.STRING,
                    description: "Highly technical, detailed information that precisely answers the objective, compressed to maintain all key facts while reducing length"
                },
                preservedSources: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            url: { type: SchemaType.STRING },
                            quote: { type: SchemaType.STRING },
                            relevance: { type: SchemaType.NUMBER }
                        },
                        required: ["url", "quote", "relevance"]
                    }
                }
            },
            required: ["crunchedContent", "preservedSources"]
        };

        try {
            const { response } = await generateObject({
                system: `You are an Information Crunching Agent. Your task is to compress large amounts of information while preserving all technical details, facts, and citations. Follow these rules:
- Maintain all technical accuracy and detail
- Preserve source attributions
- Remove redundancy while keeping unique insights
- Keep the most relevant sources and quotes
- Ensure the compressed result precisely serves the objective`,
                prompt: `Compress this information while maintaining all technical details and source attributions:

OBJECTIVE: ${this.objective}

CONTENT TO CRUNCH:
${this.content.map((c, i) => `
Source ${i + 1}: ${this.sources[i].url}
Content: ${c}
Quote: ${this.sources[i].quote}
`).join('\n')}`,
                model: process.env.INFORMATION_CRUNCHING_MODEL as string,
                generationConfig: {
                    responseSchema: schema
                }
            });

            const result = JSON.parse(response.text());

            // Sort sources by relevance and keep the most relevant ones
            const sortedSources = result.preservedSources
                .sort((a: any, b: any) => b.relevance - a.relevance)
                .map(({ url, quote }: { url: string, quote: string }) => ({ url, quote }));

            return {
                content: result.crunchedContent,
                sources: sortedSources
            };
        } catch (error) {
            console.error('Error crunching content:', error);
            throw error;
        }
    }

    async finalCrunch(): Promise<CrunchedInfo | null> {
        if (this.content.length === 0) return null;
        return this.crunchContent();
    }
}

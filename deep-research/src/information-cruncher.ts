import { generateObject } from './ai/providers';
import { Schema, SchemaType } from '@google/generative-ai';
import { encode } from 'gpt-tokenizer';

export interface CrunchedInfo {
    content: string;
    sources: Array<{
        url: string;
        quote: string;
    }>;
}

export class InformationCruncher {
    private static TOKEN_THRESHOLD = 50000;
    private accumulator: {
        content: string;
        sources: Array<{ url: string; quote: string }>;
    }[] = [];
    private currentTokenCount = 0;

    constructor(private objective: string, initialTokenCount: number = 0) {
        this.currentTokenCount = initialTokenCount;
    }

    async addContent(content: string, sourceUrl: string, sourceQuote: string) {
        const newTokens = encode(content + sourceQuote).length;
        this.currentTokenCount += newTokens;

        this.accumulator.push({
            content,
            sources: [{ url: sourceUrl, quote: sourceQuote }]
        });

        if (this.currentTokenCount >= InformationCruncher.TOKEN_THRESHOLD) {
            return await this.crunchInformation();
        }
        return null;
    }

    private async crunchInformation(): Promise<CrunchedInfo> {
        const schema: Schema = {
            type: SchemaType.OBJECT,
            properties: {
                crunchedContent: {
                    type: SchemaType.STRING,
                    description: "Highly condensed, value-packed technical information that precisely meets the research objective"
                },
                relevantSources: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            url: { type: SchemaType.STRING },
                            quote: { type: SchemaType.STRING }
                        }
                    }
                }
            },
            required: ["crunchedContent", "relevantSources"]
        };

        const { response } = await generateObject({
            system: `You are an Information Crunching Agent. Your task is to analyze a large collection of research findings and condense them into highly focused, technical, and value-packed information. Follow these rules:
      - Focus only on information that directly addresses the research objective
      - Eliminate redundant or low-value information
      - Maintain technical accuracy and detail while being concise
      - Preserve critical facts, figures, and technical details
      - Track and maintain source attribution for verification`,
            prompt: `Research Objective: ${this.objective}

Analyze and crunch these research findings into concentrated, high-value information:

${this.accumulator.map(item => item.content).join('\n\n')}

Sources for verification:
${this.accumulator.map(item => item.sources.map(s =>
                `URL: ${s.url}\nQuote: ${s.quote}`).join('\n')).join('\n\n')}`,
            model: process.env.INFORMATION_CRUNCHING_MODEL as string,
            generationConfig: { responseSchema: schema }
        });

        const result = JSON.parse(response.text());

        // Reset accumulator and token count
        this.accumulator = [];
        this.currentTokenCount = 0;

        return {
            content: result.crunchedContent,
            sources: result.relevantSources
        };
    }

    async finalCrunch(): Promise<CrunchedInfo | null> {
        if (this.accumulator.length > 0) {
            return await this.crunchInformation();
        }
        return null;
    }

    // Add method to check total tokens of accumulated content
    public getTotalTokens(): number {
        return this.accumulator.reduce((total, item) => {
            return total + encode(item.content + item.sources.map(s => s.quote).join(' ')).length;
        }, 0);
    }

    // Add method to get max token limit
    public static getMaxTokenLimit(): number {
        return 200000; // Max tokens for report writing
    }
}

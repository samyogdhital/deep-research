// IMPORTANT: Do not remove the comment at all.
// Step 1: All the learnings from information crunching agent is passed here with detailed objective. The user's iniital query is also passed here for detailed report writing based on the user's query. Answering the user's percise query with to the point information.

// Step 2: The reponse from initial-report-agent is sent here along with all the learnings from information crunching agent and we include all the infomration missed by initial-report-agent based on the objective we have and the user demands.
// We need to make sure that the information missed by initial-report-agent is included is caught here and more detailed and comprehensive report is presented for final-report-agent.

// Step 3: Report from middle-report-agent is passed here along with all the learnings and conclusions we got and made during the deep research process. The report from both of these initial and middle report agent is also passed here. The user's initial query is also passed here and made sure that this final report is not missing any important infomration if it is present on the internet answering the precise question the user has asked.

import { generateObject } from '../ai/providers';
import { Schema, SchemaType } from '@google/generative-ai';
import { OutputManager } from '../output-manager';
import { InformationCruncher } from './information-cruncher';
// import { encode } from 'gpt-tokenizer';
// import { InformationCruncher } from '../information-cruncher';

export interface TrackedLearning {
    content: string;
    sourceUrl: string;
    sourceText: string;
    objective?: string;
}

export interface ReportResult {
    report_title: string;
    report: string;
    sources: Array<{ id: number; url: string; title: string }>;
}

export class ReportWriter {
    private output: OutputManager;

    constructor(output: OutputManager) {
        this.output = output;
    }

    private log(...args: any[]) {
        this.output.log(...args);
    }

    async generateReport({
        prompt,
        learnings,
        visitedUrls,
    }: {
        prompt: string;
        learnings: TrackedLearning[];
        visitedUrls: string[];
    }): Promise<ReportResult> {
        if (!learnings?.length || !visitedUrls?.length) {
            throw new Error('Invalid input: Missing learnings or visitedUrls');
        }

        this.log("Writing Final Report - 🥅🥅🥅🥅");

        const processedLearnings = await this.processLearnings(learnings);
        const reportSchema: Schema = {
            type: SchemaType.OBJECT,
            properties: {
                report_title: {
                    type: SchemaType.STRING,
                    description: "Short 3-5 word summary about what this report is all about."
                },
                report: {
                    type: SchemaType.STRING,
                    description: "The complete technical report in markdown format with citations"
                },
                sources: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            id: {
                                type: SchemaType.NUMBER,
                                description: "Sequential number for the source"
                            },
                            url: {
                                type: SchemaType.STRING,
                                description: "Source URL"
                            },
                            title: {
                                type: SchemaType.STRING,
                                description: "Title or description of the source"
                            }
                        },
                        required: ["id", "url", "title"]
                    }
                }
            },
            required: ['report_title', "report", "sources"]
        };

        const { response } = await generateObject({
            system: `You are a Technical Research Report Writing Agent. Your task is to write a detailed technical report in markdown format. Follow these strict rules:
      - Write in clear markdown format
      - Every statement must end with a citation in format [n](url) where n is the sequential number
      - Citations must be numbered sequentially [1], [2], etc.
      - Each citation must link to one specific source URL
      - Ensure each source is used at least once
      - Write in highly technical and detailed manner
      - Include all facts, figures, and technical specifications
      - Create a References section at the end with numbered list of all sources
      - Each reference must have a title/description and URL`,
            prompt: `Write a comprehensive technical report using these research findings:

Research Context: ${prompt}

Research Findings:
${processedLearnings.map((l, i) => `
Source ${i + 1}: ${l.sourceUrl}
Content: ${l.content}
Evidence: ${l.sourceText}
`).join('\n\n')}

Format Requirements:
1. Use proper markdown headers (#, ##)
2. Every statement must end with a citation in format [n](url)
3. Add a References section at the end
4. Ensure each citation is a clickable link
5. Be highly technical and detailed
6. Use clear section organization`,
            model: process.env.REPORT_WRITING_MODEL as string,
            generationConfig: {
                responseSchema: reportSchema
            }
        });

        const result = JSON.parse(response.text());
        return {
            report_title: result.report_title,
            report: result.report,
            sources: result.sources
        };
    }

    private async processLearnings(learnings: TrackedLearning[]): Promise<TrackedLearning[]> {
        const MAX_REPORT_TOKENS = InformationCruncher.getMaxTokenLimit();
        let processedLearnings: TrackedLearning[] = [];

        // Group learnings by objectives
        const learningsByObjective = learnings.reduce((acc, learning) => {
            const objective = learning.objective || 'general';
            if (!acc[objective]) acc[objective] = [];
            acc[objective].push(learning);
            return acc;
        }, {} as Record<string, TrackedLearning[]>);

        // Process each objective group
        for (const [objective, objectiveLearnings] of Object.entries(learningsByObjective)) {
            const cruncher = new InformationCruncher(objective);

            for (const learning of objectiveLearnings) {
                const crunchedInfo = await cruncher.addContent(
                    learning.content,
                    learning.sourceUrl,
                    learning.sourceText
                );

                if (crunchedInfo) {
                    processedLearnings.push({
                        content: crunchedInfo.content,
                        sourceUrl: crunchedInfo.sources.map(s => s.url).join(', '),
                        sourceText: crunchedInfo.sources.map(s => s.quote).join(' | '),
                        objective
                    });
                }
            }
        }

        return processedLearnings;
    }
}
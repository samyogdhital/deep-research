// IMPORTANT: Do not remove the comment at all.
// Step 1: All the learnings from information crunching agent is passed here with detailed objective. The user's iniital query is also passed here for detailed report writing based on the user's query. Answering the user's percise query with to the point information.

// Step 2: The reponse from initial-report-agent is sent here along with all the learnings from information crunching agent and we include all the infomration missed by initial-report-agent based on the objective we have and the user demands.
// We need to make sure that the information missed by initial-report-agent is included is caught here and more detailed and comprehensive report is presented for final-report-agent.

// Step 3: Report from middle-report-agent is passed here along with all the learnings and conclusions we got and made during the deep research process. The report from both of these initial and middle report agent is also passed here. The user's initial query is also passed here and made sure that this final report is not missing any important infomration if it is present on the internet answering the precise question the user has asked.

import { generateObject } from '../ai/providers';
import { Schema, SchemaType } from '@google/generative-ai';
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
    title: string;
    sections: Array<{
        rank: number;
        sectionHeading: string;
        content: string;
    }>;
    citedUrls: Array<{
        rank: number;
        url: string;
        title: string;
        oneValueablePoint: string;
    }>;
}

export class ReportWriter {
    constructor() { }

    async generateReport(params: {
        prompt: string;
        learnings: TrackedLearning[];
    }): Promise<ReportResult> {
        if (!params.learnings?.length) {
            throw new Error('Invalid input: Missing learnings');
        }

        const { prompt, learnings } = params;

        const processedLearnings = await this.processLearnings(learnings);
        // This schema is absolutely necessary for pushing data to database for the report section.
        // Every field is required to ensure Gemini doesn't miss any fields in the response.
        // The response must exactly match the database Report schema structure.
        const reportSchema: Schema = {
            type: SchemaType.OBJECT,
            properties: {
                title: {
                    type: SchemaType.STRING,
                    description: "Title of the report"
                },
                sections: {
                    type: SchemaType.ARRAY,
                    description: "Array of sections in the report, properly formatted in markdown",
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            rank: {
                                type: SchemaType.NUMBER,
                                description: "Sequential number indicating the order of this section"
                            },
                            sectionHeading: {
                                type: SchemaType.STRING,
                                description: "Section heading in markdown format (H1/H2/H3) with appropriate markdown tags"
                            },
                            content: {
                                type: SchemaType.STRING,
                                description: "Content in full markdown format including lists and citations in [rank](citedUrls[rank].url) format"
                            }
                        },
                        required: ["rank", "sectionHeading", "content"]
                    }
                },
                citedUrls: {
                    type: SchemaType.ARRAY,
                    description: "Array of cited URLs used in the report",
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            rank: {
                                type: SchemaType.NUMBER,
                                description: "Sequential rank number, most cited URL should be rank 1"
                            },
                            url: {
                                type: SchemaType.STRING,
                                description: "URL of the source"
                            },
                            title: {
                                type: SchemaType.STRING,
                                description: "Title of the website"
                            },
                            oneValueablePoint: {
                                type: SchemaType.STRING,
                                description: "One valuable fact or figure from this source that meets our objective"
                            }
                        },
                        required: ["rank", "url", "title", "oneValueablePoint"]
                    }
                }
            },
            required: ["title", "sections", "citedUrls"]
        };

        const { response } = await generateObject({
            system: `You are a Technical Research Report Writing Agent. Your task is to write a detailed technical report following the exact schema structure. Follow these strict rules:
      - Write in clear markdown format
      - Every section must have proper markdown headers (# for H1, ## for H2, ### for H3)
      - Every statement must have a citation linking to citedUrls using [rank](url) format
      - Citations must be numbered by their rank in citedUrls array
      - Each cited URL must have one valuable point extracted from it
      - Write in highly technical and detailed manner
      - Include all facts, figures, and technical specifications
      - Organize content into proper sections with appropriate ranks`,
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
        return result;
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
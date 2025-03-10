import { Part, Schema, SchemaType } from '@google/generative-ai';
import { callGeminiLLM, SystemInstruction, UserPrompt } from '../ai/providers';
import { DBSchema } from '../db/db';
import { ScrapedContent } from '../types';

type SerpQueryAnalysis = DBSchema['researches'][number]['serpQueries'][number];

export class SerpQueryAnalyzer {
    constructor() { }

    async analyzeSerpQuery(params: {
        contents: ScrapedContent[],
        query: string,
        objective: string,
        query_timestamp: number,
        depth_level: number,
        parent_query_timestamp: number,
        failedWebsites?: Array<{ website: string; stage: 'failed' }>
    }): Promise<SerpQueryAnalysis> {
        const { contents, query, objective, query_timestamp, depth_level, parent_query_timestamp, failedWebsites = [] } = params;

        const responseSchema: Schema = {
            type: SchemaType.ARRAY,
            description: "Array of website analysis results, one for each website provided in the content",
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    url: {
                        type: SchemaType.STRING,
                        description: "The URL of the website being analyzed"
                    },
                    title: {
                        type: SchemaType.STRING,
                        description: "The title of the website"
                    },
                    description: {
                        type: SchemaType.STRING,
                        description: "A brief description of the website content"
                    },
                    relevance_score: {
                        type: SchemaType.NUMBER,
                        description: "A score between 0 and 10 indicating how relevant the content is to the objective"
                    },
                    is_objective_met: {
                        type: SchemaType.BOOLEAN,
                        description: "Whether this website's content directly addresses the research objective"
                    },
                    core_content: {
                        type: SchemaType.ARRAY,
                        description: "Array of highly technical, relevant information points extracted from the website",
                        items: {
                            type: SchemaType.STRING
                        }
                    },
                    facts_figures: {
                        type: SchemaType.ARRAY,
                        description: "Array of direct quotes, statistics, and factual evidence from the website",
                        items: {
                            type: SchemaType.STRING
                        }
                    }
                },
                required: ["url", "title", "description", "relevance_score", "is_objective_met", "core_content", "facts_figures"]
            }
        };

        const systemInstruction: SystemInstruction = {
            role: 'system',
            parts: [{
                text: `
You are the SERP Query Analysis Agent. Your task is to analyze multiple website contents simultaneously in relation to a specific search query and its objective. You must extract all relevant information from each website and structure it according to our database schema.

Follow these strict guidelines:

1. Analyze ALL provided websites thoroughly - do not skip any website
2. For EACH website:
   - Extract core content that directly addresses the objective
   - Identify facts and figures that support the findings
   - Assign a relevance score (0-10)
   - Determine if the objective is met
   - Provide a concise title and description
3. Structure the output as an array of website analyses
4. Maintain technical accuracy and detail
5. Use exact quotes and facts from the sources
6. Do not add external knowledge or interpretations

Remember:
- Every website must be analyzed and included in the response
- Only extract information that directly serves the objective
- Use exact quotes and facts from the sources
- Maintain technical accuracy and detail
- Do not skip any website, even if it seems less relevant

Current Date: ${new Date().toISOString()}
`
            }]
        };

        // Format all website contents into a single string for analysis
        const formattedContent = contents.map(content => `
Website: ${content.url}
Content:
${content.markdown}
-------------------
`).join('\n');

        const userPrompt: Part[] = [{
            text: `
Analyze ALL of the following websites' content in relation to this search query and objective. You must analyze EVERY website and include it in your response.

QUERY: "${query}"
OBJECTIVE: "${objective}"

WEBSITE CONTENTS:
${formattedContent}

REQUIREMENTS:
1. Analyze EVERY website provided above
2. For each website, extract:
   - A clear title
   - A brief description
   - Relevant core content (as direct quotes or precise information)
   - Supporting facts and figures
   - Assign a relevance score (0-10)
   - Determine if it meets the objective

Return an ARRAY where each element represents one website's analysis, following this exact structure:
[
  {
    "url": "website_url",
    "title": "clear title",
    "description": "brief description",
    "relevance_score": number 0-10,
    "is_objective_met": boolean,
    "core_content": ["point1", "point2", ...],
    "facts_figures": ["fact1", "fact2", ...]
  },
  // ... one object for EACH website
]

IMPORTANT: Your response MUST include an analysis for EVERY website in the input, even if some seem less relevant.
`
        }];

        const userPromptSchema: UserPrompt = {
            contents: [{ role: 'user', parts: userPrompt }],
        };

        try {
            const { response } = await callGeminiLLM({
                system: systemInstruction,
                user: userPromptSchema,
                model: process.env.SERP_QUERY_ANALYZING_MODEL as string,
                generationConfig: {
                    temperature: 0.1,
                    responseSchema: responseSchema
                }
            });

            // Parse the LLM response
            const websiteAnalyses = JSON.parse(response.text()) as Array<{
                url: string;
                title: string;
                description: string;
                relevance_score: number;
                is_objective_met: boolean;
                core_content: string[];
                facts_figures: string[];
            }>;

            // Transform the response into the required database schema format
            const successful_scraped_websites = websiteAnalyses.map((analysis, index: number) => ({
                id: index + 1,
                url: analysis.url,
                title: analysis.title,
                description: analysis.description,
                status: 'analyzed' as const,
                relevance_score: analysis.relevance_score,
                is_objective_met: analysis.is_objective_met,
                core_content: analysis.core_content,
                facts_figures: analysis.facts_figures
            }));

            return {
                query,
                objective,
                query_timestamp,
                depth_level,
                parent_query_timestamp,
                successful_scraped_websites,
                failedWebsites: failedWebsites
            };
        } catch (error) {
            console.error('Error in SerpQueryAnalyzer:', error);

            // Return a valid object even in case of error
            return {
                query,
                objective,
                query_timestamp,
                depth_level,
                parent_query_timestamp,
                successful_scraped_websites: contents.map((content, index) => ({
                    id: index + 1,
                    url: content.url,
                    title: content.url,
                    description: '',
                    status: 'failed' as const,
                    relevance_score: 0,
                    is_objective_met: false,
                    core_content: [],
                    facts_figures: []
                })),
                failedWebsites: failedWebsites
            };
        }
    }
}
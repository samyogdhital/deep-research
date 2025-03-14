import { Part, Schema, SchemaType } from '@google/generative-ai';
import { callGeminiLLM, SystemInstruction, ultimateModel, UserPrompt } from '../ai/providers';
import { DBSchema, ResearchDB } from '../db/db';
import { ScrapedContent } from '../types';
import { z } from 'zod';
import { WebSocketManager } from '../websocket';
import { getLatestResearchFromDB } from '@/utils/db-utils';

type SerpQueryAnalysis = DBSchema['researches'][number]['serpQueries'][number];

// This agent is used to analyze the all the list of successfully scraped websites in relation to a specific search query and objective with a single call of SerpQueryAnalyzer and then saves the data it generates for each of these websites in a defined schema in the database. This is only used when the is_deep_research is false. This is not used in case of deep research. It is only used in non deep research.
export class SerpQueryAnalyzer {
    constructor(private wsManager: WebSocketManager) { }

    async analyzeSerpQuery(params: {
        researchId: string,
        contents: ScrapedContent[],
        query: string,
        objective: string,
        query_timestamp: number,
        depth_level: number,
        parent_query_timestamp: number,
        stage: 'in-progress' | 'completed' | 'failed',
        // failedWebsites: DBSchema['researches'][number]['serpQueries'][number]['scrapeFailedWebsites']
    }): Promise<SerpQueryAnalysis> {
        const { contents, query, objective, query_timestamp, depth_level, parent_query_timestamp, researchId } = params;

        const { researchData, db } = await getLatestResearchFromDB(researchId);

        const systemPrompt = `
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


        // Format all website contents into a single string for analysis
        const formattedContent = contents.map(content => `
Website: ${content.url}
Content:
${content.markdown}
-------------------
`).join('\n');

        const userPrompt = `
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

        try {
            const response = await ultimateModel({
                system: systemPrompt,
                user: userPrompt,
                // we need that above resposneschema in zod form and we need to define each one of them below in zod
                schema: z.array(z.object({
                    url: z.string().describe("The URL of the website being analyzed"),
                    title: z.string().describe("The title of the website"),
                    description: z.string().describe("A brief description of the website content"),
                    relevance_score: z.number().describe("A score between 0 and 10 indicating how relevant the content is to the objective"),
                    is_objective_met: z.boolean().describe("Whether this website's content directly addresses the research objective"),
                    core_content: z.array(z.string()).describe("Array of highly technical, relevant information points extracted from the website"),
                    facts_figures: z.array(z.string()).describe("Array of direct quotes, statistics, and factual evidence from the website")
                }))
            })


            // Parse the LLM response
            const websiteAnalyses = response.object

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
            await db.updateSerpQueryResults({
                report_id: researchId,
                queryTimestamp: query_timestamp,
                parentQueryTimestamp: parent_query_timestamp,
                successfulWebsites: successful_scraped_websites,
                serpQueryStage: 'completed'
            });
            await this.wsManager.handleAnalyzedSerpQuery(researchId);

            return {
                query,
                objective,
                query_timestamp,
                depth_level,
                parent_query_timestamp,
                stage: 'completed' as const,
                successful_scraped_websites,
                scrapeFailedWebsites: [] //just for the sake of making typescript happy. 
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
                stage: 'failed' as const,
                successful_scraped_websites: contents.map((content, index) => ({
                    id: index + 1,
                    url: content.url,
                    title: content.url,
                    description: '',
                    status: 'analysis-failed' as const,
                    relevance_score: 0,
                    is_objective_met: false,
                    core_content: [],
                    facts_figures: []
                })),
                scrapeFailedWebsites: [] //just for the sake of making typescript happy. 
            };
        }
    }
}
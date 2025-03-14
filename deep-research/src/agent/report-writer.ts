// IMPORTANT: Do not remove the comment at all.
// Step 1: All the learnings from information crunching agent is passed here with detailed objective. The user's iniital query is also passed here for detailed report writing based on the user's query. Answering the user's percise query with to the point information.

// Step 2: The reponse from initial-report-agent is sent here along with all the learnings from information crunching agent and we include all the infomration missed by initial-report-agent based on the objective we have and the user demands.
// We need to make sure that the information missed by initial-report-agent is included is caught here and more detailed and comprehensive report is presented for final-report-agent.

// Step 3: Report from middle-report-agent is passed here along with all the learnings and conclusions we got and made during the deep research process. The report from both of these initial and middle report agent is also passed here. The user's initial query is also passed here and made sure that this final report is not missing any important infomration if it is present on the internet answering the precise question the user has asked.

import { geminiText, SystemInstruction, vercelGemini } from '../ai/providers';
import { encode } from 'gpt-tokenizer';
import { DBSchema } from '../db/db';
import { WebSocketManager } from '../websocket';
import { z } from 'zod';
// export interface ReportResult {
//     title: string;
//     sections: Array<{
//         rank: number;
//         sectionHeading: string;
//         content: string;
//     }>;
//     citedUrls: Array<{
//         rank: number;
//         url: string;
//         title: string;
//         oneValueablePoint: string;
//     }>;
// }

export class ReportWriter {
    constructor() { }

    async generateReport(params: {
        db_research_data: DBResearchData,
        wsManager: WebSocketManager
    }): Promise<
        string
    // ReportResult
    > {

        const { db_research_data, wsManager } = params;

        if (!db_research_data.serpQueries.length) {
            throw new Error('Invalid input: Missing serp queries');
        }

        const structuredPrompt = generateContextforReportWriterAgent(db_research_data);
        const tokens = encode(structuredPrompt);
        console.log("✍️✍️", `Tokens: ${tokens.length}`,);

        // This schema is absolutely necessary for pushing data to database for the report section.
        // Every field is required to ensure Gemini doesn't miss any fields in the response.
        // The response must exactly match the database Report schema structure.
        // const reportSchema: Schema = {
        //     type: SchemaType.OBJECT,
        //     properties: {
        //         title: {
        //             type: SchemaType.STRING,
        //             description: "Title of this report in 5-7 words that summarizes this entire report."
        //         },
        //         sections: {
        //             type: SchemaType.ARRAY,
        //             description: "Array of individual sections in the report. Each section must answer a specific question of the user in very detailed. Make sure each section is as much technically rich as possible.",
        //             items: {
        //                 type: SchemaType.OBJECT,
        //                 properties: {
        //                     rank: {
        //                         type: SchemaType.NUMBER,
        //                         description: "The most important section must be rank 1 showing the importance of the section in entire report. The least important section must be rank last. Make sure these sections start from 1 to N."
        //                     },
        //                     sectionHeading: {
        //                         type: SchemaType.STRING,
        //                         description: "Title of the section in 3-5 words in markdown heading format. Must generate with `##` or `###` before the heading to maintain the markdown format."
        //                     },
        //                     content: {
        //                         type: SchemaType.STRING,
        //                         description: "The main content of the section. Must use full markdown features. Content must be technically descriptive and detailed. Must answer the exact user question with technical depth. Use ordered lists, unordered lists, bold, italic, code, etc. Every sentence must be cited with [rank](URL) format."
        //                     }
        //                 },
        //                 required: ["rank", "sectionHeading", "content"]
        //             }
        //         },
        //         citedUrls: {
        //             type: SchemaType.ARRAY,
        //             description: "Array of cited URLs used in the report. All the full urls that were considered to write this full report. All the urls that were used to write every sections of the report. Don't make the urls yourself. Whatever url you give in this array, it must be provided to you and must be used to write the content of the sections.",
        //             items: {
        //                 type: SchemaType.OBJECT,
        //                 properties: {
        //                     rank: {
        //                         type: SchemaType.NUMBER,
        //                         description: "Url with rank 1 is the most cited url in the report. Rank N is the least cited url. Must rank according to citation frequency."
        //                     },
        //                     url: {
        //                         type: SchemaType.STRING,
        //                         description: "Full url of the website used to write the content."
        //                     },
        //                     title: {
        //                         type: SchemaType.STRING,
        //                         description: "Title of the website used."
        //                     },
        //                     oneValueablePoint: {
        //                         type: SchemaType.STRING,
        //                         description: "One most important and highly valuable fact or figure from this source that meets our objective."
        //                     }
        //                 },
        //                 required: ["rank", "url", "title", "oneValueablePoint"]
        //             }
        //         }
        //     },
        //     required: ["title", "sections", "citedUrls"]
        // };

        const systemPrompt = `
    ## Main Answer

    You are the **Technical Research Report Writing Agent**, an advanced AI designed to synthesize extensive research data into a PhD-level technical report. Your task is to produce a highly detailed, technically dense, and fully cited report that reflects the depth and breadth of the provided research context.

    ## Core Responsibilities
    - Extract and integrate critical information from user's initial prompt, follow-up Q&A, SERP queries, and scraped website content
    - Ensure every claim is factual and cited
    - Use only provided data and URLs

    ## Citation Requirements
    - Every sentence must end with [rank](URL)
    - Multiple citations shown as [1](URL1), [2](URL2)
    - Track citation frequency for URL ranking

    ## Section Requirements
    - Minimum 10 sections
    - Each section must have a clear heading and comprehensive content
    - Content must be technically descriptive with citations

    ## Content Guidelines
    - Focus on technical depth and accuracy
    - Maintain professional academic tone
    - Synthesize information across sources
    - Support all claims with citations
    - Present findings in clear logical flow`

        const userPromptOnly = `
    Generate a comprehensive, PhD-level technical report synthesizing all provided research data from the deep research process.

    ### Context
    ${generateContextforReportWriterAgent(db_research_data)}`

        // const systemInstruction: SystemInstruction = {
        //     role: 'system',
        //     parts: [
        //         {
        //             text: systemPrompt
        //         }
        //     ]
        // }


        // const userPrompt = [{
        //     text: userPromptOnly
        // }]

        // const userPromptSchema: UserPrompt = {
        //     contents: [{ role: 'user', parts: userPrompt }],
        // };

        // // const { response } = await callGeminiLLM({
        // //     system: systemInstruction,
        // //     user: userPromptSchema,
        // //     model: process.env.RESEARCH_WRITING_MODEL as string,
        // //     generationConfig: {
        // //         responseSchema: reportSchema
        // //     }
        // // });



        try {


            // const response = await vercelGemini({
            //     model: process.env.RESEARCH_WRITING_MODEL as string,
            //     system: systemPrompt,
            //     user: userPromptOnly,
            //     schema: z.object({
            //         title: z.string().describe("Title of this report in 5-7 words that summarizes this entire report."),
            //         sections: z.array(z.object({
            //             rank: z.number().describe("The most important section must be rank 1 showing the importance of the section in entire report. The least important section must be rank last. Make sure these sections start from 1 to N."),
            //             sectionHeading: z.string().describe("Title of the section in 3-5 words in markdown heading format. Must generate with `##` or `###` before the heading to maintain the markdown format."),
            //             content: z.string().describe("The main content of the section. Must use full markdown features. Content must be technically descriptive and detailed. Must answer the exact user question with technical depth. Use ordered lists, unordered lists, bold, italic, code, etc. Every sentence must be cited with [rank](URL) format."),
            //         })),
            //         citedUrls: z.array(z.object({
            //             rank: z.number().describe("Url with rank 1 is the most cited url in the report. Rank N is the least cited url. Must rank according to citation frequency."),
            //             url: z.string().describe("Full url of the website used to write the content."),
            //             title: z.string().describe("Title of the website used."),
            //             oneValueablePoint: z.string().describe("One most important and highly valuable fact or figure from this source that meets our objective."),
            //         })),
            //     }),
            //     apiKey: process.env.GOOGLE_API_KEY_10 as string,
            //     structuredOutputs: false
            // });


            const { text } = await geminiText({
                model: process.env.RESEARCH_WRITING_MODEL as string,
                system: systemPrompt,
                user: userPromptOnly
            })

            const content = text;

            console.log("🔃🔃", `Content: ${text}`);
            saveData(content);
            return content;
        } catch (error) {
            console.log('❌❌ Report writing error:', error);
            wsManager.handleResearchError(
                new Error(error as string),
                params.db_research_data.report_id
            );
            throw new Error('Invalid response from Gemini');
        }
    }
}



export type DBResearchData = DBSchema['researches'][number];

const generateContextforReportWriterAgent = (
    db_research_data: DBResearchData
) => `
  USER'S INITIAL PROMPT
    Here is the initial prompt the user gave us to do deep research on:
    "${db_research_data.initial_query}"
  
  FOLLOWUP QUESTION AND ANSWERS
    Here are the followup questions that prompt analyzer agent analyzed the initial user's prompt and generated the followup questions to which the user has answered each of them:
    ${db_research_data.followUps_QnA
        .map(
            (f) => `
    - Question: ${f.question}
        Answer: ${f.answer}
    `
        )
        .join('\n')}
  
  DEPTH AND BREATH OF THIS DEEP RESEARCH
    The user told us to do deep research on above topics with depth "${db_research_data.depth
    }" and breadth "${db_research_data.breadth
    }" out of 10 on both of these. You can understand the user's requirement how deep the report should be and how broad the report should be.
  
      Quick context on depth and breadth: Depth defines how many recursive rounds the research process will perform, with each level using insights from previous rounds to generate new, more focused SERP queries. Breadth determines the number of parallel queries executed at each level, allowing multiple angles of the original query to be explored simultaneously. Together, these parameters ensure that the system not only dives deeply into the subject matter for detailed insights but also maintains a diverse approach by investigating various perspectives concurrently according to the requirement of the user.
  
  
  SERP QUERIES AND INFORMATIONS EXTRACTED FROM EACH WEBSITE UNDER IT
    Here are all the serp queries we did through query-generator agent by analyzing the user's initial prompt and the followup questions and answer that user gave us.
    ${db_research_data.serpQueries
        .map(
            (serpQuery) => `
    1. Serp query: "${serpQuery.query}"
    2. Objective of this query: "${serpQuery.objective}",
    3. At which depth this query was executed?: "${serpQuery.depth_level}"
    4. Parent Query of this query: "${serpQuery.parent_query_timestamp === 0
                    ? `None! This is top level query with depth "1".`
                    : db_research_data.serpQueries.find(
                        (x) => x.query_timestamp === serpQuery.parent_query_timestamp
                    )?.query
                }"
    5. Successfully scraped websites and content we got from each of these websites through website analyzer agent:
    ${serpQuery.successful_scraped_websites
                    .map(
                        (scraped_website) => `
           - Url: "${scraped_website.url}"
           - Description of the website: "${scraped_website.description}"
           - Relevance score of the content of this website meeting serp query objective out of 10: "${scraped_website.relevance_score
                            }" 
           - Does the content of this website meet the objective of the SERP query?: "${scraped_website.is_objective_met}"
           - Core content of this website from website analyzer agent: 
                ${scraped_website.core_content
                                .map(
                                    (cc) => `
                - ${cc}`
                                )
                                .join('\n')}
  
           - Facts and figures of this website from website analyzer agent: 
                ${scraped_website.facts_figures
                                .map(
                                    (ff) => `
                - ${ff}`
                                )
                                .join('\n')}
  
  
  ==========================================
  ==========================================
    `
                    )
                    .join('\n')}
  
    `
        )
        .join('\n')}`;




import fs from 'fs';
import { generateText } from 'ai';
import { HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Very simple function to save data
function saveData(data: string) {
    if (!fs.existsSync('data')) {
        fs.mkdirSync('data'); // Create 'data' folder if it doesn't exist
    }
    fs.writeFileSync('data/gemini.txt', data); // Save the data to 'file.txt'
    console.log('Data saved!');
}

// Example usage

// IMPORTANT: Do not remove the comment at all.
// Step 1: All the learnings from information crunching agent is passed here with detailed objective. The user's iniital query is also passed here for detailed report writing based on the user's query. Answering the user's percise query with to the point information.

// Step 2: The reponse from initial-report-agent is sent here along with all the learnings from information crunching agent and we include all the infomration missed by initial-report-agent based on the objective we have and the user demands.
// We need to make sure that the information missed by initial-report-agent is included is caught here and more detailed and comprehensive report is presented for final-report-agent.

// Step 3: Report from middle-report-agent is passed here along with all the learnings and conclusions we got and made during the deep research process. The report from both of these initial and middle report agent is also passed here. The user's initial query is also passed here and made sure that this final report is not missing any important infomration if it is present on the internet answering the precise question the user has asked.

import { generateObject } from '../ai/providers';
import { Schema, SchemaType } from '@google/generative-ai';
import { InformationCruncher } from './information-cruncher';
import { encode, isWithinTokenLimit } from 'gpt-tokenizer';
import { DBSchema } from '../db';
// import { encode } from 'gpt-tokenizer';
// import { InformationCruncher } from '../information-cruncher';


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
        db_research_data: DBResearchData
    }): Promise<ReportResult> {

        if (!params.db_research_data.serpQueries.length) {
            throw new Error('Invalid input: Missing serp queries');
        }

        const structuredPrompt = generateContextforReportWriterAgent(params.db_research_data);
        const tokens = encode(structuredPrompt);
        console.log(`Tokens: ${tokens.length}`);
        console.log("✍️✍️", structuredPrompt, "✅✅");

        // This schema is absolutely necessary for pushing data to database for the report section.
        // Every field is required to ensure Gemini doesn't miss any fields in the response.
        // The response must exactly match the database Report schema structure.
        const reportSchema: Schema = {
            type: SchemaType.OBJECT,
            properties: {
                title: {
                    type: SchemaType.STRING,
                    description: "Title of this report in 5-7 words that summarizes this entire report."
                },
                sections: {
                    type: SchemaType.ARRAY,
                    description: "Array of individual sections in the report. Each section must answer a specific question of the user in very detailed. Make sure each section is as much technically rich as possible.",
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            rank: {
                                type: SchemaType.NUMBER,
                                description: "The most important section much be rank 1 showing the important of the section in entire report. And this way we can show that section at first in the frontend. The most least important section must be rank last. Make sure these sections start from 1 to N."
                            },
                            sectionHeading: {
                                type: SchemaType.STRING,
                                description: "Title of the section in 3-5 words in markdown heading format. You must generate `sectionHeading` with `##` or `###` before the heading to maintain the markdown format."
                            },
                            content: {
                                type: SchemaType.STRING,
                                description: "This is the main content of the section. Make sure you use the full markdown feature to give this content. Since we already have section heading, you can directly start the main content. This content must be as much technically descriptive as possible. Feel free to go as much deep and as much detailed as possible. Make sure you are answer the exact question the user is asking within this section by being highly technical and detailed. Feel free to use ordered list, unordered list, bold, italic, code, etc. to make the content more engaging and detailed. Feel free to generate tables, diagrams, charts, etc. if the report demands. Keep in mind, do not hallucinate. What ever you write must be coming from a source. Don't use your own memory. Make sure the cite every sentence with exact urls whose content were used to write this section. Make sure the citations are numbered by their rank in citedUrls array. For citations use this exact format [rank_number_of_this_cited_url](https://example.com)."
                            }
                        },
                        required: ["rank", "sectionHeading", "content"]
                    }
                },
                citedUrls: {
                    type: SchemaType.ARRAY,
                    description: "Array of cited URLs used in the report. All the full urls that were considered to write this full report. All the urls that were used to write every sections of the report. Don't make the urls yourself. Whatever url you give in this array, it must be provided to you and must be used to write the content of the sections.",
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            rank: {
                                type: SchemaType.NUMBER,
                                description: "Url with 1 rank is the url with most citations in the entire report and multiple of these sections. Rank N will be the last url that is cited the least 1 or more than 1 in the entire report. Make sure to rank these urls accroding to their gravitas in the report."
                            },
                            url: {
                                type: SchemaType.STRING,
                                description: "Full url of the website that was used to write the content of the section."
                            },
                            title: {
                                type: SchemaType.STRING,
                                description: "Title of the website that was used to write the content of the section."
                            },
                            oneValueablePoint: {
                                type: SchemaType.STRING,
                                description: "One most important and highly valuable fact or figure from this source that meets our objective which shows the level of knowledge contribution of this source to the report."
                            }
                        },
                        required: ["rank", "url", "title", "oneValueablePoint"]
                    }
                }
            },
            required: ["title", "sections", "citedUrls"]
        };

        const { response } = await generateObject({
            system: `
    You are a Technical Research Report Writing Agent. Your task is to write a detailed technical report following the exact schema structure. Follow these strict rules:\n
      - Write in clear markdown format\n
      - Every section must have proper markdown headers (# for H1, ## for H2, ### for H3)
      - End of every statement must have a citation linking to citedUrls using ["rank"](actual url that_was given in the prompt from where the content was extracted) format. If the citations is multiple for single statement, then give multiple citations back to back as many sources you have used to write that statement.
      - Make sure every section is highly descriptive, overwhelminly long and technically rich as possible.
      - Citations must be numbered by their rank in citedUrls array
      - Each cited URL must have one valuable point extracted from it
      - Write in highly technical and detailed manner
      - Include all facts, figures, and technical specifications
      - Organize content into proper sections with appropriate ranks
      - Generate minimum of 10 sections. If the report demands more sections, you are free to generate how many sections you want. But make sure every section is highly long and technically rich.

      If you need to generate table for comparison purpose, use the following format:
      | Column Heading 1 | Column Heading 2|\n
      | - | - |\n
      | Row 1 first element | Row 1 second element |\n
      
      Always, Inside every table except the heading row, make sure content inside every row's column's content give the website citations.
      
      Finally, Every sentence you write must be absolutely cited to one or more websites.
      `,
            prompt: `
    Absolute Requirements:
    - Be highly technical and detailed. Be as technically detailed as possible answering every sinlge precise question the user has asked.
    - You don't have to explain everything jargons, write final report in a long and highly technical comprehensive way.
    - Use the exact URLs provided in the content for citations.

${structuredPrompt}

`,
            model: process.env.REPORT_WRITING_MODEL as string,
            generationConfig: {
                responseSchema: reportSchema
            }
        });

        const result = JSON.parse(response.text());
        return result;
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
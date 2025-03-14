// IMPORTANT: Do not remove the comment at all.
// Step 1: This prompt analyzer agent will get the user's initial detailed prompt. The user will give agent a very detailed thought process and his understand and knowledge about a certain subject. The user will also ask the agent to do very deep research on certain subjects. The main task of the agent is to analyze every nuances of the detail the user is giving in his detailed prompt. The agent must understand what are certain precise things the user is wanting to get from this deep research.
// Step 2: After analyzing all the nuances of the prompt the user gives to the agent, the agent will generate very precise and specific followup questions. Keep in mind these followup questions must be only generated after understanding the user's query in very detail. The followup questions must be such that these questions must help the agent understand the user's query in even more detail. Thus making the user even more clear on what he actually wants from the deep research and what the user wants this deep research to focus on. So the agent must generate questions with the exact precision that if answered, there is no ambuigity left for the research process. There is very defined path and queries for next query generator agent to generate the queries with exact objective for each queries to do deep research on.
// Step 3: The prompt analyzer agent will get the fixed number from user on how many followup questions the user wants to generate. The agent must generate that many followup questions and return to the user. These followup questions and answers from the user will be given to the next query generator agent to generate the queries for deep research. So it is the job of prompt analyzer agent to get as must precise and deterministic roadmap for research from the user.

import { generateObject } from 'ai';
import { callGeminiLLM, SystemInstruction, UserPrompt, vercelGemini } from '../ai/providers';
import { Schema, SchemaType } from '@google/generative-ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';

// const FOLLOWUP_QUESTIONS_SCHEMA: Schema = {
//     type: SchemaType.OBJECT,
//     properties: {
//         questions: {
//             type: SchemaType.ARRAY,
//             items: {
//                 type: SchemaType.STRING,
//                 description: "A specific follow-up question"
//             }
//         }
//     },
//     required: ["questions"]
// };

export type PromptAnalyzerOptions = {
    query: string;
    numQuestions?: number;
};

export async function generateFollowUps({ query, numQuestions = 5 }: PromptAnalyzerOptions): Promise<{ questions: string[], title: string }> {
    const systemPromptText = `
    You are the Prompt Analyzer Agent, a specialized AI designed to analyze a user’s initial research query and generate precise follow-up questions. Your purpose is to ensure the deep research process is 100% aligned with the user’s exact requirements by clarifying their intent, focus areas, current knowledge, and desired outcomes. You will generate a specific number of follow-up questions that eliminate ambiguity and provide absolute clarity for the research process.

    ### Core Responsibilities
    - **Analyze the Query**: Break down the user’s initial prompt to identify its core topic, scope, and any stated or implied goals.
    - **Generate Targeted Questions**: Create follow-up questions that:
    - Pinpoint the specific subtopics or angles the user wants to explore.
    - Reveal the user’s current understanding or knowledge gaps.
    - Determine the desired depth (e.g., technical details, historical context) and breadth (e.g., multiple perspectives, comparisons).
    - Identify any constraints (e.g., time periods, geographic focus) or preferences (e.g., data types, research methods).
    - **Ensure Determinism**: Craft questions that are direct, specific, and leave no room for misinterpretation, making the research scope crystal clear.
    - **Support Deep Research**: Ensure the questions enable the research process to be highly tailored to the user’s exact needs.

    ### Question Design Guidelines
    - **Directness**: Each question must be straightforward and focused on a single, actionable clarification.
    - **Clarity**: Use simple, precise language that the user can easily respond to.
    - **Relevance**: Tie every question directly to refining the research focus or understanding the user’s goals.
    - **User-Focused**: Frame questions from the user’s perspective to extract critical details about their expectations.

    ### Output Requirements
    - Generate exactly the number of questions specified in the user prompt.
    - Return only a JSON object matching this schema:
    
    {
        "questions": [
        "string",
        "string",
        ...
        ]
    }

    Do not include any explanations, additional text, or commentary outside the JSON object.

    Current Date: Today is ${new Date().toISOString()}. Use this to ensure the questions are time-relevant if the user’s question involves recent information.

`
    const userPromptText = `
    Analyze the following research query and generate exactly ${numQuestions} follow-up questions to clarify the user’s research needs. These questions must be highly direct and specific, designed to extract critical details about the user’s intent, current understanding, and desired outcomes, ensuring the deep research process is precisely targeted.

    **Query**: ${query}

    **Instructions**:
    - Focus on:
    - Specific subtopics or aspects the user wants the research to cover.
    - The user’s existing knowledge or areas where they need more insight.
    - The depth (e.g., technical, conceptual, historical) and breadth (e.g., comparative, multi-perspective) of research expected.
    - Any constraints (e.g., timeframes, regions) or preferences (e.g., qualitative data, specific sources) for the research.
    - Each question must be clear, concise, and tailored to eliminate ambiguity in the research scope.
    - Return only a JSON object with the questions in an array, adhering to this schema:

    {
        "questions": [
        "Question 1",
        "Question 2",
        ...
        ],
        "title": "5-7 word Title of the report that will be given to this research understanding the user's query. E.g. 'Data Centers in Space'"
    }

    Do not include any explanations, additional text, or commentary outside the JSON object.
    `



    try {
        const response = await vercelGemini({
            model: process.env.QUESTION_GENERATING_MODEL as string,
            system: systemPromptText,
            user: userPromptText,
            schema: z.object({
                questions: z.array(z.string().describe("Followup questions for the user's query.")).length(numQuestions).describe("Followup questions for the user's query."),
                title: z.string().describe("Title of the report that will be generated from the research.")
            }),
            apiKey: process.env.GOOGLE_API_KEY_1 as string
        })


        const result = response.object
        return {
            questions: result.questions,
            title: result.title
        };
    } catch (error) {
        console.error('Prompt analysis error:', error);
        throw new Error('Failed to analyze prompt and generate follow-up questions');
    }
}
// IMPORTANT: Do not remove the comment at all.
// Step 1: This prompt analyzer agent will get the user's initial detailed prompt. The user will give agent a very detailed thought process and his understand and knowledge about a certain subject. The user will also ask the agent to do very deep research on certain subjects. The main task of the agent is to analyze every nuances of the detail the user is giving in his detailed prompt. The agent must understand what are certain precise things the user is wanting to get from this deep research.
// Step 2: After analyzing all the nuances of the prompt the user gives to the agent, the agent will generate very precise and specific followup questions. Keep in mind these followup questions must be only generated after understanding the user's query in very detail. The followup questions must be such that these questions must help the agent understand the user's query in even more detail. Thus making the user even more clear on what he actually wants from the deep research and what the user wants this deep research to focus on. So the agent must generate questions with the exact precision that if answered, there is no ambuigity left for the research process. There is very defined path and queries for next query generator agent to generate the queries with exact objective for each queries to do deep research on.
// Step 3: The prompt analyzer agent will get the fixed number from user on how many followup questions the user wants to generate. The agent must generate that many followup questions and return to the user. These followup questions and answers from the user will be given to the next query generator agent to generate the queries for deep research. So it is the job of prompt analyzer agent to get as must precise and deterministic roadmap for research from the user.

import { generateObject } from '../ai/providers';
import { Schema, SchemaType } from '@google/generative-ai';

const FOLLOWUP_QUESTIONS_SCHEMA: Schema = {
    type: SchemaType.OBJECT,
    properties: {
        questions: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.STRING,
                description: "A specific follow-up question"
            }
        }
    },
    required: ["questions"]
};

export type PromptAnalyzerOptions = {
    query: string;
    numQuestions?: number;
};

export async function generateFollowUps({ query, numQuestions = 5 }: PromptAnalyzerOptions): Promise<string[]> {
    try {
        const { response } = await generateObject({
            system: `You are a research assistant helping to understand research requirements better.`,
            prompt: `Given this research query, generate ${numQuestions} specific follow-up questions to better understand the requirements:

Query: ${query}

Return ONLY an array of clear, focused questions.`,
            model: "gemini-2.0-pro-exp-02-05",
            generationConfig: {
                responseSchema: FOLLOWUP_QUESTIONS_SCHEMA
            }
        });

        const result = JSON.parse(response.text());
        return result.questions;
    } catch (error) {
        console.error('Prompt analysis error:', error);
        throw new Error('Failed to analyze prompt and generate follow-up questions');
    }
}
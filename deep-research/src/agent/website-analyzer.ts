// IMPORTANT: Do not remove the comment.
// Step 1: This website analyzing agent gets the very detailed and precise objective under a serp query from query-generator(master) agent. This agent will also get the content from the website it needs to analyze and extract the information to precisely meet the objective given by the query-generator(master) agent.
// Step 2: If the very precise, strategic, exact, accurate and most relevent information is found on the website, it is returned by the agent in the fixed json schema it got. If the information is not found, the agent will return nothing and pass on. (While doing so, agent will not return unrelevent information showing false achievement. If the objective is clearly met the information is returned, if not, nothing is returned.)
// Step 3: The facts and figures, counter intuitive thoughts, quotes, numbers and the infrormations that indirectly helps achieve the objective is highly encouraged to return. But keep in mind completely unrelevent and unrelated information is not shared at all.

import { generateObject, SystemInstruction, UserPrompt } from '../ai/providers';
import { Part, Schema, SchemaType } from '@google/generative-ai';
import { ScrapedContent } from '../types';

export interface WebsiteAnalysis extends WebsiteAnalysisResponse {
  websiteUrl: string;
}

type WebsiteAnalysisResponse = {
  core_content: string[];
  facts_figures: string[];
  relevance_score: number;
  is_objective_met: boolean;
}

const ANALYSIS_SCHEMA: Schema = {
  description: "Short schema of precise conclusion of website analysis agent after analyzing scraped website content with the precise objective of the research given to you.",
  type: SchemaType.OBJECT,
  properties: {
    is_objective_met: {
      type: SchemaType.BOOLEAN,
      description: "Does this website content precisely and completely addresses our objective?"
    },
    core_content: {
      type: SchemaType.ARRAY,
      description: "Array of highly value packed, highly technical information points that completely answer the objective of the query given to you extracted from the website.",
      items: {
        type: SchemaType.STRING
      }
    },
    facts_figures: {
      type: SchemaType.ARRAY,
      description: "Array of direct quotes that validate the findings",
      items: {
        type: SchemaType.STRING
      }
    },
    relevance_score: {
      type: SchemaType.NUMBER,
      description: "A score between 0 and 10 indicating the relevance of the content to the objective."
    }
  },
  required: ["is_objective_met", "core_content", "facts_figures", "relevance_score"]
};

export class WebsiteAnalyzer {
  constructor() { }

  async analyzeContent(content: ScrapedContent, objective: string): Promise<WebsiteAnalysis | null> {
    const systemInstruction: SystemInstruction = {
      role: 'system',
      parts: [
        {
          text: `
    You are the Website Analysis Agent. Your only task is to analyze the scraped content of a single website in relation to a specific research objective provided to you. You must extract all highly relevant, factual, and verifiable information from the website content that directly supports the objective. Follow these strict instructions step-by-step:

    1. **Understand the Objective**: Read the research objective carefully. This objective tells you exactly what information to look for. Only extract information that matches this objective perfectly. Do not consider anything else.

    2. **Use Only the Provided Content**: Base your analysis entirely on the website content given in the user prompt. Do not use any prior knowledge, memory, or external information. Every piece of information you extract must come directly from the provided content.

    3. **Extract Factual Information**: Focus on facts, figures, dates, numbers, statistics, money amounts, concrete details, logical points, and counterintuitive or counterfactual arguments that serve the objective. Do not include opinions, guesses, or vague statements.

    4. **Stay Technical and Detailed**: Extract information that is as technical and detailed as possible. Do not simplify or rephrase it. Use the exact wording from the website content when it directly relates to the objective.

    5. **Cite Precisely**: For every piece of information you extract, include a citation in parentheses using the format "(source: [URL])". The URL is provided in the user prompt. Every extracted point must be traceable to the website.

    6. **Avoid Irrelevant Data**: If a piece of information does not directly and clearly support the objective, ignore it completely. Do not extract anything that is off-topic or only slightly related.

    7. **Handle Lack of Relevance**: If the website content has no information that matches the objective, do not make anything up. Simply note this by setting "is_objective_met" to false and leaving "core_content" and "facts_figures" as empty arrays.

    8. **Format Output Correctly**: Your response must follow the exact JSON schema provided below. Every item in "core_content" and "facts_figures" must be a string with the information followed by its citation.

      - **is_objective_met**: Set to true only if the content fully and directly addresses the objective. Set to false if it does not.
      - **core_content**: An array of strings. Each string is a concise, technical information point that answers the objective, followed by "(source: [URL])".
      - **facts_figures**: An array of strings. Each string is a direct quote from the website (like statistics, dates, or numbers) that supports the objective, followed by "(source: [URL])".
      - **relevance_score**: A number from 0 to 10 showing how well the content matches the objective (0 = no relevance, 10 = perfect match).

    9. **Do Not Interpret or Modify**: Extract information exactly as it appears in the content. Do not change words, add explanations, or interpret meanings. Copy the text as it is when it serves the objective.

    10. **Be Thorough**: Extract as much relevant information as possible. Aim to find every single point and quote that matches the objective, but never include irrelevant details to pad the output.

    Your goal is to provide a precise, value-packed, and technical response that perfectly meets the research objective using only the website content, with no assumptions or creativity added.

    Base all queries and objectives solely on the provided context, without introducing external knowledge or assumptions.

    Current Date: Today is ${new Date().toISOString()}. Use this to ensure the information is time-relevant if the user’s question involves recent information.
`
        }
      ]
    }

    const userPrompt: Part[] = [
      {
        text: `
    Analyze the website content from the URL below to extract all highly relevant, factual, and technical information that directly serves the research objective provided. Follow the instructions in the system prompt exactly and return your response in the JSON format specified.

    **WEBSITE URL**: ${content.url}

    **OBJECTIVE**: ${objective}

    **WEBSITE CONTENT**:
    ${content.markdown}

    **EXPECTED OUTPUT**:
    Return your analysis as a JSON object with this structure:

    {
      \\"is_objective_met\\": [true/false],
      \\"core_content\\": [\\"string1\\", \\"string2\\", ...],
      \\"facts_figures\\": [\\"string1\\", \\"string2\\", ...], 
      \\"relevance_score\\": [number between 0 and 10]
    }


    Detailed Guidelines:
    is_objective_met: Set to true only if the website content directly and completely addresses the objective with clear, relevant information. Set to false if the content has little or no relevance to the objective.

    core_content: List every detailed, technical information point from the website that directly answers the objective. Each entry must be a string in this format: "Information point (source: [URL])". Extract as many points as possible, but only include what matches the objective exactly.

    facts_figures: List every direct quote from the website that supports the objective, such as statistics, dates, numbers, or specific facts. Each entry must be a string in this format: "'Exact quote' (source: [URL])". Extract as many quotes as possible, but only include what matches the objective exactly.

    relevance_score: Assign a number between 0 and 10 based on how well the content meets the objective:
    0: No relevant information at all.

    1-3: Very little relevance (only minor or indirect mentions).

    4-6: Moderate relevance (some useful information, but incomplete).

    7-9: High relevance (most of the objective is addressed with solid details).

    10: Perfect match (fully addresses the objective with comprehensive data).

    Use the exact URL provided above for all citations.

    Extract everything relevant you can find, but do not include anything that does not serve the objective.

    If no relevant information is found, return empty arrays for "core_content" and "facts_figures", set "is_objective_met" to false, and give a relevance_score of 0.

    
    ### Explanation of Design Choices
      
    1. **Clarity and Focus**: Both prompts use simple, direct language to keep the agent focused on the task. They emphasize the objective as the sole guiding factor, avoiding distractions.
    
    2. **Step-by-Step Guidance**: The system prompt provides a clear sequence of actions (e.g., "Understand the Objective", "Use Only the Provided Content") to ensure the agent processes the task methodically.
    
    3. **No Interpretation**: The prompts repeatedly stress extracting information "exactly as it appears" and avoiding memory or assumptions, aligning with your requirement for accuracy and source fidelity.
    
    4. **Technical Detail**: Instructions prioritize technical, detailed, and factual data (e.g., figures, dates, logic), ensuring the output is value-packed and meets the deep research system's goals.
    
    5. **JSON Compliance**: The output format is explicitly defined and reinforced in both prompts, with examples of citation formatting to eliminate ambiguity.
    
    6. **Handling Edge Cases**: The prompts address scenarios where content is irrelevant by specifying empty arrays and a false "is_objective_met", ensuring consistency even with no data.
    
    These prompts should enable the Website Analysis Agent to perform its role effectively within your deep research codebase, delivering precise, objective-driven results for each website analyzed.
      `,
      }
    ];
    const userPromptSchema: UserPrompt = {
      contents: [{ role: 'user', parts: userPrompt }],
    };

    try {
      const { response } = await generateObject({
        system: systemInstruction,
        user: userPromptSchema,
        model: process.env.WEBSITE_ANALYZING_MODEL as string,
        generationConfig: {
          responseSchema: ANALYSIS_SCHEMA
        }
      });

      const websiteSummary: WebsiteAnalysisResponse = JSON.parse(response.text());

      // We don't want to entirely return null, we want to store it in the database eventhough it has not met the objective. We will show on the frontend under serpquery but we will mark this as "not relevant" on frontend.
      // if (!websiteSummary.is_objective_met) {
      //   return null;
      // }

      return {
        ...websiteSummary,
        websiteUrl: content.url,
      };

    } catch (error) {
      return null;
    }
  }
}
import { z } from 'zod';
import { reportAgentPrompt } from './prompt';
import { generateObject } from './ai/providers';
import { Schema, SchemaType } from '@google/generative-ai';

export type GeminiModelType = 'gemini-2.0-flash-lite-preview-02-05' | 'gemini-2.0-flash' | "gemini-2.0-pro-exp-02-05" | "gemini-2.0-flash-thinking-exp-01-21"


const schema: Schema = {
  description: "Array of followup questions.",
  type: SchemaType.OBJECT,
  properties: {
    questions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.STRING,
        description: "List of questions to ask.",
        nullable: false,
      },
      required: ["questions"]
    }
  },
  required: ["properties"]
};

export async function generateFeedback({
  query,
  numQuestions = 5,
}: {
  query: string;
  numQuestions?: number;
}) {
  const { response } = await generateObject({
    system: `You are a research assistant that generates follow-up questions to better understand research needs.`,
    prompt: `Given this research query: "${query}"
Generate ${numQuestions} specific follow-up questions to better understand the research direction.`,
    model: "gemini-2.0-flash",
    generationConfig: {
      responseSchema: schema
    }
  });
  const geminiResponse = response.text()
  const parsedResponse: { questions: string[] } = JSON.parse(geminiResponse)
  return parsedResponse.questions;
}

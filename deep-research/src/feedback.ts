import { generateObject } from './ai/providers';
import { Schema, SchemaType } from '@google/generative-ai';

export type GeminiModelType = 'gemini-2.0-flash-lite-preview-02-05' | 'gemini-2.0-flash' | "gemini-2.0-pro-exp-02-05" | "gemini-2.0-flash-thinking-exp-01-21"

const schema: Schema = {
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

export async function generateFeedback({
  query,
  numQuestions = 5,
}: {
  query: string;
  numQuestions?: number;
}) {
  try {
    const { response } = await generateObject({
      system: `You are a research assistant helping to understand research requirements better.`,
      prompt: `Given this research query, generate ${numQuestions} specific follow-up questions to better understand the requirements:

Query: ${query}

Return ONLY an array of clear, focused questions.`,
      model: "gemini-2.0-pro-exp-02-05",
      generationConfig: {
        responseSchema: schema
      }
    });

    const result = JSON.parse(response.text());
    return result.questions;
  } catch (error) {
    console.error('Feedback generation error:', error);
    throw new Error('Failed to generate follow-up questions');
  }
}

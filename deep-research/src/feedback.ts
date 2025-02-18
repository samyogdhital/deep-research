import { generateObject } from './ai';
import { z } from 'zod';
import { systemPrompt } from './prompt';

export type GeminiModelType = 'gemini-2.0-flash-lite-preview-02-05' | 'gemini-2.0-flash' | "gemini-2.0-pro-exp-02-05" | "gemini-2.0-flash-thinking-exp-01-21"

export async function generateFeedback({
  query,
  numQuestions = 5,
  model
}: {
  query: string;
  numQuestions?: number;
  model: GeminiModelType
}) {
  const userFeedback = await generateObject({
    system: `You are a research assistant that generates follow-up questions to better understand research needs.`,
    prompt: `Given this research query: "${query}"
Generate ${numQuestions} specific follow-up questions to better understand the research direction.`,
    schema: z.object({
      questions: z.array(z.string()).min(1).max(numQuestions)
    }),
    model: "gemini-2.0-flash"
  });

  return userFeedback.object.questions;
}

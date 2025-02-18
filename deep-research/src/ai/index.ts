import { z } from 'zod';
import { modelProvider } from './providers';
import { GeminiModelType } from '../feedback';

export type GenerateObjectParams<T extends z.ZodType> = {
  system: string;
  prompt: string;
  schema: T;
  abortSignal?: AbortSignal;
  model?: GeminiModelType; 
  provider?: "gemini-2.0-flash-lite-preview-02-05" | "gemini-2.0-flash"| "gemini-2.0-flash-thinking-exp-01-21" ; 
};

export async function generateObject<T extends z.ZodType>(
  params: GenerateObjectParams<T>
): Promise<{ object: z.infer<T> }> {
  const enhancedParams = {
    ...params,
    provider: params.provider,
  };
  return modelProvider.getCurrentProvider().generateObject(enhancedParams);
}

export { modelProvider, trimPrompt } from './providers';

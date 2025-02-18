import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

export interface AIProvider {
  generateObject<T extends z.ZodType>(params: {
    system: string;
    prompt: string;
    schema: T;
    model?: string;
  }): Promise<{ object: z.infer<T> }>;
}

class GeminiProvider implements AIProvider {
  private apiKeys: string[];
  private currentKeyIndex: number;
  private rateLimitCooldown: Map<string, number>;

  constructor(apiKeys: string[]) {
    if (!apiKeys.length) throw new Error('At least one API key required');
    this.apiKeys = apiKeys;
    this.currentKeyIndex = 0;
    this.rateLimitCooldown = new Map();
  }

  private async getNextAvailableKey(): Promise<string> {
    const now = Date.now();

    // Try all keys in sequence
    for (let i = 0; i < this.apiKeys.length; i++) {
      const nextIndex = (this.currentKeyIndex + i) % this.apiKeys.length;
      const key = this.apiKeys[nextIndex] as string;
      const cooldownUntil = this.rateLimitCooldown.get(key) || 0;

      if (cooldownUntil <= now) {
        this.currentKeyIndex = nextIndex;
        return key;
      }
    }

    // If all keys are on cooldown, wait for the earliest one
    const earliestAvailable = Math.min(...Array.from(this.rateLimitCooldown.values()));
    await new Promise(resolve => setTimeout(resolve, earliestAvailable - now));
    return this.getNextAvailableKey();
  }

  async generateObject<T extends z.ZodType>(params: {
    system: string;
    prompt: string;
    schema: T;
    model?: string;
  }): Promise<{ object: z.infer<T> }> {
    const apiKey = await this.getNextAvailableKey();
    const googleAI = new GoogleGenerativeAI(apiKey);

    try {
      const model = googleAI.getGenerativeModel({
        model: params.model || 'gemini-2.0-flash',
      });

      const structuredPrompt = `${params.system}

IMPORTANT: You MUST return ONLY a raw JSON object matching this schema, with NO markdown formatting, NO \`\`\` code blocks, and NO explanations:

${JSON.stringify(params.schema.shape, null, 2)}

Your task:
${params.prompt}`;

      const result = await model.generateContent(structuredPrompt);
      const response = result.response.text();

      // Remove any markdown code block wrapping if present
      const cleanJson = response.replace(/^```(?:json)?\n|\n```$/g, '').trim();

      try {
        const object = JSON.parse(cleanJson);
        return { object: params.schema.parse(object) };
      } catch (parseError) {
        console.error('Raw response:', response);
        console.error('Cleaned response:', cleanJson);
        throw parseError;
      }

    } catch (error: any) {
      if (error.message?.includes('429')) {
        this.rateLimitCooldown.set(apiKey, Date.now() + 120000);
        return this.generateObject(params);
      }
      throw error;
    }
  }
}

class ModelProvider {
  private static instance: ModelProvider;
  private provider: AIProvider;

  private constructor() {
    const apiKeys = [
      process.env.GOOGLE_API_KEY_1,
      process.env.GOOGLE_API_KEY_2,
      process.env.GOOGLE_API_KEY_3,
      process.env.GOOGLE_API_KEY_4,
      process.env.GOOGLE_API_KEY_5,
    ].filter(Boolean) as string[];

    this.provider = new GeminiProvider(apiKeys);
  }

  static getInstance(): ModelProvider {
    if (!ModelProvider.instance) {
      ModelProvider.instance = new ModelProvider();
    }
    return ModelProvider.instance;
  }

  getCurrentProvider(): AIProvider {
    return this.provider;
  }
}

export const modelProvider = ModelProvider.getInstance();

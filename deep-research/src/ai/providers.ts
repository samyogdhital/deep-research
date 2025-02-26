import { GenerateContentRequest, GenerateContentResult, GenerativeModel, GoogleGenerativeAI, HarmBlockThreshold, HarmCategory, ModelParams } from '@google/generative-ai';



export type GenerateObjectParams = ModelParams & {
  system: string
  prompt: string;
}
// Signature for some class to implement
export interface AIProvider {
  generateObject(params: GenerateObjectParams
  ): Promise<GenerateContentResult>;
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

  async generateObject(params: GenerateObjectParams): Promise<GenerateContentResult> {
    const apiKey = await this.getNextAvailableKey();
    const genAI = new GoogleGenerativeAI(apiKey);

    try {

      const model = genAI.getGenerativeModel({
        ...params,
        model: params.model || "gemini-2.0-flash",
        generationConfig: {
          ...params.generationConfig,
          responseMimeType: "application/json",
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
        ],
        systemInstruction: params.system
      });

      return await model.generateContent(params.prompt);
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
      process.env.GOOGLE_API_KEY_6,
      process.env.GOOGLE_API_KEY_7,
      process.env.GOOGLE_API_KEY_8,
      process.env.GOOGLE_API_KEY_9,
      process.env.GOOGLE_API_KEY_10,
      process.env.GOOGLE_API_KEY_11,
      process.env.GOOGLE_API_KEY_12,
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

const provider = ModelProvider.getInstance().getCurrentProvider();
export const generateObject = (params: GenerateObjectParams) => provider.generateObject(params);
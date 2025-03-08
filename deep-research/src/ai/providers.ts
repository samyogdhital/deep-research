import { GenerateContentRequest, GenerateContentResult, GenerativeModel, GoogleGenerativeAI, HarmBlockThreshold, HarmCategory, ModelParams } from '@google/generative-ai';
import PQueue from 'p-queue';


export type SystemInstruction = ModelParams["systemInstruction"]
export type UserPrompt = Parameters<GenerativeModel["generateContent"]>[0]

export type GenerateObjectParams = ModelParams & {
  system: SystemInstruction;
  user: UserPrompt;
}
// Signature for some class to implement
export interface AIProvider {
  generateObject(params: GenerateObjectParams
  ): Promise<GenerateContentResult>;
}



class GeminiProvider implements AIProvider {
  private apiKeys: string[];
  private currentKeyIndex: number;

  constructor(apiKeys: string[]) {
    if (!apiKeys.length) throw new Error('At least one API key required');
    this.apiKeys = apiKeys;
    this.currentKeyIndex = 0;
  }

  async generateObject(params: GenerateObjectParams): Promise<GenerateContentResult> {
    const getCurrentKey = () => {
      const key = this.apiKeys[this.currentKeyIndex];
      if (!key) throw new Error('No API key available');
      return key;
    };

    const moveToNextKey = () => {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      console.log(`🔄 Switching to next API key: ${getCurrentKey()}`);
    };

    const generateWithRetry = async (): Promise<GenerateContentResult> => {
      try {
        const apiKey = getCurrentKey();
        console.log(`🔃🔃 Using API key: ${apiKey}`);

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          ...params,
          model: params.model || "gemini-2.0-flash",
          systemInstruction: params.system,
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
        });

        return await model.generateContent(params.user);
      } catch (error: any) {
        if (error.message?.includes('429')) {
          console.log(`⏳ Rate limited. Waiting 90s before switching to next API key...`);
          await new Promise(resolve => setTimeout(resolve, 90000)); // Wait 1.5 minutes
          moveToNextKey();
          return generateWithRetry(); // Try again with next key
        }
        throw error;  // Non-429 errors are thrown immediately
      }
    };

    return generateWithRetry();
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

const queue = new PQueue({
  concurrency: 20,     // Only one task at a time
  interval: 2000,     // 2 second interval
  intervalCap: 20,     // One task per interval
  throwOnTimeout: false,
  timeout: 1000 * 60 * 60 * 24
});

// Add better queue monitoring
queue.on('active', () => {
  console.log(`🔄 Processing API call... (Queue size: ${queue.size}, Pending: ${queue.pending}, Running: ${queue.pending - queue.size})`);
});

queue.on('error', (error: Error) => {
  console.error('Queue error:', error);
});

queue.on('idle', () => {
  console.log('✅ All API calls completed');
});

// Add task completion monitoring
queue.on('completed', (result: GenerateContentResult) => {
  if (!result) {
    console.error('❌ Task completed but no result');
    return;
  }
  console.log('✅ API call completed successfully');
});

const provider = ModelProvider.getInstance().getCurrentProvider();
export const generateObject = (params: GenerateObjectParams) =>
  queue.add(() => provider.generateObject(params)) as Promise<GenerateContentResult>;
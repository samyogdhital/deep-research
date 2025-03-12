import { GenerateContentRequest, GenerateContentResult, GenerativeModel, GoogleGenerativeAI, HarmBlockThreshold, HarmCategory, ModelParams } from '@google/generative-ai';
import PQueue from 'p-queue';
import { generateObject, GenerateObjectResult, LanguageModel, Schema } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { createMistral } from '@ai-sdk/mistral';
import { createCohere } from '@ai-sdk/cohere';
import { createGroq } from '@ai-sdk/groq';
import { createCerebras } from '@ai-sdk/cerebras';
import { isWithinTokenLimit } from 'gpt-tokenizer';


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
          model: params.model,
          systemInstruction: params.system,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.5,
            ...params.generationConfig,
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
            {
              category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            // {
            //   category: HarmCategory.HARM_CATEGORY_UNSPECIFIED,
            //   threshold: HarmBlockThreshold.BLOCK_NONE,
            // },
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
export const callGeminiLLM = (params: GenerateObjectParams) =>
  queue.add(() => provider.generateObject(params)) as Promise<GenerateContentResult>;




// import { Cohere, CohereClientV2 } from "cohere-ai";
// import { ChatResponse, JsonResponseFormat } from 'cohere-ai/api';
// const cohereClient = new CohereClientV2({
//   token: "ME98yNtI71dgClRu3YaED7tq1LhKiiRdIhsbDjUt",
// });

// export const cohere = async ({ system, user, responseFormat }: { system: string, user: string, responseFormat: Cohere.ResponseFormatV2 }): Promise<ChatResponse> => {
//   return cohereClient.chat({
//     model: "command-r-plus",
//     messages: [
//       {
//         role: "system",
//         content: system,
//       },
//       {
//         role: "user",
//         content: [
//           {
//             type: "text",
//             text: user,
//           }
//         ],
//       }
//     ],
//     responseFormat: responseFormat
//   })
// };



// const groqClient = new Groq({
//   apiKey: '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',
// });
// export const groq = async ({ system, user, responseSchema }: { system: string, user: string, responseSchema: object }): Promise<ChatCompletion> => {
//   return groqClient.chat.completions.create({
//     messages: [
//       { role: 'system', content: system + `\n Please follow this json schema: ${JSON.stringify(responseSchema)}` },
//       { role: 'user', content: user }
//     ],
//     model: 'llama-3.3-70b-versatile',
//     response_format: {
//       type: "json_object",
//     },
//   });
// }

// const mistralClient = new Mistral({ apiKey: "iR3yjx5aSCHhW6zFjIHgNlAGYaqXgLaN" });
// export const mistral = async ({ system, user, responseSchema: responseSchema }: { system: string, user: string, responseSchema: object }) => {
//   return mistralClient.chat.complete({
//     messages: [{ role: 'system', content: system + `\n Please follow this json schema: ${JSON.stringify(responseSchema)}` }, { role: 'user', content: user }],
//     model: 'mistral-large-latest',
//     responseFormat: {
//       type: "json_object",
//     }
//   });
// }



// const google = createGoogleGenerativeAI({
//   apiKey: 'AIzaSyB3rOnlPl5E4WFQxd5p-DNrZmZx8ONw7GA' as string,

// })

// const model = google("gemini-2.0-flash", {
//   structuredOutputs: true
// })

// Keep track of current API key index
let currentKeyIndex = 0;

// Create a shared queue for all vercelGemini calls
const vercelGeminiQueue = new PQueue({
  concurrency: 20,
  interval: 2000,
  intervalCap: 20,
  throwOnTimeout: false,
  timeout: 1000 * 60 * 60 * 24
});

vercelGeminiQueue.on('active', () => {
  console.log(`🔄 Processing Vercel Gemini API call... (Queue size: ${vercelGeminiQueue.size}, Pending: ${vercelGeminiQueue.pending}, Running: ${vercelGeminiQueue.pending - vercelGeminiQueue.size})`);
});

vercelGeminiQueue.on('error', (error: Error) => {
  console.error('Vercel Gemini Queue error:', error);
});

vercelGeminiQueue.on('idle', () => {
  console.log('✅ All Vercel Gemini API calls completed');
});

vercelGeminiQueue.on('completed', (result) => {
  if (!result) {
    console.error('❌ Vercel Gemini task completed but no result');
    return;
  }
  console.log('✅ Vercel Gemini API call completed successfully');
});

export async function vercelGemini<OBJECT>({ model, system, user, schema, apiKey, structuredOutputs = true }: {
  model: string;
  system: string;
  user: string;
  schema: z.Schema<OBJECT, z.ZodTypeDef, any> | Schema<OBJECT>;
  apiKey: string;
  structuredOutputs?: boolean;
}): Promise<GenerateObjectResult<OBJECT>> {
  const google = createGoogleGenerativeAI({
    apiKey: apiKey
  });

  const geminiModel = google(model, {
    structuredOutputs: structuredOutputs,
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
      {
        category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ]
  });

  return await generateObject({
    model: geminiModel,
    system,
    prompt: user,
    mode: "json",
    schema,
  }) as GenerateObjectResult<OBJECT>;
}


// const mistral = createMistral({
//   apiKey: "iR3yjx5aSCHhW6zFjIHgNlAGYaqXgLaN"
// });
export async function vercelMistral<OBJECT>({ system, user, schema, apiKey }: {
  system: string,
  user: string,
  schema: z.Schema<OBJECT, z.ZodTypeDef, any> | Schema<OBJECT>,
  apiKey: string
}): Promise<GenerateObjectResult<OBJECT>> {
  return await generateObject({
    model: createMistral({ apiKey })("mistral-large-latest"),
    prompt: user,
    system: system,
    mode: "json",
    schema: schema,
  });
}


// I have 12 api keys for cohere
// COHERE_API_KEY_1
// COHERE_API_KEY_2
// COHERE_API_KEY_3
// COHERE_API_KEY_4
// COHERE_API_KEY_5
// COHERE_API_KEY_6
// COHERE_API_KEY_7
// COHERE_API_KEY_8
// COHERE_API_KEY_9
// COHERE_API_KEY_10
// COHERE_API_KEY_11
// COHERE_API_KEY_12
export async function vercelCohere<OBJECT>({ system, user, schema, apiKey }: {
  system: string,
  user: string,
  schema: z.Schema<OBJECT, z.ZodTypeDef, any> | Schema<OBJECT>,
  apiKey: string
}): Promise<GenerateObjectResult<OBJECT>> {
  return await generateObject({
    model: createCohere({ apiKey })("command-r-plus-08-2024"),
    prompt: user,
    system: system,
    // mode: "json",
    schema: schema,
  });
}


// I have 12 api keys for groq
// GROQ_API_KEY_1
// GROQ_API_KEY_2
// GROQ_API_KEY_3
// GROQ_API_KEY_4
// GROQ_API_KEY_5
// GROQ_API_KEY_6
// GROQ_API_KEY_7
// GROQ_API_KEY_8
// GROQ_API_KEY_9
// GROQ_API_KEY_10
// GROQ_API_KEY_11
// GROQ_API_KEY_12
export async function vercelGroq<OBJECT>({ system, user, schema, apiKey }: {
  system: string,
  user: string,
  schema: z.Schema<OBJECT, z.ZodTypeDef, any> | Schema<OBJECT>,
  apiKey: string
}): Promise<GenerateObjectResult<OBJECT>> {
  return await generateObject({
    model: createGroq({ apiKey })("llama-3.3-70b-versatile"),
    prompt: user,
    system: system,
    mode: "json",
    schema: schema,
  });
}

// I have 2 api keys
// CEREBRAS_API_KEY_1
// CEREBRAS_API_KEY_2
export async function vercelCerebras<OBJECT>({ system, user, schema, apiKey }: {
  system: string,
  user: string,
  schema: z.Schema<OBJECT, z.ZodTypeDef, any> | Schema<OBJECT>,
  apiKey: string
}): Promise<GenerateObjectResult<OBJECT>> {
  return await generateObject({
    model: createCerebras({ apiKey })("llama-3.3-70b"),
    prompt: user,
    system: system,
    mode: "json",
    schema: schema,
  });
}

// Shared queue for all ultimateModel calls
const ultimateModelQueue = new PQueue({
  concurrency: 5,     // Max 5 parallel executions
  interval: 1000,     // Check queue every second
  intervalCap: 5,     // Process up to 5 tasks per interval
  throwOnTimeout: false,
  timeout: 1000 * 60 * 60 * 24  // 24 hour timeout
});

// Queue monitoring
ultimateModelQueue.on('active', () => {
  console.log(`🔄 Processing ultimateModel call... (Queue size: ${ultimateModelQueue.size}, Pending: ${ultimateModelQueue.pending}, Running: ${ultimateModelQueue.pending - ultimateModelQueue.size})`);
});

ultimateModelQueue.on('completed', (result) => {
  console.log('✅ ultimateModel call completed successfully');
});

// Model configurations
const MODEL_CONFIGS = {
  cerebras: { cooldownTime: 70000, keys: ['CEREBRAS_API_KEY_1', 'CEREBRAS_API_KEY_2'].map(k => process.env[k]).filter(Boolean) },
  groq: { cooldownTime: 70000, keys: Array.from({ length: 12 }, (_, i) => process.env[`GROQ_API_KEY_${i + 1}`]).filter(Boolean) },
  // cohere: { cooldownTime: 120000, keys: Array.from({ length: 12 }, (_, i) => process.env[`COHERE_API_KEY_${i + 1}`]).filter(Boolean) },
  gemini: { cooldownTime: 120000, keys: Array.from({ length: 12 }, (_, i) => process.env[`GOOGLE_API_KEY_${i + 1}`]).filter(Boolean) },
  mistral: { cooldownTime: 120000, keys: [process.env.MISTRAL_API_KEY].filter(Boolean) }
} as const;

// Track model states
const modelStates = new Map(Object.entries(MODEL_CONFIGS).map(([model, config]) => [
  model,
  {
    cooldownUntil: 0,
    keys: [...config.keys],
    currentKeyIndex: 0
  }
]));

type ModelType = keyof typeof MODEL_CONFIGS;

export async function ultimateModel<OBJECT>({ system, user, schema }: {
  system: string,
  user: string,
  schema: z.Schema<OBJECT, z.ZodTypeDef, any> | Schema<OBJECT>
}): Promise<GenerateObjectResult<OBJECT>> {
  return ultimateModelQueue.add(async () => {
    const isWithin7k = isWithinTokenLimit(system + user, 7000);
    const isWithin30k = isWithinTokenLimit(system + user, 30000);

    // Get available models based on token length
    const getAvailableModels = (): ModelType[] => {
      if (!isWithin30k) return ['gemini', 'mistral'];
      if (!isWithin7k) return [
        // 'cohere',

        'gemini', 'mistral'];
      return ['cerebras', 'groq',

        // 'cohere', 

        'gemini', 'mistral'];
    };

    // Check if model is in cooldown
    const isModelAvailable = (model: ModelType) => {
      const state = modelStates.get(model);
      return state && Date.now() >= state.cooldownUntil;
    };

    // Handle rate limit for a model
    const handleRateLimit = (model: ModelType) => {
      const state = modelStates.get(model)!;
      const config = MODEL_CONFIGS[model];

      state.cooldownUntil = Date.now() + config.cooldownTime;
      state.currentKeyIndex = (state.currentKeyIndex + 1) % state.keys.length;
    };

    // Try to execute with a model
    const tryExecuteWithModel = async (model: ModelType): Promise<GenerateObjectResult<OBJECT> | null> => {
      const state = modelStates.get(model)!;
      const apiKey = state.keys[state.currentKeyIndex];

      if (!apiKey) {
        handleRateLimit(model);
        return null;
      }

      try {
        console.log("🔃🔃", `Using ${model} model`, `Using API key: ${apiKey}`);
        switch (model) {
          case 'cerebras':
            if (!apiKey) return null;
            return await vercelCerebras({ system, user, schema, apiKey });
          case 'groq':
            if (!apiKey) return null;
            return await vercelGroq({ system, user, schema, apiKey });
          // case 'cohere':
          //   if (!apiKey) return null;
          //   return await vercelCohere({ system, user, schema, apiKey });
          case 'gemini':
            if (!apiKey) return null;
            return await vercelGemini({ model: "gemini-2.0-flash", system, user, schema, apiKey });
          case 'mistral':
            if (!apiKey) return null;
            return await vercelMistral({ system, user, schema, apiKey });
        }
      } catch (error: any) {
        if (error.message?.includes('429')) {
          handleRateLimit(model);
          return null;
        }
        throw error;
      }
    };

    // Main execution loop
    while (true) {
      const availableModels = getAvailableModels();
      let selectedModel: ModelType | null = null;

      // Always check from highest priority first
      for (const model of availableModels) {
        if (isModelAvailable(model)) {
          selectedModel = model;
          break; // Found highest priority available model
        }
      }

      if (selectedModel) {
        const result = await tryExecuteWithModel(selectedModel);
        if (result) return result;
        // If we get here, the model failed (probably rate limited)
        // Loop will continue and try next priority model
        continue;
      }

      // If we get here, all models are in cooldown
      // Wait for the shortest cooldown to expire
      const nextAvailable = Math.min(
        ...Array.from(modelStates.values()).map(s => s.cooldownUntil)
      );
      await new Promise(resolve => setTimeout(resolve, Math.max(0, nextAvailable - Date.now())));
      // After waiting, loop will restart and check high priority models first
    }
  }) as Promise<GenerateObjectResult<OBJECT>>;
}
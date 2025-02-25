// IMPORTANT: Do not remove the comment.
// Step 1: This website analyzing agent gets the very detailed and precise objective under a serp query from query-generator(master) agent. This agent will also get the content from the website it needs to analyze and extract the information to precisely meet the objective given by the query-generator(master) agent.
// Step 2: If the very precise, strategic, exact, accurate and most relevent information is found on the website, it is returned by the agent in the fixed json schema it got. If the information is not found, the agent will return nothing and pass on. (While doing so, agent will not return unrelevent information showing false achievement. If the objective is clearly met the information is returned, if not, nothing is returned.)
// Step 3: The facts and figures, counter intuitive thoughts, quotes, numbers and the infrormations that indirectly helps achieve the objective is highly encouraged to return. But keep in mind completely unrelevent and unrelated information is not shared at all.

import { generateObject } from '../ai/providers';
import { Schema, SchemaType } from '@google/generative-ai';
import { OutputManager } from '../output-manager';
import { ScrapedContent } from '../firecrawl';

export interface WebsiteAnalysis {
  content: string;
  sourceUrl: string;
  sourceText: string;
  meetsObjective: boolean;
}

const ANALYSIS_SCHEMA: Schema = {
  description: "Short schema of precise conclusion of website analysis agent after analyzing scraped website content with the precise objective of the research given to you.",
  type: SchemaType.OBJECT,
  properties: {
    isRelevant: {
      type: SchemaType.BOOLEAN,
      description: "Does this website content precisely and completely addresses our objective?"
    },
    extractedInfo: {
      type: SchemaType.STRING,
      description: "Highly value packed, highly technical information that completely answering the objective of the query given to you extracted from the website."
    },
    supportingQuote: {
      type: SchemaType.STRING,
      description: "Direct quote that validates the findings"
    }
  },
  required: ["isRelevant", "extractedInfo", "supportingQuote"]
};

export class WebsiteAnalyzer {
  private output: OutputManager;

  constructor(output: OutputManager) {
    this.output = output;
  }

  private log(...args: any[]) {
    this.output.log(...args);
  }

  async analyzeContent(content: ScrapedContent, objective: string): Promise<WebsiteAnalysis | null> {
    this.output.log(`Analyzing website: ${content.url}`);
    this.log(`Started analyzing website: ${content.url}`, "🚀🚀");

    try {
      const { response } = await generateObject({
        system: `You are the Website Analysis Agent. Your task is to review the scraped content of a given website in relation to a specific research objective and extract all relevant, factual, and verifiable information. Only include details that directly contribute to the research objective. Today is ${new Date().toISOString()}. Follow these instructions when responding:

Requirements:
- Compare the website's content against the provided research objective.
- Extract and list only factual information that clearly supports the objective.
- For each extracted point, include a precise citation (e.g., the URL or reference from the website).
- Give highly value packed points taken from website content that precisely meets the given objective to you. Make it at technical and as detailed as possible. Do not miss any important points, facts and figures if they serve to the given objective.
- Do not generate any additional commentary, opinions, or assumptions. If a section of the content is irrelevant, simply note its lack of relevance.
- Do not give your opinion. Do not hallucinate, whatever you will give as response, must be entire taken from the website content.`,
        prompt: `Analyze the website and give me all the highly value packed, highly relevent information that precisely serves below objective of the query.:

OBJECTIVE: ${objective}

CONTENT:
${content.markdown}

After you analyze this content with the given objective, you need to return given response in json format.
Return:
1. isRelevant: true only if content directly addresses objective, if the website is not related to the objective at all, it should be false.
2. extractedInfo: important key findings highly relevent to the objective.
3. supportingQuote: any supporting quote that directly serve the objective.`,
        model: process.env.WEBSITE_ANALYZING_MODEL as string,
        generationConfig: {
          responseSchema: ANALYSIS_SCHEMA
        }
      });

      const websiteSummary: { isRelevant: boolean; extractedInfo: string, supportingQuote: string } = JSON.parse(response.text());

      if (!websiteSummary.isRelevant) {
        this.log(`Completed analyzing website: ${content.url} - Not relevant😔😔`);
        return null;
      }

      this.log(`Completed analyzing website: ${content.url} - Relevant 😀😀✅✅`);
      return {
        content: websiteSummary.extractedInfo,
        sourceUrl: content.url,
        sourceText: websiteSummary.supportingQuote,
        meetsObjective: true
      };

    } catch (error) {
      this.log(`Error analyzing content from ${content.url} 😭😭 :`, error);
      return null;
    }
  }
}
// import pLimit from 'p-limit';
import { HarmBlockThreshold, HarmCategory, Schema, SchemaType } from '@google/generative-ai';

// import { reportAgentPrompt } from './prompt';
import { OutputManager } from './output-manager';
import { generateObject } from './ai/providers';

// Initialize output manager for coordinated console/progress output
export const output = new OutputManager();

// Allow the server to set the broadcast function
export function setBroadcastFn(broadcastFn: (message: string) => void) {
  // Directly update the broadcastFn on the output instance
  output['broadcastFn'] = broadcastFn;
}

// Replace console.log with output.log
function log(...args: any[]) {
  output.log(...args);
}

// increase this if you have higher API rate limits
const ConcurrencyLimit = 1;


// Update generateQueriesWithObjectives to use SchemaType
async function generateQueriesWithObjectives(context: string, numQueries: number): Promise<QueryWithObjective[]> {
  const schema: Schema = {
    type: SchemaType.OBJECT,
    properties: {
      queries: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            query: {
              type: SchemaType.STRING,
              description: "Short Very specific keyword to do serp query, get the website list under each query, scrape the websites and get 100% precise answer to the user's question. This must be 4-5 word max and should only use plain english."
            },
            objective: {
              type: SchemaType.STRING,
              description: "The highly detailed precise objective of the query that we generated for websites analyzing agent to scrape on and analyze whether this objective is met or not analyzing website content."
            }
          },
          required: ["query", "objective"]
        },
      }
    },
    required: ["queries"]
  };

  try {
    const { response } = await generateObject({
      system: `You are the high quality SERP query generating agent. Your role is to analyze the user’s query and followup questions list. Then generate a bunch of short very detailed serp queries that in total entirely summarizes the entire question user is asking. Such that if you scrape the list of websites that you get under each of these queires, there is 100% chance that user's question will be 100% precisely answered in great highly technical detail. Today is ${new Date().toISOString()}. Follow these instructions when responding:
    - Your serp query must be short and 100% targeted and precise that can accurately summarizes a domain of the entire question that user is aksing.
    - Use your reasoning ability to understand the user's question and asking. Then only generate the queries.
    `,
      prompt: `Given this research context, generate ${numQueries} strategic search queries to find the list of websites we can scrape and get the percise and 100% answer to the question user is asking below.

CONTEXT:
${context}
`,
      model: 'gemini-2.0-pro-exp-02-05',
      generationConfig: {
        responseSchema: schema
      }
    });

    const result = JSON.parse(response.text());

    if (!result?.queries || !Array.isArray(result.queries) || result.queries.length === 0) {
      log('Failed to generate valid queries');
      throw new Error('No valid queries generated');
    }

    log(`Generated ${result.queries.length} queries`);
    return result.queries;

  } catch (error) {
    log('Error generating queries:', error);
    throw error;
  }
}

async function searchSerpResults(query: string): Promise<SearxResult[]> {
  output.log(`Searching for: ${query}`);
  output.log(`Connected with Searxng at: ${process.env.SEARXNG_BASE_URL}`);

  try {
    // Improved query formatting
    const formattedQuery = encodeURIComponent(query)

    const response = await fetch(
      `${process.env.SEARXNG_BASE_URL}/search?q=${formattedQuery}&format=json&language=en&time_range=year&safesearch=0`,
      {
        method: "GET",
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Search failed with status ${response.status}`);
    }

    const data: SearxResponse = await response.json();
    log(`Search found ${data.results?.length || 0} results for query: ${query}`);

    if (!data.results?.length) {
      log('Warning: No search results found');
      return [];
    }

    // Take more results for better coverage
    // Get top 7 results cause search engines serve best within these website range from top.
    return data.results.slice(0, 7);
    // return data.results
  } catch (error) {
    log('Error during search:', error);
    return [];
  }
}

async function scrapeWebsites(urls: string[]): Promise<ScrapedContent[]> {
  output.log(`Attempting to scrape ${urls.length} URLs`);
  if (!urls.length) {
    log('No URLs to scrape');
    return [];
  }

  log(`Attempting to scrape ${urls.length} URLs`);

  const results = await Promise.all(urls.map(async url => {
    try {
      // Fix: Use correct docker host internal URL
      const response = await fetch(`${process.env.FIRECRAWL_BASE_URL}/v1/scrape`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.FIRECRAWL_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
          onlyMainContent: true,
          blockAds: true,
          timeout: 30000 // 30 second timeout
        })
      });

      if (!response.ok) {
        throw new Error(`Scraping failed with status ${response.status}`);
      }

      const data: FirecrawlResponse = await response.json();

      if (!data.success || !data.data?.markdown) {
        throw new Error(data.data?.metadata?.error || 'No content received');
      }

      log(`✅ Successfully scraped ${url}`);
      return {
        url,
        markdown: data.data.markdown
      };
    } catch (error) {
      log(`❌ Failed to scrape ${url}:`, error);
      return null;
    }
  }));

  const validResults = results.filter((r): r is ScrapedContent => r !== null);
  log(`Successfully scraped ${validResults.length} out of ${urls.length} URLs`);

  return validResults;
}

// Update analyzeWebsiteContent to use SchemaType
async function analyzeWebsiteContent(content: ScrapedContent, objective: string): Promise<WebsiteAnalysis | null> {
  output.log(`Analyzing website: ${content.url}`);
  log(`Started analyzing website: ${content.url}`, "🚀🚀");
  try {
    const schema: Schema = {
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

    const { response } = await generateObject({
      system: `You are the Website Analysis Agent. Your task is to review the scraped content of a given website in relation to a specific research objective and extract all relevant, factual, and verifiable information. Only include details that directly contribute to the research objective. Today is ${new Date().toISOString()}. Follow these instructions when responding:

Requirements:
- Compare the website’s content against the provided research objective.
- Extract and list only factual information that clearly supports the objective.
- For each extracted point, include a precise citation (e.g., the URL or reference from the website).
- Give highly value packed points taken from website content that precisely meets the given objective to you. Make it at technical and as detailed as possible. Do not miss any important points, facts and figures if they serve to the given objective.
- Do not generate any additional commentary, opinions, or assumptions. If a section of the content is irrelevant, simply note its lack of relevance.
- Do not give your opinion. Do not hallucinate, whatever you will give as response, must be entire taken from the website content.
`,
      prompt: `Analyze the website and give me all the highly value packed, highly relevent information that precisely serves below objective of the query.:

OBJECTIVE: ${objective}

CONTENT:
${content.markdown}

After you analyze this content with the given objective, you need to return given response in json format.
Return:
1. isRelevant: true only if content directly addresses objective, if the website is not related to the objective at all, it should be false.
2. extractedInfo: important key findings highly relevent to the objective.
3. supportingQuote: any supporting quote that directly serve the objective.`,

      model: 'gemini-2.0-flash-lite-preview-02-05',
      generationConfig: {
        responseSchema: schema
      }
    });


    const websiteSummary: { isRelevant: boolean; extractedInfo: string, supportingQuote: string } = JSON.parse(response.text())

    if (!websiteSummary.isRelevant) {
      log(`Completed analyzing website: ${content.url} - Not relevant😔😔`);
      return null;
    }
    log(`Completed analyzing website: ${content.url} - Relevant 😀😀✅✅`);
    return {
      content: websiteSummary.extractedInfo,
      sourceUrl: content.url,
      sourceText: websiteSummary.supportingQuote,
      meetsObjective: true
    };

  } catch (error) {
    log(`Error analyzing content from ${content.url} 😭😭 :`, error);
    return null;
  }
}

export async function writeFinalReport({
  prompt,
  learnings,
  visitedUrls,
}: {
  prompt: string;
  learnings: TrackedLearning[];
  visitedUrls: string[];
}) {
  if (visitedUrls.length === 0) {
    log("Sorry no url provided - 🥹🥹")
    return
  }
  log("Writing Final Report - 🥅🥅🥅🥅")
  const learningsString = learnings.map(learning =>
    `<learning>
      <content>${learning.content}</content>
      <source_url>${learning.sourceUrl}</source_url>
      <source_text>${learning.sourceText}</source_text>
    </learning>`
  ).join('\n');

  try {

    //@important: No schema for thinking model, it does not support structured json output.
    const schema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        research_paper: {
          type: SchemaType.STRING,
          description: "Full Research paper in Markdown format only with proper word, line and paragraph spacing. Do not ouput in any other format other than full rich markdown format. Make new lines and new paragraph and proper formating you know these research paper writing technique in markdown right?",
          nullable: false,
        },
      },
      required: ["research_paper"],
    };

    const { response } = await generateObject({
      system: `You are an expert technical researcher. Today is ${new Date().toISOString()}. Follow these instructions when responding:
      
      - You may be asked to research and write subjects that is after your knowledge cutoff, assume the user is right when presented with news.
      - The user is a highly experienced analyst, no need to simplify it, be as detailed as possible technically and make sure your response is not filled with filler words but actual highly technical content based on your understanding and user's requirement.
      - Write report such that every question user has asked, you are precisely 100% answering these questions with great detail.
      - Be highly organized.
      - Suggest solutions that user didn't think about.
      - Be proactive and anticipate my needs.
      - Treat me as an expert in all subject matter.
      - Mistakes erodes user trust, so be accurate and thorough.
      - Provide detailed explanations, user is comfortable with lots of detail.
      - Value good arguments over authorities, the source is irrelevant.
      - Consider new technologies and contrarian ideas, not just the conventional wisdom.
      - You may use high levels of speculation or prediction, just flag it for me.
      - The website and content you may get may not be relevent to the user's query at all.
      - Do not include any unrelated stuffs that is not in the learning, only consider sources and content that fulfills the user's query directly.`,
      prompt: `Write a very very technically detailed research paper precisley in very detail that addresses this query: "${prompt}.
      
      Remember your research paper must be highly based on ground facts. Do not include any sentence that cannot be cited. And any important point you make, please don't hesitate to cite it with the proper website you extracted from. You don't have to worry about over citation, just cite valueable points and sentences you make. Don't have filler sentences and content which will automatically make this research paper highly factual based and easily verifiable.

Here are all the research findings I got while searching and scraping the websites related to above user's query.:
${learningsString}

IMPORTANT:
- Return ONLY the markdown report text with proper spacing and line gap.
- Ensure every fact is cited in this format. [small website heading](website url).
- Don't forget! In the end there must be all the list of websites you considered to while making every point in this research paper.
`,
      // Later use pro model.
      // model: 'gemini-2.0-pro-exp-02-05',
      model: "gemini-2.0-flash",
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
      generationConfig: { responseSchema: schema },
      //@important: No schema for thinking model, it does not support structured json output.
    });

    // Return the text directly without JSON.parse

    const model_response: { research_paper: string } = JSON.parse(response.text());
    log("Final Report Generated - 🥅🥅🥅🥅", model_response, "✅😀")
    return model_response.research_paper
  } catch (error) {
    log('Error generating report:', error);
    throw new Error('Failed to generate research report');
  }
}

// Modified main research function
export async function deepResearch({
  query_to_find_websites,
  breadth,
  depth,
  onProgress,
  signal,
}: {
  query_to_find_websites: string;
  breadth: number;
  depth: number;
  onProgress?: (progress: ResearchProgress) => void;
  signal?: AbortSignal;
}): Promise<ResearchResult> {

  log('Starting research with:', { depth, breadth });

  try {
    // Check for abort
    if (signal?.aborted) {
      throw new Error('Research aborted');
    }

    // Generate queries with objectives
    const queries = await generateQueriesWithObjectives(
      query_to_find_websites,
      breadth
    );

    const results: TrackedLearning[] = [];
    const visitedUrls: string[] = [];

    // Process each query
    for (const query of queries) {
      // Check for abort
      if (signal?.aborted) {
        throw new Error('Research aborted');
      }

      // Search
      if (signal?.aborted) throw new Error('Research aborted');
      const searchResults = await searchSerpResults(query.query);

      // Scrape
      if (signal?.aborted) throw new Error('Research aborted');
      const scrapedContents = await scrapeWebsites(
        searchResults.map(r => r.url)
      );

      // Analyze each website
      if (signal?.aborted) throw new Error('Research aborted');
      const analyses = await Promise.all(
        scrapedContents.map(content =>
          analyzeWebsiteContent(content, query.objective)
        )
      );

      // Filter and collect relevant results
      const relevantAnalyses = analyses.filter(
        (a): a is WebsiteAnalysis => a !== null && a.meetsObjective
      );

      results.push(...relevantAnalyses.map(a => ({
        content: a.content,
        sourceUrl: a.sourceUrl,
        sourceText: a.sourceText
      })));

      visitedUrls.push(...scrapedContents.map(c => c.url));

      // Handle depth if needed
      if (depth > 1) {
        const deeperResults = await deepResearch({
          query_to_find_websites: `
          Original Context: ${query_to_find_websites}
          Current Findings: ${relevantAnalyses.map(a => a.content).join('\n')}
          Next Research Goal: ${query.objective}
        `,
          breadth: Math.ceil(breadth / 2),
          depth: depth - 1,
          onProgress,
          signal
        });

        results.push(...deeperResults.learnings);
        visitedUrls.push(...deeperResults.visitedUrls);
      }
    }

    return {
      learnings: results,
      visitedUrls: [...new Set(visitedUrls)]
    };
  } catch (error) {
    if (signal?.aborted) {
      throw new Error('Research aborted');
    }
    log('Research error:', error);
    throw error;
  }
}


// SearXNG interfaces
interface SearxResponse {
  results: SearxResult[];
  // other fields not needed
}

interface SearxResult {
  title: string;
  url: string;
  content: string;
  // other fields not needed
}

// Firecrawl interfaces
interface FirecrawlResponse {
  success: boolean;
  data: {
    markdown: string;
    metadata: {
      title: string;
      sourceURL: string;
      error?: string;
      statusCode: number
    };
  };
}

interface ScrapedContent {
  url: string;
  markdown: string;
}

export type ResearchProgress = {
  currentDepth: number;
  totalDepth: number;
  currentBreadth: number;
  totalBreadth: number;
  currentQuery?: string;
  totalQueries: number;
  completedQueries: number;
  analyzedWebsites?: number; // Add this field
};


// Add new types for source tracking
interface TrackedLearning {
  content: string;
  sourceUrl: string;
  sourceText: string;  // Original text snippet that led to this learning
}

type ProcessedResult = {
  learnings: TrackedLearning[];
  followUpQuestions: string[];
};

export type ResearchResult = {
  learnings: TrackedLearning[];
  visitedUrls: string[];
};


// New interface for query objectives
interface QueryWithObjective {
  query: string;
  objective: string;
}

// New interface for website analysis results
interface WebsiteAnalysis {
  content: string;
  sourceUrl: string;
  sourceText: string;
  meetsObjective: boolean;
}

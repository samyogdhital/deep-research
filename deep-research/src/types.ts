import { TrackedLearning } from './agent/report-writer';

export interface ScrapedSourceInfo {
    url: string;
    extractedContent?: string;
    success: boolean;
    error?: string;
}

export interface SerpQueryResult {
    query: string;
    objective: string;
    timestamp: string;
    successfulScrapes: Array<{
        url: string;
        extractedContent: string;
    }>;
    failedScrapes: Array<{
        url: string;
        error: string;
    }>;
}

export interface ResearchSourcesLog {
    queries: SerpQueryResult[];
    lastUpdated: string;
}

// Searxng types
export interface SearxResponse {
    results: SearxResult[];
}

export interface SearxResult {
    title: string;
    url: string;
    content: string;
}


// Firecrawl types
export interface FirecrawlResponse {
    success: boolean;
    data: {
        markdown: string;
    }
    metadata: {
        title: string;
        sourceURL: string;
        error?: string;
        statusCode: number
    };
}

export interface ScrapedContent {
    url: string;
    markdown: string;
}


// Add new type for tracking agent information
export interface AgentResult {
    type: 'website-analyzer' | 'information-cruncher' | 'report-writer';
    objective: string;
    url?: string;
    extractedContent?: string;
    crunchedContent?: string;
    success: boolean;
    error?: string;
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

export type ResearchResult = {
    learnings: TrackedLearning[];
    visitedUrls: string[];
};

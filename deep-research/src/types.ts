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

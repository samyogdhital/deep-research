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

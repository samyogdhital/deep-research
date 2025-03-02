export interface Report {
    title: string;
    report_id: string;
    sections: Array<{
        rank: number;
        sectionHeading: string;
        content: string;
    }>;
    citedUrls: Array<{
        rank: number;
        url: string;
        title: string;
        oneValueablePoint: string;
    }>;
    isVisited?: boolean;
    timestamp: number;
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

export type ResearchState = {
    step: 'input' | 'follow-up' | 'processing' | 'complete';
    initialPrompt: string;
    depth: number;
    breadth: number;
    followupQuestions: number;
    generatedFollowUpQuestions: string[];
    followUpAnswers: Record<string, string>;
    logs: string[];
    showLogs: boolean;
    report: string;
    sources: Array<{
        learning: string;
        source: string;
        quote: string;
    }>;
    showSources?: boolean;
    sourcesLog: ResearchSourcesLog;
};

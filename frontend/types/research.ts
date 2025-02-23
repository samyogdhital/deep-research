export type SerpQueryResult = {
    query: string;
    objective: string;
    successfulScrapes: Array<{
        url: string;
        extractedContent: string;
    }>;
    failedScrapes: Array<{
        url: string;
        error: string;
    }>;
};

export type ResearchSourcesLog = {
    queries: SerpQueryResult[];
    lastUpdated: string;
};

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

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

export interface ResearchData {
    report_id: string;
    initial_query: string;
    depth: number;
    breadth: number;
    followUps_num: number;
    followUps_QnA: Array<{
        id: number;
        question: string;
        answer: string;
    }>;
    serpQueries: Array<{
        query: string;
        objective: string;
        query_rank: number;
        successful_scraped_websites: Array<{
            url: string;
            title: string;
            description: string;
            isRelevant: number;
            extracted_from_website_analyzer_agent: string[];
        }>;
        failedWebsites: string[];
    }>;
    information_crunching_agent: {
        serpQueries: Array<{
            query_rank: number;
            crunched_information: Array<{
                url: string;
                content: string[];
            }>;
        }>;
    };
    report?: Report;
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

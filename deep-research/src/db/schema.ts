// Schema types for the deep research database

export interface FollowUpQnA {
    id: number;
    question: string;
    answer: string;
}

export interface ScrapedWebsite {
    id: number;
    url: string;
    title: string;
    description: string;
    status: 'scraping' | 'analyzing' | 'analyzed';
    isRelevant: number;
    extracted_from_website_analyzer_agent: string[];
}

export interface SerpQuery {
    query: string;
    objective: string;
    query_rank: number;
    successful_scraped_websites: Array<{
        id: number;
        url: string;
        title: string;
        description: string;
        status: 'scraping' | 'analyzing' | 'analyzed';
        isRelevant: number;
        extracted_from_website_analyzer_agent: string[];
    }>;
    failedWebsites: Array<{
        website: string;
        stage: 'scraping' | 'analyzing';
    }>;
}

export interface CrunchedInformation {
    url: string;
    content: string[];
}

export interface InformationCrunchingResult {
    query_rank: number;
    crunched_information: CrunchedInformation[];
}

export interface ReportSection {
    rank: number;
    sectionHeading: string;  // Will contain markdown format H1/H2/H3
    content: string;  // Will contain full markdown format content
}

export interface CitedUrl {
    rank: number;
    url: string;
    title: string;
    oneValueablePoint: string;
}

export interface Report {
    report_id: string;
    title: string;
    sections: ReportSection[];
    citedUrls: CitedUrl[];
    isVisited: boolean;
    timestamp: number;
}

export interface ResearchData {
    report_id: string;
    initial_query: string;
    depth: number;
    breadth: number;
    followUps_num: number;
    followUps_QnA: FollowUpQnA[];
    serpQueries: SerpQuery[];
    information_crunching_agent: {
        serpQueries: InformationCrunchingResult[];
    };
    report?: Report; // Make this optional since it might not exist initially
}
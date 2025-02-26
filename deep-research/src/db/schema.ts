// Schema types for the deep research database

export interface FollowUpQnA {
    id: number;
    question: string;
    answer: string;
}

export interface ScrapedWebsite {
    url: string;
    title: string;
    description: string;
    isRelevant: number; // Score from 1-10
    extracted_from_website_analyzer_agent: string[];
}

export interface SerpQuery {
    query: string;
    objective: string;
    query_rank: number;
    successful_scraped_websites: ScrapedWebsite[];
    failedWebsites: string[];
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
    sectionHeading: string;
    content: string;
}

export interface CitedUrl {
    rank: number;
    url: string;
    title: string;
    oneValueablePoint: string;
}

export interface Report {
    title: string;
    report_id: string;
    sections: ReportSection[];
    citedUrls: CitedUrl[];
    isVisited?: boolean;
}

export interface ResearchData {
    report_id: string; // Unique identifier for the entire research
    initial_query: string;
    depth: number;
    breadth: number;
    followUps_num: number;
    followUps_QnA: FollowUpQnA[];
    serpQueries: SerpQuery[];
    information_crunching_agent: {
        serpQueries: InformationCrunchingResult[];
    };
    report: Report;
}
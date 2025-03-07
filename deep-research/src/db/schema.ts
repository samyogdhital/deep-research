// Schema types for the deep research database

import { DBSchema } from '.';

export interface FollowUpQnA {
    id: number;
    question: string;
    answer: string;
}

export type ScrapedWebsite = DBSchema['researches'][number]['serpQueries'][number]['successful_scraped_websites'][number]


export type SerpQuery = DBSchema['researches'][number]['serpQueries'][number]

export interface CrunchedInformation {
    url: string;
    content: string[];
}

export interface InformationCrunchingResult {
    query_timestamp: number;
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
    status: 'no-start' | 'in-progress' | 'completed';
    isVisited: boolean;
    timestamp?: number;
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
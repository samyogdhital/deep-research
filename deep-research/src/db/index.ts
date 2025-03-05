import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'
import { ResearchData, SerpQuery, FollowUpQnA, Report, InformationCrunchingResult, ScrapedWebsite } from './schema'
import { WebsiteStatus } from '../types'

// Match the final_database_schema from response-schema.ts
export interface DBSchema {
    researches: Array<{
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
            query_timestamp: number;
            depth_level: number;
            parent_query_timestamp: number;
            successful_scraped_websites: Array<{
                id: number;
                url: string;
                title: string;
                description: string;
                status: 'scraping' | 'analyzing' | 'analyzed';
                relevance_score: number;
                is_objective_met: boolean;
                core_content: string[];
                facts_figures: string[];
            }>;
            failedWebsites: Array<{
                website: string;
                stage: 'scraping' | 'analyzing';
            }>;
        }>;
        information_crunching_agent: {
            serpQueries: Array<{
                query_timestamp: number;
                crunched_information: Array<{
                    url: string;
                    content: string[];
                }>;
            }>;
        };
        report?: {
            title: string;
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
            isVisited: boolean;
            timestamp?: number;
        };
    }>;
}

const defaultData: DBSchema = {
    researches: []
}

class ResearchDB {
    private static instance: ResearchDB;
    private db: Low<DBSchema>;
    private static dataDir: string;

    private constructor() {
        ResearchDB.dataDir = path.join(process.cwd(), 'data');
        const dbPath = path.join(ResearchDB.dataDir, 'researches.json');
        const adapter = new JSONFile<DBSchema>(dbPath);
        this.db = new Low(adapter, defaultData);
    }

    static async getInstance(): Promise<ResearchDB> {
        if (!ResearchDB.instance) {
            try {
                await fs.mkdir(path.join(process.cwd(), 'data'), { recursive: true });
            } catch (error) {
                if (error instanceof Error && error.message.includes('EEXIST')) {
                    // Directory already exists, ignore
                } else {
                    throw error;
                }
            }

            ResearchDB.instance = new ResearchDB();
            await ResearchDB.instance.db.read();

            // Ensure data is initialized
            if (!ResearchDB.instance.db.data) {
                ResearchDB.instance.db.data = defaultData;
                await ResearchDB.instance.db.write();
            }

            // Ensure researches array exists
            if (!ResearchDB.instance.db.data.researches) {
                ResearchDB.instance.db.data.researches = [];
            }
        }
        return ResearchDB.instance;
    }

    async initializeResearch(initial_query: string, depth: number, breadth: number, followUps_num: number): Promise<string> {
        await this.db.read();
        const report_id = crypto.randomUUID();

        const newResearch = {
            report_id,
            initial_query,
            depth,
            breadth,
            followUps_num,
            followUps_QnA: [],
            serpQueries: [],
            information_crunching_agent: {
                serpQueries: []
            }
        };

        this.db.data.researches.push(newResearch);
        await this.db.write();
        return report_id;
    }

    async addFollowUpQnA(researchId: string, followUpQnA: FollowUpQnA): Promise<boolean> {
        await this.db.read();
        const research = this.db.data.researches.find(r => r.report_id === researchId);
        if (!research) return false;
        research.followUps_QnA.push(followUpQnA);
        await this.db.write();
        return true;
    }

    async addSerpQuery(researchId: string, serpQuery: SerpQuery): Promise<boolean> {
        await this.db.read();
        const research = this.db.data.researches.find(r => r.report_id === researchId);
        if (!research) return false;
        research.serpQueries.push(serpQuery);
        await this.db.write();
        return true;
    }

    async updateSerpQueryResults(
        researchId: string,
        queryTimestamp: number,
        successfulWebsites: ScrapedWebsite[],
        failedWebsites: Array<{ website: string; stage: 'scraping' | 'analyzing' }>
    ): Promise<boolean> {
        await this.db.read();
        const research = this.db.data.researches.find(r => r.report_id === researchId);
        if (!research) return false;
        const query = research.serpQueries.find(q => q.query_timestamp === queryTimestamp);
        if (!query) return false;
        query.successful_scraped_websites = successfulWebsites;
        query.failedWebsites = failedWebsites;
        await this.db.write();
        return true;
    }

    async deleteReport(id: string): Promise<boolean> {
        await this.db.read();
        const index = this.db.data.researches.findIndex(r => r.report_id === id);
        if (index === -1) return false;

        this.db.data.researches.splice(index, 1);
        await this.db.write();
        return true;
    }

    async clearAllReports(): Promise<boolean> {
        await this.db.read();
        const hadReports = this.db.data.researches.length > 0;
        this.db.data.researches = [];
        await this.db.write();
        return hadReports;
    }

    async markReportAsVisited(id: string): Promise<boolean> {
        await this.db.read();
        const research = this.db.data.researches.find(r => r.report_id === id);
        if (!research || !research.report) return false;

        research.report.isVisited = true;
        await this.db.write();
        return true;
    }

    async updateReportTitle(id: string, title: string): Promise<boolean> {
        await this.db.read();
        const research = this.db.data.researches.find(r => r.report_id === id);
        if (!research || !research.report) return false;

        research.report.title = title;
        await this.db.write();
        return true;
    }

    async getAllReports(): Promise<Array<{ report_id: string; report: any }>> {
        await this.db.read();
        return this.db.data.researches
            .filter(r => r.report)
            .map(r => ({
                report_id: r.report_id,
                report: r.report
            }));
    }

    async saveReport(report: Report): Promise<string> {
        try {
            await this.db.read();
            const research = this.db.data.researches.find(r => r.report_id === report.report_id);
            if (!research) throw new Error('Research not found');

            research.report = report;
            await this.db.write();
            return report.report_id;
        } catch (error) {
            console.error('Error in saveReport:', error);
            throw error;
        }
    }

    async addCrunchedInformation(researchId: string, crunchedInfo: InformationCrunchingResult): Promise<boolean> {
        await this.db.read();
        const research = this.db.data.researches.find(r => r.report_id === researchId);
        if (!research) return false;
        research.information_crunching_agent.serpQueries.push(crunchedInfo);
        await this.db.write();
        return true;
    }

    async getResearchData(researchId: string): Promise<DBSchema['researches'][0] | null> {
        await this.db.read();
        const research = this.db.data.researches.find(r => r.report_id === researchId);
        return research || null;
    }

    async updateResearchParameters(researchId: string, params: { depth: number; breadth: number; followUps_num: number }): Promise<boolean> {
        await this.db.read();
        const research = this.db.data.researches.find(r => r.report_id === researchId);
        if (!research) return false;

        research.depth = params.depth;
        research.breadth = params.breadth;
        research.followUps_num = params.followUps_num;

        await this.db.write();
        return true;
    }

    async updateFollowUpAnswer(researchId: string, followUpQnA: FollowUpQnA): Promise<boolean> {
        await this.db.read();
        const research = this.db.data.researches.find(r => r.report_id === researchId);
        if (!research) return false;

        const existingQuestionIndex = research.followUps_QnA.findIndex(qa => qa.id === followUpQnA.id);
        if (existingQuestionIndex === -1) return false;

        research.followUps_QnA[existingQuestionIndex] = followUpQnA;
        await this.db.write();
        return true;
    }

    async updateWebsiteStatus(researchId: string, queryTimestamp: number, website: WebsiteStatus): Promise<boolean> {
        await this.db.read();
        const research = this.db.data.researches.find(r => r.report_id === researchId);
        if (!research) return false;

        const query = research.serpQueries.find(q => q.query_timestamp === queryTimestamp);
        if (!query) return false;

        const websiteIndex = query.successful_scraped_websites.findIndex(w => w.id === website.id);
        if (websiteIndex === -1) return false;

        query.successful_scraped_websites[websiteIndex] = website;
        await this.db.write();
        return true;
    }

    async getSerpQueryByWebsiteId(researchId: string, websiteId: number): Promise<{ query_timestamp: number } | null> {
        await this.db.read();
        const research = this.db.data.researches.find(r => r.report_id === researchId);
        if (!research) return null;

        for (const query of research.serpQueries) {
            if (query.successful_scraped_websites.some(w => w.id === websiteId)) {
                return { query_timestamp: query.query_timestamp };
            }
        }
        return null;
    }
}

export { ResearchDB };

import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'
import { FollowUpQnA, Report, ScrapedWebsite, SerpQuery } from './schema'

// Simple mutex implementation for database operations
class Mutex {
    private locked = false;
    private queue: Array<() => void> = [];

    async acquire(): Promise<void> {
        return new Promise(resolve => {
            if (!this.locked) {
                this.locked = true;
                resolve();
            } else {
                this.queue.push(resolve);
            }
        });
    }

    release(): void {
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            if (next) next();
        } else {
            this.locked = false;
        }
    }
}

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
            stage: 'in-progress' | 'completed' | 'failed';
            successful_scraped_websites: Array<{
                id: number;
                url: string;
                title: string;
                description: string;
                status: 'scraping' | 'scraped' | 'analyzing' | 'analyzed' | 'analysis-failed';
                relevance_score: number;
                is_objective_met: boolean;
                core_content: string[];
                facts_figures: string[];
            }>;
            scrapeFailedWebsites: Array<{
                website: string;
            }>;
        }>;
        report: {
            title: string; // title will be coming from initial prompt analyzer model ok?
            status: "not-started" | "in-progress" | "completed" | "failed";
            // sections: Array<{
            //     rank: number;
            //     sectionHeading: string;
            //     content: string;
            // }>;
            // citedUrls: Array<{
            //     rank: number;
            //     url: string;
            //     title: string;
            //     oneValueablePoint: string;
            // }>;
            content: string;
            isVisited: boolean;
            timestamp: number;
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
    private mutex: Mutex = new Mutex(); // Add mutex for database operations

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

    // Wrap database operations with mutex
    private async withMutex<T>(operation: () => Promise<T>): Promise<T> {
        await this.mutex.acquire();
        try {
            return await operation();
        } finally {
            this.mutex.release();
        }
    }

    async initializeResearch(initial_query: string, depth: number, breadth: number, followUps_num: number): Promise<string> {
        return this.withMutex(async () => {
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
                report: {
                    title: '',
                    status: 'not-started' as const,
                    content: '',
                    isVisited: false,
                    timestamp: Date.now()
                }
            };

            this.db.data.researches.push(newResearch);
            await this.db.write();
            return report_id;
        });
    }

    async addFollowUpQnA(report_id: string, followUpQnA: FollowUpQnA): Promise<boolean> {
        return this.withMutex(async () => {
            await this.db.read();
            const research = this.db.data.researches.find(r => r.report_id === report_id);
            if (!research) return false;
            research.followUps_QnA.push(followUpQnA);
            await this.db.write();
            return true;
        });
    }

    async addReportTitle(report_id: string, reportTitle: string): Promise<boolean> {
        return this.withMutex(async () => {
            await this.db.read();
            const research = this.db.data.researches.find(r => r.report_id === report_id);
            if (!research) return false;
            research.report!.title = reportTitle;
            await this.db.write();
            return true;
        });
    }

    async addSerpQuery(report_id: string, serpQuery: SerpQuery): Promise<boolean> {
        return this.withMutex(async () => {
            await this.db.read();
            const research = this.db.data.researches.find(r => r.report_id === report_id);
            if (!research) return false;
            research.serpQueries.push(serpQuery);
            await this.db.write();
            return true;
        });
    }

    async updateSerpQueryResults(
        { report_id, queryTimestamp, parentQueryTimestamp, successfulWebsites, serpQueryStage }: {
            report_id: string,
            queryTimestamp: number,
            parentQueryTimestamp: number,
            successfulWebsites: ScrapedWebsite[],
            serpQueryStage?: 'in-progress' | 'completed' | 'failed'
        }
    ): Promise<boolean> {
        return this.withMutex(async () => {
            await this.db.read();
            const research = this.db.data.researches.find(r => r.report_id === report_id);
            if (!research) return false;
            const query = research.serpQueries.find(q => q.query_timestamp === queryTimestamp);
            if (!query) return false;
            query.successful_scraped_websites = successfulWebsites;
            if (serpQueryStage) {
                query.stage = serpQueryStage;
                query.parent_query_timestamp = parentQueryTimestamp;
            }
            await this.db.write();
            return true;
        });
    }

    // new function to remove the website from successful_scraped_websites and add to scrapeFailedWebsites
    async removeWebsiteFromSuccessfulScrapedWebsites(report_id: string, websiteUrl: string): Promise<boolean> {
        return this.withMutex(async () => {
            await this.db.read();
            const research = this.db.data.researches.find(r => r.report_id === report_id);
            if (!research) return false;
            const query = research.serpQueries.find(q => q.successful_scraped_websites.some(w => w.url === websiteUrl));
            if (!query) return false;
            query.successful_scraped_websites = query.successful_scraped_websites.filter(w => w.url !== websiteUrl);
            query.scrapeFailedWebsites = [...(query.scrapeFailedWebsites || []), { website: websiteUrl }];
            await this.db.write();
            return true;
        });
    }

    async deleteReport(id: string): Promise<boolean> {
        return this.withMutex(async () => {
            await this.db.read();
            const index = this.db.data.researches.findIndex(r => r.report_id === id);
            if (index === -1) return false;

            this.db.data.researches.splice(index, 1);
            await this.db.write();
            return true;
        });
    }

    async clearAllReports(): Promise<boolean> {
        return this.withMutex(async () => {
            await this.db.read();
            const hadReports = this.db.data.researches.length > 0;
            this.db.data.researches = [];
            await this.db.write();
            return hadReports;
        });
    }

    async markReportAsVisited(id: string): Promise<boolean> {
        return this.withMutex(async () => {
            await this.db.read();
            const research = this.db.data.researches.find(r => r.report_id === id);
            if (!research || !research.report) return false;

            research.report.isVisited = true;
            await this.db.write();
            return true;
        });
    }

    async updateReportTitle(id: string, title: string): Promise<boolean> {
        return this.withMutex(async () => {
            await this.db.read();
            const research = this.db.data.researches.find(r => r.report_id === id);
            if (!research || !research.report) return false;

            research.report.title = title;
            await this.db.write();
            return true;
        });
    }

    async getAllReports(): Promise<DBSchema['researches']> {
        return this.withMutex(async () => {
            await this.db.read();
            return this.db.data.researches;
        });
    }

    async saveReport(report_id: string, reportData: DBSchema['researches'][number]['report']): Promise<string> {
        return this.withMutex(async () => {
            try {
                await this.db.read();
                const research = this.db.data.researches.find(r => r.report_id === report_id);
                if (!research) throw new Error('Research not found');

                research.report = reportData;
                await this.db.write();
                return report_id;
            } catch (error) {
                console.error('Error in saveReport:', error);
                throw error;
            }
        });
    }

    async getResearchData(report_id: string): Promise<DBSchema['researches'][number] | null> {
        return this.withMutex(async () => {
            await this.db.read();
            const research = this.db.data.researches.find(r => r.report_id === report_id);
            return research || null;
        });
    }

    async updateResearchParameters(report_id: string, params: { depth: number; breadth: number; followUps_num: number }): Promise<boolean> {
        return this.withMutex(async () => {
            await this.db.read();
            const research = this.db.data.researches.find(r => r.report_id === report_id);
            if (!research) return false;

            research.depth = params.depth;
            research.breadth = params.breadth;
            research.followUps_num = params.followUps_num;

            await this.db.write();
            return true;
        });
    }

    async updateFollowUpAnswer(report_id: string, followUpQnA: FollowUpQnA): Promise<boolean> {
        return this.withMutex(async () => {
            await this.db.read();
            const research = this.db.data.researches.find(r => r.report_id === report_id);
            if (!research) return false;

            const existingQuestionIndex = research.followUps_QnA.findIndex(qa => qa.id === followUpQnA.id);
            if (existingQuestionIndex === -1) return false;

            research.followUps_QnA[existingQuestionIndex] = followUpQnA;
            await this.db.write();
            return true;
        });
    }

    async updateWebsiteStatus(
        report_id: string,
        queryTimestamp: number,
        websiteUrl: string,
        websiteUpdate: Partial<DBSchema['researches'][number]['serpQueries'][number]['successful_scraped_websites'][number]>
    ): Promise<boolean> {
        return this.withMutex(async () => {
            await this.db.read();
            const research = this.db.data.researches.find(r => r.report_id === report_id);
            if (!research) return false;

            const currentSerpQuery = research.serpQueries.find(q => q.query_timestamp === queryTimestamp);
            if (!currentSerpQuery) return false;

            const websiteIndex = currentSerpQuery.successful_scraped_websites.findIndex(w => w.url === websiteUrl);
            if (websiteIndex === -1) return false;

            // Update only the specified fields while preserving required fields
            const currentWebsite = currentSerpQuery.successful_scraped_websites[websiteIndex];
            currentSerpQuery.successful_scraped_websites[websiteIndex] = {
                ...currentWebsite,  // Keep all existing required fields
                ...websiteUpdate    // Update with new values
            } as ScrapedWebsite;

            await this.db.write();
            return true;
        });
    }

    async getSerpQueryByWebsiteId(report_id: string, websiteId: number): Promise<{ query_timestamp: number } | null> {
        return this.withMutex(async () => {
            await this.db.read();
            const research = this.db.data.researches.find(r => r.report_id === report_id);
            if (!research) return null;

            for (const query of research.serpQueries) {
                if (query.successful_scraped_websites.some(w => w.id === websiteId)) {
                    return { query_timestamp: query.query_timestamp };
                }
            }
            return null;
        });
    }
}

export { ResearchDB };

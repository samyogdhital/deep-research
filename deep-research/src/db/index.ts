import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import path from 'path'
import fs from 'fs/promises'
import { ResearchData, SerpQuery, FollowUpQnA, Report, InformationCrunchingResult, ScrapedWebsite } from './schema'

interface DBData {
    researches: ResearchData[];
    reports: Report[];
}

const defaultData: DBData = {
    researches: [],
    reports: []
}

class ResearchDB {
    private static instance: ResearchDB;
    private db: Low<DBData>;
    private static dataDir: string;

    private constructor() {
        ResearchDB.dataDir = path.join(process.cwd(), 'data');
        const dbPath = path.join(ResearchDB.dataDir, 'researches.json');
        const adapter = new JSONFile<DBData>(dbPath);
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

            // Ensure arrays exist
            if (!ResearchDB.instance.db.data.reports) {
                ResearchDB.instance.db.data.reports = [];
            }
            if (!ResearchDB.instance.db.data.researches) {
                ResearchDB.instance.db.data.researches = [];
            }
        }
        return ResearchDB.instance;
    }

    async initializeResearch(initial_query: string, depth: number, breadth: number, followUps_num: number): Promise<string> {
        await this.db.read();
        const report_id = crypto.randomUUID();
        const newResearch: ResearchData = {
            report_id,
            initial_query,
            depth,
            breadth,
            followUps_num,
            followUps_QnA: [],
            serpQueries: [],
            information_crunching_agent: {
                serpQueries: []
            },
            report: {
                title: '',
                report_id,
                sections: [],
                citedUrls: [],
                isVisited: false
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

    async updateSerpQueryResults(researchId: string, queryRank: number, successfulWebsites: ScrapedWebsite[], failedWebsites: string[]): Promise<boolean> {
        await this.db.read();
        const research = this.db.data.researches.find(r => r.report_id === researchId);
        if (!research) return false;
        const query = research.serpQueries.find(q => q.query_rank === queryRank);
        if (!query) return false;
        query.successful_scraped_websites = successfulWebsites;
        query.failedWebsites = failedWebsites;
        await this.db.write();
        return true;
    }

    async deleteReport(id: string): Promise<boolean> {
        await this.db.read();
        const reportToDelete = this.db.data.reports.find(r => r.report_id === id);
        if (!reportToDelete) return false;

        this.db.data.reports = this.db.data.reports.filter(r => r.report_id !== id);
        await this.db.write();
        return true;
    }

    async clearAllReports(): Promise<boolean> {
        await this.db.read();
        const hadReports = this.db.data.reports.length > 0;

        this.db.data.reports = [];
        await this.db.write();

        await this.db.read();
        const isEmptyNow = this.db.data.reports.length === 0;

        return hadReports && isEmptyNow;
    }

    async markReportAsVisited(id: string): Promise<boolean> {
        await this.db.read();
        const report = this.db.data.reports.find(r => r.report_id === id);
        if (!report) return false;

        report.isVisited = true;
        await this.db.write();
        return true;
    }

    async updateReportTitle(id: string, title: string): Promise<boolean> {
        await this.db.read();
        const report = this.db.data.reports.find(r => r.report_id === id);
        if (!report) return false;

        report.title = title;
        await this.db.write();
        return true;
    }

    async getAllReports(): Promise<Report[]> {
        await this.db.read();
        return this.db.data.reports;
    }

    async saveReport(report: Report): Promise<string> {
        try {
            await this.db.read();

            // Ensure data and arrays are initialized
            if (!this.db.data) {
                this.db.data = defaultData;
            }
            if (!this.db.data.reports) {
                this.db.data.reports = [];
            }
            if (!this.db.data.researches) {
                this.db.data.researches = [];
            }

            // Save to reports collection
            this.db.data.reports.push(report);

            // Update the research object's report
            const research = this.db.data.researches.find(r => r.report_id === report.report_id);
            if (research) {
                research.report = report;
            }

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

    async getResearchData(researchId: string): Promise<ResearchData | null> {
        await this.db.read();
        const research = this.db.data.researches.find(r => r.report_id === researchId);
        if (!research) return null;

        // Get the report from reports collection if it exists
        const report = this.db.data.reports.find(r => r.report_id === researchId);

        // Return the research data with either the found report or the research's own report
        return {
            report_id: research.report_id,
            initial_query: research.initial_query,
            depth: research.depth,
            breadth: research.breadth,
            followUps_num: research.followUps_num,
            followUps_QnA: research.followUps_QnA,
            serpQueries: research.serpQueries,
            information_crunching_agent: research.information_crunching_agent,
            report: report || research.report  // Use the report from research if not found in reports
        };
    }
}

export { ResearchDB, type Report };

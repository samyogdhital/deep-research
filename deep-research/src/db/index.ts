import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import path from 'path'
import fs from 'fs/promises'

type ResearchSourcesLog = {
    queries: Array<{
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
    }>;
    lastUpdated: string;
}

type Report = {
    id: string;
    report_title: string;
    report: string;
    sourcesLog: ResearchSourcesLog;
    timestamp: number;
}

type DBData = {
    reports: Report[];
}

const defaultData: DBData = {
    reports: []
}

class ReportDB {
    private db: Low<DBData>;
    private static instance: ReportDB;
    private static dataDir: string;

    private constructor() {
        ReportDB.dataDir = path.join(process.cwd(), 'data');
        const dbPath = path.join(ReportDB.dataDir, 'reports.json');
        const adapter = new JSONFile<DBData>(dbPath);
        this.db = new Low(adapter, defaultData);
    }

    static async getInstance(): Promise<ReportDB> {
        if (!ReportDB.instance) {
            // Create data directory if it doesn't exist
            try {
                await fs.mkdir(path.join(process.cwd(), 'data'), { recursive: true });
            } catch (err) {
                if (err.code !== 'EEXIST') {
                    throw err;
                }
            }

            ReportDB.instance = new ReportDB();
            await ReportDB.instance.db.read();
        }
        return ReportDB.instance;
    }

    async saveReport(report: Omit<Report, 'id' | 'timestamp'>): Promise<string> {
        await this.db.read();

        const id = crypto.randomUUID();
        const newReport = {
            ...report,
            id,
            timestamp: Date.now()
        };

        this.db.data.reports.push(newReport);
        await this.db.write();
        return id;
    }

    async getReport(id: string): Promise<Report | null> {
        await this.db.read();
        return this.db.data.reports.find(r => r.id === id) || null;
    }

    async getAllReports(): Promise<Report[]> {
        await this.db.read();
        return this.db.data.reports;
    }

    async updateReportTitle(id: string, newTitle: string): Promise<boolean> {
        await this.db.read();
        const report = this.db.data.reports.find(r => r.id === id);
        if (!report) return false;

        report.report_title = newTitle;
        await this.db.write();
        return true;
    }

    async deleteReport(id: string): Promise<boolean> {
        await this.db.read();
        const initialLength = this.db.data.reports.length;
        this.db.data.reports = this.db.data.reports.filter(r => r.id !== id);

        if (this.db.data.reports.length === initialLength) return false;

        await this.db.write();
        return true;
    }

    async clearAllReports(): Promise<void> {
        this.db.data.reports = [];
        await this.db.write();
    }
}

export { ReportDB, type Report };

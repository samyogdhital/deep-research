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
    isVisited: boolean; // Add this field
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

    async saveReport(report: Omit<Report, 'id' | 'timestamp' | 'isVisited'>): Promise<string> {
        await this.db.read();

        const id = crypto.randomUUID();
        const newReport = {
            ...report,
            id,
            timestamp: Date.now(),
            isVisited: false // Set default value
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
        await this.db.read(); // Ensure fresh data
        const initialLength = this.db.data.reports.length;
        const reportToDelete = this.db.data.reports.find(r => r.id === id);

        if (!reportToDelete) return false;

        this.db.data.reports = this.db.data.reports.filter(r => r.id !== id);
        await this.db.write(); // Wait for write to complete

        // Verify deletion
        await this.db.read(); // Read fresh data
        const stillExists = this.db.data.reports.some(r => r.id === id);

        return !stillExists; // Return true only if report is actually gone
    }

    async clearAllReports(): Promise<boolean> {
        await this.db.read(); // Ensure fresh data
        const hadReports = this.db.data.reports.length > 0;

        this.db.data.reports = [];
        await this.db.write(); // Wait for write to complete

        // Verify deletion
        await this.db.read(); // Read fresh data
        const isEmptyNow = this.db.data.reports.length === 0;

        return hadReports && isEmptyNow; // Return true only if reports were deleted and verified
    }

    async markReportAsVisited(id: string): Promise<boolean> {
        await this.db.read();
        const report = this.db.data.reports.find(r => r.id === id);
        if (!report) return false;

        report.isVisited = true;
        await this.db.write();
        return true;
    }
}

export { ReportDB, type Report };

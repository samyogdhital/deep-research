import { openDB, DBSchema } from 'idb';

interface ResearchSourcesLog {
    // Define the structure of ResearchSourcesLog here
}

interface ResearchReport {
    id: string;
    report_title: string;
    report: string;
    sourcesLog: ResearchSourcesLog;
    timestamp: number;
}

interface ResearchDBSchema extends DBSchema {
    reports: {
        key: string;
        value: ResearchReport;
    };
}

const DB_NAME = 'research_reports';
const STORE_NAME = 'reports';

export async function initDB() {
    return openDB<ResearchDBSchema>(DB_NAME, 1, {
        upgrade(db) {
            db.createObjectStore(STORE_NAME);
        },
    });
}

export async function saveReport(report: {
    report_title: string;
    report: string;
    sourcesLog: ResearchSourcesLog;
}) {
    const db = await initDB();
    const id = crypto.randomUUID();

    // Validate report_title exists
    if (!report.report_title?.trim()) {
        throw new Error('Report title is required');
    }

    const reportData: ResearchReport = {
        id,
        report_title: report.report_title.trim(),
        report: report.report,
        sourcesLog: report.sourcesLog,
        timestamp: Date.now()
    };

    await db.put(STORE_NAME, reportData, id);
    return id;
}

export async function getReport(id: string) {
    const db = await initDB();
    return db.get(STORE_NAME, id);
}

export async function getAllReports() {
    const db = await initDB();
    return db.getAll(STORE_NAME);
}

export async function updateReportTitle(id: string, newTitle: string) {
    const db = await initDB();
    const report = await db.get(STORE_NAME, id);
    if (!report) throw new Error('Report not found');

    report.report_title = newTitle;
    await db.put(STORE_NAME, report, id);
}

export async function deleteReport(id: string) {
    const db = await initDB();
    await db.delete(STORE_NAME, id);
}

export async function clearAllReports() {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await tx.store.clear();
    return tx.done;
}

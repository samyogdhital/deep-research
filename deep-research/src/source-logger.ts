import * as fs from 'fs/promises';
import path from 'path';
import { SerpQueryResult, ResearchSourcesLog } from './types';

export class SourceLogger {
    private sourcesLogPath: string;
    private currentLog: ResearchSourcesLog;

    constructor() {
        this.sourcesLogPath = path.join(process.cwd(), 'sources-log.json');
        this.currentLog = {
            queries: [],
            lastUpdated: new Date().toISOString()
        };
    }

    async addQueryResult(queryResult: SerpQueryResult) {
        this.currentLog.queries.push(queryResult);
        this.currentLog.lastUpdated = new Date().toISOString();
        await this.saveLog();
    }

    private async saveLog() {
        await fs.writeFile(
            this.sourcesLogPath,
            JSON.stringify(this.currentLog, null, 2)
        );
    }

    getCurrentLog(): ResearchSourcesLog {
        return this.currentLog;
    }
}

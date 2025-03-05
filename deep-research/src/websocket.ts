import { Server } from 'socket.io';
import { createServer } from 'http';
import { ResearchDB } from './db';
import { WebsiteStatus } from './types';
import type { DBSchema } from './db';

export interface ResearchState {
    id: string;
    prompt: string;
    status: 'collecting' | 'analyzing' | 'generating' | 'complete' | 'failed';
    startTime: number;
    controller?: AbortController;
    cleanup?: () => void;
}

// The only payload we send is the research data
type WebSocketPayload = DBSchema['researches'][number]

export class WebSocketManager {
    private io: Server;

    constructor(httpServer: ReturnType<typeof createServer>, frontendUrl: string) {
        this.io = new Server(httpServer, {
            cors: {
                origin: frontendUrl,
                methods: ['GET', 'POST']
            }
        });

        this.io.on('connection', (socket) => {
            console.log('Client connected');
            socket.on('disconnect', () => {
                console.log('Client disconnected');
            });
        });
    }

    private async emitEvent(event: string, report_id: string): Promise<void> {
        try {
            // Get fresh DB data before emitting
            const db = await ResearchDB.getInstance();
            const freshData = await db.getResearchData(report_id);

            if (!freshData) {
                console.error(`No research data found for report_id ${report_id}`);
                return;
            }

            // Send only the research data
            const payload: WebSocketPayload = {
                ...freshData
            };

            this.io.emit(event, payload);
        } catch (error) {
            console.error(`Error emitting ${event}:`, error);
            this.io.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
        }
    }

    // Research Start Process Events
    async handleGeneratingFollowups(report_id: string): Promise<void> {
        await this.emitEvent('generating_followups', report_id);
    }

    async handleFollowupsGenerated(report_id: string): Promise<void> {
        await this.emitEvent('followups_generated', report_id);
    }

    async handleResearchStart(research: ResearchState): Promise<void> {
        await this.emitEvent('research_start', research.id);
    }

    // Information Gathering Process Events
    async handleNewSerpQuery(report_id: string): Promise<void> {
        await this.emitEvent('new_serp_query', report_id);
    }

    async handleGotWebsitesFromSerpQuery(report_id: string): Promise<void> {
        await this.emitEvent('got_websites_from_serp_query', report_id);
    }

    async handleWebsiteScraping(report_id: string, website: WebsiteStatus): Promise<void> {
        await this.emitEvent('scraping_a_website', report_id);
    }

    async handleWebsiteAnalyzing(report_id: string, website: WebsiteStatus): Promise<void> {
        await this.emitEvent('analyzing_a_website', report_id);
    }

    async handleWebsiteAnalyzed(report_id: string, website: WebsiteStatus): Promise<void> {
        await this.emitEvent('analyzed_a_website', report_id);
    }

    // Information Crunching Process Events
    async handleCrunchingQuery(report_id: string): Promise<void> {
        await this.emitEvent('crunching_a_serp_query', report_id);
    }

    async handleQueryCrunched(report_id: string): Promise<void> {
        await this.emitEvent('crunched_a_serp_query', report_id);
    }

    // Report Writing Process Events
    async handleReportWritingStart(report_id: string): Promise<void> {
        await this.emitEvent('report_writing_start', report_id);
    }

    async handleReportWritingComplete(report_id: string): Promise<void> {
        await this.emitEvent('report_writing_successfull', report_id);
    }

    // Error Handling - Special case, doesn't send research data
    async handleResearchError(error: Error): Promise<void> {
        this.io.emit('research_error', { error: error.message });
    }
}

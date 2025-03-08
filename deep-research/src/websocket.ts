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
    private activeResearchIds: Set<string> = new Set();

    constructor(httpServer: ReturnType<typeof createServer>, frontendUrl: string) {
        this.io = new Server(httpServer, {
            cors: {
                origin: frontendUrl,
                methods: ['GET', 'POST']
            }
        });

        this.io.on('connection', (socket) => {
            console.log('Client connected');
            // Send current active researches to new client
            socket.emit('active_researches', Array.from(this.activeResearchIds));
            socket.on('disconnect', () => {
                console.log('Client disconnected');
            });
        });
    }

    // Expose active research IDs
    getActiveResearchIds(): Set<string> {
        return this.activeResearchIds;
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
        this.activeResearchIds.add(research.id);
        await this.emitEvent('research_start', research.id);
        // Broadcast updated active research list
        this.io.emit('active_researches', Array.from(this.activeResearchIds));
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
        this.activeResearchIds.delete(report_id);
        await this.emitEvent('report_writing_successfull', report_id);
        // Broadcast updated active research list
        this.io.emit('active_researches', Array.from(this.activeResearchIds));
    }

    // Error Handling - Special case, doesn't send research data
    handleResearchError(error: Error, report_id?: string) {
        console.error('Research error:', error);

        // If we have a report_id, remove it from active researches
        if (report_id) {
            this.activeResearchIds.delete(report_id);
            // Notify all clients about the error
            this.io.emit('research_error', {
                error: error.message,
                report_id
            });
            // Update active researches list for all clients
            this.io.emit('active_researches', Array.from(this.activeResearchIds));
        } else {
            // General error without specific report
            this.io.emit('research_error', {
                error: error.message
            });
        }
    }
}

import { Server } from 'socket.io';
import { createServer } from 'http';
import { ResearchDB } from './db/db';
import { WebsiteStatus } from './types';
import type { DBSchema } from './db/db';



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

            this.io.emit(event, payload, report_id);
        } catch (error) {
            console.error(`Error emitting ${event}:`, error);
            this.io.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
        }
    }

    // Research Initialization Events
    async handleGeneratingFollowups(report_id: string): Promise<void> {
        await this.emitEvent('generating_followups', report_id);
    }

    async handleFollowupsGenerated(report_id: string): Promise<void> {
        await this.emitEvent('followups_generated', report_id);
    }

    async handleResearchStart(report_id: string): Promise<void> {
        this.activeResearchIds.add(report_id);
        await this.emitEvent('research_start', report_id);
        // Broadcast updated active research list
        this.io.emit('active_researches', Array.from(this.activeResearchIds));
    }

    // SERP Query Events
    async handleNewSerpQuery(report_id: string): Promise<void> {
        await this.emitEvent('new_serp_query', report_id);
    }

    async handleGotWebsitesFromSerpQuery(report_id: string): Promise<void> {
        await this.emitEvent('got_websites_from_serp_query', report_id);
    }

    async handleWebsitesFromSerpQueryFailed(report_id: string): Promise<void> {
        await this.emitEvent('websites_from_serp_query_failed', report_id);
    }

    async handleSerpQueryToInProgess(report_id: string): Promise<void> {
        await this.emitEvent('serp_query_in_progress', report_id);
    }

    async handleAnalyzingSerpQuery(report_id: string): Promise<void> {
        await this.emitEvent('analyzing_serp_query', report_id);
    }

    async handleAnalyzedSerpQuery(report_id: string): Promise<void> {
        await this.emitEvent('analyzed_serp_query', report_id);
    }

    async handleSerpQueryFailed(report_id: string): Promise<void> {
        await this.emitEvent('serp_query_failed', report_id);
    }

    // Website Processing Events
    async handleWebsiteScraping(report_id: string): Promise<void> {
        await this.emitEvent('scraping_a_website', report_id);
    }

    async handleWebsiteScraped(report_id: string): Promise<void> {
        await this.emitEvent('scraped_a_website', report_id);
    }

    async handleWebsiteScrapingFailed(report_id: string): Promise<void> {
        await this.emitEvent('scraping_a_website_failed', report_id);
    }

    async handleWebsiteAnalyzing(report_id: string): Promise<void> {
        await this.emitEvent('analyzing_a_website', report_id);
    }

    async handleWebsiteAnalyzed(report_id: string): Promise<void> {
        await this.emitEvent('analyzed_a_website', report_id);
    }

    async handleWebsiteAnalysisFailed(report_id: string): Promise<void> {
        await this.emitEvent('individual_website_analysis_failed', report_id);
    }

    // Report Generation Events
    async handleReportWritingStart(report_id: string): Promise<void> {
        await this.emitEvent('report_writing_start', report_id);
    }

    async handleReportWritingComplete(report_id: string): Promise<void> {
        this.activeResearchIds.delete(report_id);
        await this.emitEvent('report_writing_successfull', report_id);
        // Broadcast updated active research list
        this.io.emit('active_researches', Array.from(this.activeResearchIds));
    }

    // Error Handling Events
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

    // Utility Events
    clearAllActiveResearches() {
        this.activeResearchIds.clear();
        this.io.emit('active_researches', []);
    }
}

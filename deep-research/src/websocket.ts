import { Server as HttpServer } from 'http';
import { Server as WebSocketServer } from 'socket.io';
import { ResearchDB } from './db';
import { WebsiteStatus } from './types';

export interface ResearchState {
    id: string;
    prompt: string;
    status: 'idle' | 'collecting' | 'complete' | 'failed';
    startTime?: number;
    controller: AbortController;
    cleanup: () => void;
}

export class WebSocketManager {
    private io: WebSocketServer;
    private currentResearch: ResearchState | null = null;
    private db: ResearchDB | null = null;

    constructor(server: HttpServer, corsOrigin: string) {
        this.io = new WebSocketServer(server, {
            cors: {
                origin: corsOrigin,
                credentials: true
            }
        });
        this.setupSocketHandlers();
        // Initialize DB instance
        ResearchDB.getInstance().then(db => {
            this.db = db;
        });
    }

    private setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('Client connected:', socket.id);

            // Handle request for ongoing research state
            socket.on('request-ongoing-research', async () => {
                if (this.currentResearch) {
                    const data = await this.db?.getResearchData(this.currentResearch.id);
                    if (data) {
                        socket.emit('ongoing-research-state', data);
                    }
                }
            });

            socket.on('stop-research', () => {
                if (this.currentResearch) {
                    this.currentResearch.controller.abort();
                    this.currentResearch.cleanup();
                    this.currentResearch = null;
                }
            });
        });
    }

    // Core function to emit events with complete DB data
    private async emitWithData(event: string, researchId: string) {
        if (!this.db) {
            this.db = await ResearchDB.getInstance();
        }
        const researchData = await this.db.getResearchData(researchId);
        if (researchData) {
            this.io.emit(event, researchData);
        }
    }

    // Stage 1: Research Start Process
    public async handleResearchStart(research: ResearchState) {
        this.currentResearch = research;
        await this.emitWithData('generating_followups', research.id);
    }

    public async handleFollowupsGenerated(researchId: string) {
        await this.emitWithData('followups_generated', researchId);
    }

    // Stage 2: Information Gathering Process
    public async handleNewSerpQuery(researchId: string) {
        await this.emitWithData('new_serp_query', researchId);
    }

    public async handleGotWebsitesFromSerpQuery(researchId: string) {
        await this.emitWithData('got_websites_from_serp_query', researchId);
    }

    public async handleWebsiteScraping(researchId: string, website: WebsiteStatus) {
        // Ensure website status is updated in DB before emitting
        if (this.db) {
            const query = await this.db.getSerpQueryByWebsiteId(researchId, website.id);
            if (query) {
                website.status = 'scraping';
                await this.db.updateWebsiteStatus(researchId, query.query_timestamp, website);
                await this.emitWithData('scraping_a_website', researchId);
            }
        }
    }

    public async handleWebsiteAnalyzing(researchId: string, website: WebsiteStatus) {
        // Update status to analyzing in DB before emitting
        if (this.db) {
            const query = await this.db.getSerpQueryByWebsiteId(researchId, website.id);
            if (query) {
                website.status = 'analyzing';
                await this.db.updateWebsiteStatus(researchId, query.query_timestamp, website);
                await this.emitWithData('analyzing_a_website', researchId);
            }
        }
    }

    public async handleWebsiteAnalyzed(researchId: string, website: WebsiteStatus) {
        // Update status to analyzed in DB before emitting
        if (this.db) {
            const query = await this.db.getSerpQueryByWebsiteId(researchId, website.id);
            if (query) {
                website.status = 'analyzed';
                await this.db.updateWebsiteStatus(researchId, query.query_timestamp, website);
                await this.emitWithData('analyzed_a_website', researchId);
            }
        }
    }

    // Stage 3: Information Crunching Process
    public async handleCrunchingStart(researchId: string) {
        await this.emitWithData('crunching_a_serp_query', researchId);
    }

    public async handleCrunchingComplete(researchId: string) {
        await this.emitWithData('crunched_a_serp_query', researchId);
    }

    // Stage 4: Report Writing Process
    public async handleReportWritingStart(researchId: string) {
        await this.emitWithData('report_writing_start', researchId);
    }

    public async handleReportWritingComplete(researchId: string) {
        await this.emitWithData('report_writing_successfull', researchId);
        // Research is complete, clear current research
        if (this.currentResearch?.id === researchId) {
            this.currentResearch = null;
        }
    }

    // Error handling
    public async handleResearchError(error: Error) {
        if (this.currentResearch) {
            this.currentResearch.status = 'failed';
            await this.emitWithData('research_error', this.currentResearch.id);
            this.currentResearch = null;
        }
        this.io.emit('log', `Error: ${error.message}`);
    }
}

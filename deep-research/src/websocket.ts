import { Server as HttpServer } from 'http';
import { Server as WebSocketServer } from 'socket.io';
import { OutputManager } from './output-manager';
import { WebsiteResult, CrunchedInfo } from './types';

export interface ResearchState {
    id: string;
    prompt: string;
    sourcesLog?: any;
    status: 'idle' | 'collecting' | 'complete' | 'failed';
    startTime?: number;
    controller: AbortController;
    cleanup: () => void;
}

interface QueryData {
    query: string;
    objective: string;
    query_rank: number;
    successful_scraped_websites?: WebsiteResult[];
    failedWebsites?: string[];
    timestamp?: string;
}

export class WebSocketManager {
    private io: WebSocketServer;
    private output: OutputManager;
    private currentResearch: ResearchState | null = null;
    private queries: Map<number, QueryData> = new Map();
    private crunchedInfo: CrunchedInfo[] = [];
    private currentPhase: string = 'understanding';

    constructor(server: HttpServer, corsOrigin: string, output: OutputManager) {
        this.io = new WebSocketServer(server, {
            cors: {
                origin: corsOrigin,
                credentials: true
            }
        });
        this.output = output;
        this.setupSocketHandlers();
    }

    private setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            // Handle request for initial state
            socket.on('get-research-state', () => {
                socket.emit('research-state', {
                    phase: this.currentPhase,
                    queries: Array.from(this.queries.values()).sort((a, b) => a.query_rank - b.query_rank),
                    crunchedInfo: this.crunchedInfo
                });
            });

            socket.on('stop-research', () => {
                if (this.currentResearch) {
                    this.updateResearchPhase('stopped');
                    this.currentResearch.controller.abort();
                    this.currentResearch.cleanup();
                    this.currentResearch = null;
                }
            });
        });
    }

    private emit(event: string, data?: any) {
        this.io.emit(event, data);
    }

    public sendLog(message: string) {
        this.emit('log', message);
    }

    updateResearchPhase(phase: 'understanding' | 'gathering' | 'crunching' | 'writing' | 'complete' | 'stopped' | 'error') {
        // Only update if the phase is actually changing
        if (this.currentPhase !== phase) {
            this.currentPhase = phase;
            this.emit('research-phase', phase);

            const phaseMessages = {
                understanding: 'Generating follow-up questions...',
                gathering: 'Starting deep research...',
                crunching: 'Information crunching started',
                writing: 'Generating report',
                complete: 'Research completed successfully',
                stopped: 'Research process stopped',
                error: 'Research process encountered an error'
            };

            this.sendLog(phaseMessages[phase]);
        }
    }

    handleResearchStart(research: ResearchState) {
        this.currentResearch = research;
        this.queries.clear(); // Clear any previous queries
        this.crunchedInfo = []; // Clear any previous crunched info
        this.updateResearchPhase('understanding');
    }

    updateSourceProgress(queryData: QueryData) {
        // If this is the first query, transition to gathering phase
        if (this.queries.size === 0) {
            this.updateResearchPhase('gathering');
        }

        // Update local state
        this.queries.set(queryData.query_rank, queryData);

        // Emit update with full query data
        this.emit('sources-update', {
            queries: Array.from(this.queries.values()).sort((a, b) => a.query_rank - b.query_rank)
        });
    }

    updateWebsiteAnalysis(queryRank: number, website: WebsiteResult) {
        const query = this.queries.get(queryRank);
        if (!query) return;

        // First emit the individual website analysis
        this.emit('website-analysis', {
            queryRank,
            website
        });

        // Then update the full query state
        if (!query.successful_scraped_websites) {
            query.successful_scraped_websites = [];
        }
        query.successful_scraped_websites.push(website);

        // Emit update with full query data
        this.emit('sources-update', {
            queries: Array.from(this.queries.values()).sort((a, b) => a.query_rank - b.query_rank)
        });
    }

    updateInformationCrunching(crunchedData: CrunchedInfo) {
        // First time receiving crunched data, emit crunching start
        if (this.crunchedInfo.length === 0) {
            this.updateResearchPhase('crunching');
            this.emit('information-crunching-start', true);
        }

        this.crunchedInfo.push(crunchedData);

        // Emit both the new data and full state
        this.emit('information-crunching-update', {
            crunchedInfo: this.crunchedInfo
        });
    }

    handleResearchComplete(reportId: string, title: string) {
        if (!this.currentResearch) return;

        this.updateResearchPhase('writing');

        // Emit the completion after a short delay to allow for writing phase UI update
        setTimeout(() => {
            this.updateResearchPhase('complete');
            this.emit('research-completed', {
                id: reportId,
                report_title: title
            });

            // Clear state
            this.currentResearch = null;
            this.queries.clear();
            this.crunchedInfo = [];
        }, 2000);
    }

    handleResearchError(error: Error) {
        this.updateResearchPhase('error');
        this.emit('log', `Error: ${error.message}`);

        if (this.currentResearch) {
            this.currentResearch = null;
        }
    }
}

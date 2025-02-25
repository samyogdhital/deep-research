import { Server as SocketServer, Socket } from 'socket.io';
import { Server } from 'http';
import { OutputManager } from './output-manager';

export interface ResearchState {
    controller: AbortController;
    cleanup: () => void;
    sourcesLog?: {
        queries: any[];
        lastUpdated: string;
    };
}

export class WebSocketManager {
    private io: SocketServer;
    private currentResearch: ResearchState | null = null;
    private ongoingResearch = new Map<string, {
        id: string;
        prompt: string;
        startTime: number;
        status: 'collecting' | 'analyzing' | 'generating';
    }>();

    constructor(httpServer: Server, frontendUrl: string, output: OutputManager) {
        this.io = new SocketServer(httpServer, {
            cors: {
                origin: frontendUrl,
                methods: ["GET", "POST"],
                credentials: true,
                allowedHeaders: ["Content-Type"]
            }
        });

        this.setupSocketHandlers();
    }

    private setupSocketHandlers() {
        this.io.on('connection', (socket: Socket) => {
            socket.emit('ongoing-research-update', Array.from(this.ongoingResearch.values()));

            socket.on('request-ongoing-research', () => {
                socket.emit('ongoing-research-update', Array.from(this.ongoingResearch.values()));
            });

            socket.on('stop-research', () => {
                if (this.currentResearch) {
                    this.broadcast('Research terminated by user');
                    this.currentResearch.controller.abort();
                    this.currentResearch.cleanup();
                    this.currentResearch = null;
                }
            });

            socket.on('request-sources', () => {
                if (this.currentResearch?.sourcesLog) {
                    socket.emit('sources-update', this.currentResearch.sourcesLog);
                }
            });
        });
    }

    public broadcast(message: string) {
        this.io.emit('log', message);
    }

    public setCurrentResearch(research: ResearchState) {
        this.currentResearch = research;
    }

    public updateResearchStatus(researchId: string, research: {
        id: string;
        prompt: string;
        startTime: number;
        status: 'collecting' | 'analyzing' | 'generating';
    }) {
        this.ongoingResearch.set(researchId, research);
        this.io.emit('ongoing-research-update', Array.from(this.ongoingResearch.values()));
    }

    public removeResearch(researchId: string) {
        this.ongoingResearch.delete(researchId);
        this.io.emit('ongoing-research-update', Array.from(this.ongoingResearch.values()));
    }

    public updateResearchPhase(phase: string) {
        this.io.emit('research-phase', phase);
    }

    public updateSources(sourcesLog: any) {
        this.io.emit('sources-update', sourcesLog);
    }

    public notifyReportComplete(data: { id: string; report_title: string }) {
        this.io.emit('reports-updated');
        this.io.emit('research-completed', data);
    }

    public notifyResearchFailed(researchId: string) {
        this.io.emit('research-failed', { id: researchId });
    }

    public async handleResearchStart(research: ResearchState, context: {
        researchId: string,
        prompt: string,
        signal: AbortSignal,
        onProgress: (progress: any) => void
    }) {
        this.setCurrentResearch(research);
        this.updateResearchStatus(context.researchId, {
            id: context.researchId,
            prompt: context.prompt,
            startTime: Date.now(),
            status: 'collecting'
        });
        this.updateResearchPhase('collecting-sources');
    }

    public handleSourceUpdate(queryData: any) {
        if (this.currentResearch?.sourcesLog) {
            const updatedQuery = {
                ...queryData,
                timestamp: new Date().toISOString()
            };
            this.currentResearch.sourcesLog.queries.push(updatedQuery);
            this.currentResearch.sourcesLog.lastUpdated = new Date().toISOString();
            this.updateSources(this.currentResearch.sourcesLog);
        }
    }

    public handleResearchComplete(researchId: string, reportTitle: string, reportId: string, sourcesLog: any) {
        this.removeResearch(researchId);
        this.notifyReportComplete({
            id: researchId,
            report_title: reportTitle
        });
        return {
            id: reportId,
            report_title: reportTitle,
            sourcesLog
        };
    }

    public handleResearchError(error: Error, researchId?: string) {
        this.updateResearchPhase('idle');

        if (error.name === 'AbortError') {
            this.broadcast('Research process stopped');
            return { status: 'stopped' };
        }

        if (researchId) {
            this.removeResearch(researchId);
            this.notifyResearchFailed(researchId);
        }

        this.broadcast(`Error: ${error.message}`);
        return {
            error: 'Research failed',
            details: error.message
        };
    }
}

import express, { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { deepResearch } from './src/deep-research';
import { OutputManager } from './src/output-manager';
import { setBroadcastFn } from './src/deep-research';
import { ResearchDB } from './src/db';
import { generateFollowUps } from './src/agent/prompt-analyzer';
import { ReportWriter } from './src/agent/report-writer';
import { WebSocketManager, ResearchState } from './src/websocket';
import { config as envConfig } from 'dotenv';
import { ResearchProgress, DeepResearchOptions, WebsiteResult, CrunchedInfo } from './src/types';

envConfig();
const app = express();
const httpServer = createServer(app);

// Initialize managers
const output = new OutputManager();
const wsManager = new WebSocketManager(httpServer, process.env.FRONTEND_BASE_URL!, output);

// Set broadcast function
setBroadcastFn((message: string) => wsManager.sendLog(message));

// Express middleware
app.use(cors({ origin: process.env.FRONTEND_BASE_URL, credentials: true }));
app.use(express.json({
    strict: true,
    limit: '10mb',
    type: 'application/json'
}));

// API Routes
app.post('/api/research/questions', async (req: Request, res: Response): Promise<void> => {
    const { prompt, followupQuestions } = req.body;
    try {
        if (!prompt) {
            res.status(400).json({ error: 'Prompt is required' });
            return;
        }

        const questions = await generateFollowUps({
            query: prompt,
            numQuestions: followupQuestions
        });

        wsManager.updateResearchPhase('understanding');
        res.json({ questions });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        wsManager.handleResearchError(new Error(errorMessage));
        res.status(500).json({
            error: 'Failed to analyze prompt',
            details: errorMessage
        });
    }
});

app.post('/api/research/start', async (req: Request, res: Response): Promise<void> => {
    try {
        const { initial_query, depth, breadth, followUpAnswers, followUps_num } = req.body;

        // Validate required fields
        if (!initial_query?.trim()) {
            res.status(400).json({ error: 'Initial query is required' });
            return;
        }

        // Input validation
        if (depth < 1 || depth > 10 || breadth < 1 || breadth > 10 || followUps_num < 1 || followUps_num > 10) {
            res.status(400).json({ error: 'Invalid depth, breadth, or followUps_num values. Must be between 1 and 10.' });
            return;
        }

        // Initialize research in database
        const db = await ResearchDB.getInstance();
        const report_id = await db.initializeResearch(initial_query, depth, breadth, followUps_num);

        // Save follow-up QnA
        try {
            for (const [question, answer] of Object.entries(followUpAnswers)) {
                await db.addFollowUpQnA(report_id, {
                    id: parseInt(question),
                    question,
                    answer: answer as string
                });
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            wsManager.handleResearchError(new Error(errorMessage));
            throw error;
        }

        // Setup research state
        const controller = new AbortController();
        const research: ResearchState = {
            id: report_id,
            prompt: initial_query,
            status: 'collecting',
            startTime: Date.now(),
            controller,
            cleanup: () => { }
        };

        // Start research process
        wsManager.handleResearchStart(research);

        const fullContext = `
Initial Query: ${initial_query}
Follow-up Answers:
${Object.entries(followUpAnswers).map(([q, a]) => `Q: ${q}\nA: ${a}`).join('\n\n')}`;

        const { learnings, visitedUrls, failedUrls } = await deepResearch({
            query_to_find_websites: fullContext,
            depth,
            breadth,
            signal: controller.signal,
            onProgress: (progress) => {
                output.updateProgress(progress);
                wsManager.updateResearchPhase('gathering');
            },
            onSourceUpdate: (queryData) => {
                wsManager.updateSourceProgress(queryData);
            },
            onWebsiteAnalysis: (queryRank: number, website: WebsiteResult) => {
                wsManager.updateWebsiteAnalysis(queryRank, website);
            },
            onInformationCrunching: (crunchedData: CrunchedInfo) => {
                wsManager.updateResearchPhase('crunching');
                wsManager.updateInformationCrunching(crunchedData);
            },
            researchId: report_id
        } as DeepResearchOptions);

        if (!learnings?.length || !visitedUrls?.length) {
            throw new Error('Research completed but no results were found.');
        }

        // Generate report
        wsManager.updateResearchPhase('writing');
        const reportWriter = new ReportWriter(output);
        const report = await reportWriter.generateReport({
            prompt: initial_query,
            learnings: learnings,
            visitedUrls: visitedUrls
        });

        // Complete research
        wsManager.handleResearchComplete(report_id, report.report_title);
        res.json(await db.getResearchData(report_id));

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        wsManager.handleResearchError(new Error(errorMessage));
        res.status(500).json({
            error: 'Research failed',
            details: errorMessage
        });
    }
});

app.get('/api/reports', async (req: Request, res: Response) => {
    const db = await ResearchDB.getInstance();
    const reports = await db.getAllReports();
    res.json(reports);
});

// Get a single report by ID
app.get('/api/reports/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ error: 'Report ID is required' });
        return;
    }

    const db = await ResearchDB.getInstance();
    const report = await db.getResearchData(id);

    if (!report?.report) {
        res.status(404).json({ error: 'Report not found' });
        return;
    }

    res.json(report.report);
});

// Mark a report as visited
app.patch('/api/reports/:id/visit', async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ error: 'Report ID is required' });
        return;
    }

    const db = await ResearchDB.getInstance();
    const success = await db.markReportAsVisited(id);

    if (!success) {
        res.status(404).json({ error: 'Report not found' });
        return;
    }

    res.json({ success: true });
});

// Update report title
app.patch('/api/reports/:id/title', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { title } = req.body;

    if (!id || !title?.trim()) {
        res.status(400).json({ error: 'Report ID and title are required' });
        return;
    }

    const db = await ResearchDB.getInstance();
    const success = await db.updateReportTitle(id, title);

    if (!success) {
        res.status(404).json({ error: 'Report not found' });
        return;
    }

    res.json({ success: true });
});

// Delete a single report
app.delete('/api/reports/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ error: 'Report ID is required' });
        return;
    }

    const db = await ResearchDB.getInstance();
    const success = await db.deleteReport(id);

    if (!success) {
        res.status(404).json({ error: 'Report not found' });
        return;
    }

    res.json({ success: true });
});

// Clear all reports
app.delete('/api/reports', async (req: Request, res: Response) => {
    const db = await ResearchDB.getInstance();
    const success = await db.clearAllReports();
    res.json({ success });
});

// `npm run debug -- 1001` to debug
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// `
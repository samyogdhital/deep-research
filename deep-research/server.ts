import express, { Request, Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { deepResearch } from './src/deep-research';
import { OutputManager } from './src/output-manager';
import { setBroadcastFn } from './src/deep-research';
import { ReportDB } from './src/db';
import { generateFollowUps } from './src/agent/prompt-analyzer';
import { ReportWriter } from './src/agent/report-writer';
import { WebSocketManager } from './src/websocket';
import { config as envConfig } from 'dotenv';

envConfig();
const app = express();
app.use(express.json())
const httpServer = createServer(app);

// Initialize managers
const output = new OutputManager();
const wsManager = new WebSocketManager(httpServer, process.env.FRONTEND_BASE_URL!, output);

// Set broadcast function
setBroadcastFn((message: string) => wsManager.broadcast(message));

// Express middleware
app.use(cors({ origin: process.env.FRONTEND_BASE_URL, credentials: true }));
app.use(express.json());

// API Routes
app.post('/api/research/questions', async (req: Request, res: Response): Promise<void> => {
    const { prompt, followupQuestions } = req.body;
    try {
        if (!prompt) res.status(400).json({ error: 'Prompt is required' });

        const questions = await generateFollowUps({
            query: prompt,
            numQuestions: followupQuestions
        });

        wsManager.broadcast('Questions generated successfully');
        res.json({ questions });
    } catch (error) {
        wsManager.broadcast(`Error: ${error.message}`);
        res.status(500).json({
            error: 'Failed to analyze prompt',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

app.post('/api/research/start', async (req: Request, res: Response): Promise<void> => {
    try {
        const { researchId, prompt, depth, breadth, followUpAnswers } = req.body;
        if (!prompt?.trim()) {
            res.status(400).json({ error: 'Prompt is required' });
            return;
        }

        // Setup research state
        const controller = new AbortController();
        const research = {
            controller,
            cleanup: () => { },
            sourcesLog: {
                queries: [],
                lastUpdated: new Date().toISOString()
            }
        };

        // Initialize research with WebSocket
        await wsManager.handleResearchStart(research, {
            researchId,
            prompt,
            signal: controller.signal,
            onProgress: (progress) => output.updateProgress(progress)
        });

        // Start research
        const fullContext = `
Initial Query: ${prompt}
Follow-up Answers:
${Object.entries(followUpAnswers).map(([q, a]) => `Q: ${q}\nA: ${a}`).join('\n\n')}`;

        const { learnings, visitedUrls, failedUrls } = await deepResearch({
            query_to_find_websites: fullContext,
            depth,
            breadth,
            signal: controller.signal,
            onProgress: (progress) => output.updateProgress(progress),
            onSourceUpdate: (queryData) => wsManager.handleSourceUpdate(queryData)
        });

        // Generate and save report
        wsManager.updateResearchPhase('generating-report');
        const reportWriter = new ReportWriter(output);
        const report = await reportWriter.generateReport({
            prompt,
            learnings: learnings,
            visitedUrls: visitedUrls
        });

        const db = await ReportDB.getInstance();
        const reportId = await db.saveReport({
            report_title: report.report_title,
            report: report.report,
            sourcesLog: research.sourcesLog
        });

        // Complete research
        const response = wsManager.handleResearchComplete(
            researchId,
            report.report_title,
            reportId,
            research.sourcesLog
        );
        res.json({ ...response, failedUrls });

    } catch (error) {
        const errorResponse = wsManager.handleResearchError(error, req.body.researchId);
        res.status(error.name === 'AbortError' ? 200 : 500).json(errorResponse);
    }
});

app.get('/api/reports/:id', async (req, res): Promise<void> => {
    const db = await ReportDB.getInstance();
    const report = await db.getReport(req.params.id);
    if (!report) res.status(404).json({ error: 'Report not found' });
    res.json(report);
});

app.get('/api/reports', async (req, res) => {
    const db = await ReportDB.getInstance();
    const reports = await db.getAllReports();
    res.json(reports);
});

// `npm run debug -- 1001` to debug
const debugPort = process.argv.slice(2)[0]
const PORT = process.env.PORT || debugPort || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

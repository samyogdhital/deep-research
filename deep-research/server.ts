import express, { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { deepResearch } from './src/deep-research';
import { OutputManager } from './src/output-manager';
import { setBroadcastFn } from './src/deep-research';
import { ResearchDB } from './src/db';
import { generateFollowUps } from './src/agent/prompt-analyzer';
import { ReportWriter } from './src/agent/report-writer';
import { WebSocketManager } from './src/websocket';
import { config as envConfig } from 'dotenv';
import { ResearchProgress } from './src/types';

envConfig();
const app = express();
const httpServer = createServer(app);

// Initialize managers
const output = new OutputManager();
const wsManager = new WebSocketManager(httpServer, process.env.FRONTEND_BASE_URL!, output);

// Set broadcast function
setBroadcastFn((message: string) => wsManager.broadcast(message));

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

        wsManager.broadcast('Questions generated successfully');
        res.json({ questions });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        wsManager.broadcast(`Error: ${errorMessage}`);
        res.status(500).json({
            error: 'Failed to analyze prompt',
            details: errorMessage
        });
    }
});

app.post('/api/research/start', async (req: Request, res: Response): Promise<void> => {
    try {
        const { prompt, depth, breadth, followUpAnswers, followUps_num } = req.body;
        if (!prompt?.trim()) {
            res.status(400).json({ error: 'Prompt is required' });
            return;
        }

        // Input validation
        if (depth < 1 || depth > 10 || breadth < 1 || breadth > 10 || followUps_num < 1 || followUps_num > 10) {
            res.status(400).json({ error: 'Invalid depth, breadth, or followUps_num values. Must be between 1 and 10.' });
            return;
        }

        // Initialize research in database
        const db = await ResearchDB.getInstance();
        const report_id = await db.initializeResearch(prompt, depth, breadth, followUps_num);

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
            wsManager.broadcast(`Error saving follow-up answers: ${errorMessage}`);
            throw error;
        }

        // Setup research state
        const controller = new AbortController();
        const research = {
            controller,
            cleanup: () => { },
            sourcesLog: {
                queries: [],
                lastUpdated: new Date().toISOString()
            },
            onProgress: (progress: ResearchProgress) => output.updateProgress(progress)
        };

        // Set current research in WebSocket manager
        wsManager.setCurrentResearch(research);
        wsManager.handleResearchStart(research, {
            researchId: report_id,
            prompt,
            signal: controller.signal,
            onProgress: research.onProgress
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
            onSourceUpdate: (queryData) => wsManager.handleSourceUpdate(queryData),
            researchId: report_id
        });

        // Log research results
        console.log('Research completed with:', {
            learningsCount: learnings?.length || 0,
            visitedUrlsCount: visitedUrls?.length || 0,
            failedUrlsCount: failedUrls?.length || 0
        });

        if (!learnings?.length || !visitedUrls?.length) {
            throw new Error('Research completed but no results were found. This could be because no relevant content was found or all website analyses failed.');
        }

        // Generate and save report
        wsManager.updateResearchPhase('generating-report');
        const reportWriter = new ReportWriter(output);
        const report = await reportWriter.generateReport({
            prompt,
            learnings: learnings,
            visitedUrls: visitedUrls
        });

        // Log report generation
        console.log('Report generated with:', {
            title: report.report_title,
            sectionsCount: report.report.split('\n#').length,
            sourcesCount: report.sources?.length || 0
        });

        // Parse the markdown report to extract sections
        const sections = report.report.split('\n#').map((section, index) => {
            const lines = section.trim().split('\n');
            const heading = lines[0]?.replace(/^#+\s*/, '') || `Section ${index + 1}`;
            const content = lines.slice(1).join('\n').trim();
            return {
                rank: index + 1,
                sectionHeading: heading,
                content: content
            };
        });

        // Save report using the same ResearchDB instance
        await db.saveReport({
            title: report.report_title,
            report_id,
            sections: sections.filter(s => s.sectionHeading && s.content),
            citedUrls: report.sources.map((source, index) => ({
                rank: index + 1,
                url: source.url,
                title: source.title,
                oneValueablePoint: source.title
            })),
            isVisited: false
        });

        // Get complete research data from database
        const researchData = await db.getResearchData(report_id);
        if (!researchData) {
            throw new Error('Failed to retrieve research data from database');
        }

        // Complete research
        wsManager.handleResearchComplete(
            report_id,
            report.report_title,
            report_id,
            research.sourcesLog
        );

        // Send only the database data to frontend
        res.json(researchData);

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        wsManager.broadcast(`Error: ${errorMessage}`);
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

// `npm run debug -- 1001` to debug
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

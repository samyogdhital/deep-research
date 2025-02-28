import express, { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { deepResearch } from './src/deep-research';
import { ResearchDB } from './src/db';
import { generateFollowUps } from './src/agent/prompt-analyzer';
import { ReportWriter } from './src/agent/report-writer';
import { WebSocketManager, ResearchState } from './src/websocket';
import { config as envConfig } from 'dotenv';
import { ResearchProgress, DeepResearchOptions, WebsiteResult, CrunchedInfo, QueryData } from './src/types';

envConfig();
const app = express();
const httpServer = createServer(app);

// Initialize managers
const wsManager = new WebSocketManager(httpServer, process.env.FRONTEND_BASE_URL!);

// Express middleware
app.use(cors({
    origin: "*",// process.env.FRONTEND_BASE_URL,
    credentials: true
}));
app.use(express.json({
    strict: true,
    limit: '10mb',
    type: 'application/json'
}));

// API Routes
app.post('/api/research/questions', async (req: Request, res: Response): Promise<void> => {
    const { prompt = '', followupQuestions = 5 } = req.body;
    try {
        if (!prompt.trim()) {
            res.status(400).json({ error: 'Prompt is required' });
            return;
        }

        // Initialize research in database first with a new report_id
        const db = await ResearchDB.getInstance();
        const report_id = await db.initializeResearch(prompt, 1, 1, followupQuestions);

        // Generate follow-up questions
        const questions = await generateFollowUps({
            query: prompt,
            numQuestions: followupQuestions
        });

        // Save the generated questions with empty answers
        for (let i = 0; i < questions.length; i++) {
            await db.addFollowUpQnA(report_id, {
                id: i + 1,
                question: questions[i] || '',  // Handle potential undefined
                answer: ''  // Empty answer initially
            });
        }

        // Return both questions and report_id
        res.json({ questions, report_id });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            error: 'Failed to analyze prompt',
            details: errorMessage
        });
    }
});

app.post('/api/research/start', async (req: Request, res: Response): Promise<void> => {
    try {
        const { initial_query, depth, breadth, followUpAnswers, followUps_num, report_id: provided_report_id } = req.body;

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

        const db = await ResearchDB.getInstance();
        let report_id: string;

        if (provided_report_id) {
            // Check if research exists
            const existingResearch = await db.getResearchData(provided_report_id);
            if (!existingResearch) {
                res.status(404).json({ error: 'Research not found' });
                return;
            }
            report_id = provided_report_id;

            // Update research parameters
            await db.updateResearchParameters(report_id, {
                depth,
                breadth,
                followUps_num
            });
        } else {
            // Initialize new research since no report_id was provided
            report_id = await db.initializeResearch(initial_query, depth, breadth, followUps_num);
        }

        // Save follow-up QnA
        for (const [question, answer] of Object.entries(followUpAnswers)) {
            await db.addFollowUpQnA(report_id, {
                id: parseInt(question),
                question,
                answer: answer as string
            });
        }

        // Start research process
        const controller = new AbortController();
        const research: ResearchState = {
            id: report_id,
            prompt: initial_query,
            status: 'collecting',
            startTime: Date.now(),
            controller,
            cleanup: () => { }
        };

        await wsManager.handleResearchStart(research);

        const fullContext = `
Initial Query: ${initial_query}
Follow-up Answers:
${Object.entries(followUpAnswers).map(([q, a]) => `Q: ${q}\nA: ${a}`).join('\n\n')}`;

        const { learnings, failedUrls } = await deepResearch({
            query_to_find_websites: fullContext,
            depth,
            breadth,
            signal: controller.signal,
            researchId: report_id,
            wsManager
        });

        if (!learnings?.length) {
            throw new Error('Research completed but no results were found.');
        }

        // Generate report
        await wsManager.handleReportWritingStart(report_id);
        const reportWriter = new ReportWriter();
        const report = await reportWriter.generateReport({
            prompt: initial_query,
            learnings: learnings
        });

        // Save the report to database
        await db.saveReport({
            report_id,
            title: report.title,
            sections: report.sections.map(section => ({
                rank: section.rank,
                sectionHeading: section.sectionHeading,
                content: section.content
            })),
            citedUrls: report.citedUrls.map((url, index) => ({
                rank: index + 1,
                url: url.url,
                title: url.title,
                oneValueablePoint: url.oneValueablePoint
            })),
            isVisited: false,
            timestamp: Date.now()
        });

        // Complete research
        await wsManager.handleReportWritingComplete(report_id);
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
    const researches = await db.getAllReports();
    res.json(researches);
});

// Get a single report by ID
app.get('/api/reports/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ error: 'Report ID is required' });
        return;
    }

    const db = await ResearchDB.getInstance();
    const research = await db.getResearchData(id);

    if (!research) {
        res.status(404).json({ error: 'Research not found' });
        return;
    }

    res.json(research);
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
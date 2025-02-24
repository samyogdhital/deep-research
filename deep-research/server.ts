import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import cors from 'cors';
import { generateFeedback } from './src/feedback';
import { deepResearch, writeFinalReport } from './src/deep-research';
import { OutputManager } from './src/output-manager';
import * as fs from 'fs/promises';
import path from 'path';
import { setBroadcastFn } from './src/deep-research';
import { ReportDB } from './src/db';

import { config } from 'dotenv';

config()
const app = express();
const httpServer = createServer(app);

console.log("✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅", process.env.FRONTEND_BASE_URL, "😄😄😄😄😄😄😄😄😄😄")

const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_BASE_URL,  // Frontend URL
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["Content-Type"]
    }
});

// Add AbortController for managing research termination
let currentResearch: {
    controller: AbortController;
    cleanup: () => void;
    sourcesLog?: {
        queries: any[];
        lastUpdated: string;
    };
} | null = null;

// Add type for research phases
type ResearchPhase = 'idle' | 'collecting-sources' | 'analyzing' | 'generating-report';

// Update broadcast function to handle all logging
function broadcast(message: string) {
    // console.log(message);  // Server-side log
    io.emit('log', message);  // Send to all clients
}

setBroadcastFn(broadcast);  // Pass broadcast function to deep-research

// Create output manager with broadcast
const output = new OutputManager((message: string) => {
    broadcast(message);  // Pass broadcast function to OutputManager
});

// Add a Map to track all ongoing research globally
const ongoingResearch = new Map<string, {
    id: string;
    prompt: string;
    startTime: number;
    status: 'collecting' | 'analyzing' | 'generating';
}>();

// Attach socket handlers
let isResearchStopped = false;

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    broadcast('Connected to research server');

    // Send current ongoing research immediately on connect
    const currentResearch = Array.from(ongoingResearch.values());
    socket.emit('ongoing-research-update', currentResearch);

    socket.on('request-ongoing-research', () => {
        socket.emit('ongoing-research-update', Array.from(ongoingResearch.values()));
    });

    socket.on('stop-research', () => {
        if (currentResearch) {
            broadcast('Research terminated by user');
            currentResearch.controller.abort();
            currentResearch.cleanup();
            currentResearch = null;
        }
    });

    socket.on('request-sources', () => {
        if (currentResearch?.sourcesLog) {
            socket.emit('sources-update', currentResearch.sourcesLog);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

app.use(cors({
    origin: process.env.FRONTEND_BASE_URL,
    credentials: true
}));
app.use(express.json());

app.post('/api/research/questions', async (req, res) => {
    try {
        broadcast('Generating follow-up questions...');
        const { prompt, followupQuestions } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const questions = await generateFeedback({
            query: prompt,
            numQuestions: followupQuestions
        });

        if (!questions || !Array.isArray(questions)) {
            throw new Error('Invalid response format');
        }

        broadcast('Questions generated successfully');
        res.json({ questions });
    } catch (error) {
        broadcast(`Error: ${error.message}`);
        console.error('Error generating questions:', error);
        res.status(500).json({
            error: 'Failed to generate questions',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

app.post('/api/research/start', async (req, res) => {
    try {
        // Add request body logging
        console.log('Received research request:', {
            body: req.body,
            contentType: req.headers['content-type']
        });

        const { researchId, prompt } = req.body;

        if (!req.body || typeof req.body.prompt === 'undefined') {
            return res.status(400).json({
                error: 'Prompt is required',
                receivedBody: req.body
            });
        }

        if (currentResearch) {
            currentResearch.controller.abort();
            currentResearch.cleanup();
        }

        const controller = new AbortController();
        const { signal } = controller;

        currentResearch = {
            controller,
            cleanup: () => {
                // Cleanup logic here
            },
            sourcesLog: {
                queries: [],
                lastUpdated: new Date().toISOString()
            }
        };

        isResearchStopped = false;
        broadcast('Starting research process...');
        // Emit research phase update
        io.emit('research-phase', 'collecting-sources');
        const { depth, breadth, followUpAnswers } = req.body;

        // Validate input with more detailed error
        if (!prompt?.trim()) {
            return res.status(400).json({
                error: 'Prompt is required',
                details: 'Prompt was empty or undefined',
                received: { prompt, type: typeof prompt }
            });
        }

        // Track new research
        ongoingResearch.set(researchId, {
            id: researchId,
            prompt: prompt,
            startTime: Date.now(),
            status: 'collecting'
        });

        // Broadcast to all clients
        io.emit('ongoing-research-update', Array.from(ongoingResearch.values()));

        // Store original prompt and context separately
        const originalPrompt = prompt; // Store original prompt
        const fullContext = `
Initial Query: ${prompt}

Follow-up Answers:
${Object.entries(followUpAnswers)
                .map(([q, a]) => `Q: ${q}\nA: ${a}`)
                .join('\n\n')}`;

        broadcast('Starting research process...');

        // Start research process with output manager
        const result = await deepResearch({
            query_to_find_websites: fullContext,
            depth,
            breadth,
            signal,
            onProgress: (progress) => {
                output.updateProgress(progress);  // This will now broadcast progress
            },
            onSourceUpdate: (queryData) => {
                if (currentResearch?.sourcesLog) {
                    // Add timestamp to track real-time updates
                    const updatedQuery = {
                        ...queryData,
                        timestamp: new Date().toISOString()
                    };

                    currentResearch.sourcesLog.queries.push(updatedQuery);
                    currentResearch.sourcesLog.lastUpdated = new Date().toISOString();

                    // Emit source update immediately
                    io.emit('sources-update', currentResearch.sourcesLog);
                }
            }
        });

        // Update phase before report generation
        io.emit('research-phase', 'generating-report');
        broadcast('Generating final report...');

        // Generate final report
        const report = await writeFinalReport({
            prompt: originalPrompt, // Ensure this is passed
            learnings: result.learnings,
            visitedUrls: result.visitedUrls
        });

        if (!report || !report.report_title || !report.report) {
            throw new Error('Failed to generate complete report');
        }

        // When research is complete, save to LowDB with proper structure
        const db = await ReportDB.getInstance();
        const reportId = await db.saveReport({
            report_title: report.report_title,
            report: report.report,
            sourcesLog: {
                queries: currentResearch?.sourcesLog?.queries || [],
                lastUpdated: new Date().toISOString()
            }
        });

        // Properly format the response
        const response = {
            id: reportId,
            report_title: report.report_title,
            report: report.report,
            sourcesLog: currentResearch?.sourcesLog || {
                queries: [],
                lastUpdated: new Date().toISOString()
            }
        };

        // Broadcast to all clients that reports need updating
        io.emit('reports-updated');
        io.emit('research-completed', {
            id: researchId,
            report_title: report.report_title
        });

        // Clean up when done
        ongoingResearch.delete(researchId);
        io.emit('ongoing-research-update', Array.from(ongoingResearch.values()));

        broadcast('Deep Research complete.');
        res.json(response);

    } catch (error) {
        // Reset phase on error
        io.emit('research-phase', 'idle');
        // Enhanced error handling
        if (error.name === 'AbortError') {
            broadcast('Research process stopped');
            res.status(200).json({ status: 'stopped' });
        } else {
            // Clean up on error
            if (req.body.researchId) {
                ongoingResearch.delete(req.body.researchId);
                io.emit('ongoing-research-update', Array.from(ongoingResearch.values()));
                io.emit('research-failed', { id: req.body.researchId });
            }
            broadcast(`Error: ${error.message}`);
            console.error('Research error:', error);

            // Add more detailed error logging
            console.error('Research error details:', {
                error: error.message,
                stack: error.stack,
                requestBody: {
                    hasPrompt: !!req.body?.prompt,
                    promptLength: req.body?.prompt?.length,
                }
            });

            // Ensure error output is available
            const errorFile = path.join(process.cwd(), 'error-output.md');
            res.status(500).json({
                error: 'Research failed',
                details: error.message,
                errorOutput: `See ${errorFile} for full error details`
            });
        }
    }
});

// Add new endpoint for saving research
app.post('/api/research/save', async (req, res) => {
    try {
        const { report_title, report, sourcesLog } = req.body;

        // Validate required fields
        if (!report_title?.trim() || !report?.trim()) {
            return res.status(400).json({
                error: 'Invalid report data',
                details: 'Missing title or content'
            });
        }

        // Save to LowDB
        const db = await ReportDB.getInstance();
        const reportId = await db.saveReport({
            report_title,
            report,
            sourcesLog: sourcesLog || {
                queries: [],
                lastUpdated: new Date().toISOString()
            }
        });

        res.json({
            id: reportId,
            report_title,
            success: true
        });

    } catch (error) {
        console.error('Save report error:', error);
        res.status(500).json({
            error: 'Failed to save report',
            details: error.message
        });
    }
});

// Add new report management endpoints
app.get('/api/reports/:id', async (req, res) => {
    try {
        const db = await ReportDB.getInstance();
        const report = await db.getReport(req.params.id);

        if (!report) {
            return res.status(404).json({
                error: 'Report not found',
                details: `No report exists with ID: ${req.params.id}`
            });
        }

        res.json(report);
    } catch (error) {
        console.error('Get report error:', error);
        res.status(500).json({
            error: 'Failed to fetch report',
            details: error.message
        });
    }
});

app.get('/api/reports', async (req, res) => {
    try {
        const db = await ReportDB.getInstance();
        const reports = await db.getAllReports();
        res.json(reports);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

app.patch('/api/reports/:id/title', async (req, res) => {
    try {
        const { title } = req.body;
        if (!title?.trim()) {
            return res.status(400).json({ error: 'Title is required' });
        }

        const db = await ReportDB.getInstance();
        const success = await db.updateReportTitle(req.params.id, title);

        if (!success) {
            return res.status(404).json({ error: 'Report not found' });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update report title' });
    }
});

app.delete('/api/reports/:id', async (req, res) => {
    try {
        const db = await ReportDB.getInstance();
        const success = await db.deleteReport(req.params.id);

        if (!success) {
            return res.status(404).json({
                error: 'Report deletion failed',
                details: 'Report not found or deletion could not be verified'
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Delete report error:', error);
        res.status(500).json({
            error: 'Failed to delete report',
            details: error.message
        });
    }
});

app.delete('/api/reports', async (req, res) => {
    try {
        const db = await ReportDB.getInstance();
        const success = await db.clearAllReports();

        if (!success) {
            return res.status(500).json({
                error: 'Clear all reports failed',
                details: 'Reports could not be cleared or verification failed'
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Clear all reports error:', error);
        res.status(500).json({
            error: 'Failed to clear reports',
            details: error.message
        });
    }
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

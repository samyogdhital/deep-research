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

// Attach socket handlers
let isResearchStopped = false;

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    broadcast('Connected to research server');

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
        const { prompt, depth, breadth, followUpAnswers } = req.body;

        // Validate input
        if (!prompt) {
            throw new Error('Prompt is required');
        }

        // Combine prompt with follow-up answers
        const fullContext = `
Initial Query: ${prompt}

Follow-up Answers:
${Object.entries(followUpAnswers)
                .map(([q, a]) => `Q: ${q}\nA: ${a}`)
                .join('\n\n')}
`;

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
            prompt: fullContext,
            learnings: result.learnings,
            visitedUrls: result.visitedUrls
        });

        if (!report) {
            throw new Error('Failed to generate report');
        }

        // Fix: Ensure we're writing string content to files
        await Promise.all([
            fs.writeFile(
                path.join(process.cwd(), 'research.md'),
                report.report, // Write the report content string
                'utf-8'
            ),
            fs.writeFile(
                path.join(process.cwd(), 'research-data.json'),
                JSON.stringify({
                    learnings: result.learnings,
                    visitedUrls: result.visitedUrls,
                    timestamp: new Date().toISOString()
                }, null, 2),
                'utf-8'
            )
        ]);

        broadcast('Deep Research complete.');

        res.json({
            report: report.report.replace(/\\n/g, '\n'),
            sources: result.learnings.map(l => ({
                learning: l.content,
                source: l.sourceUrl,
                quote: l.sourceText
            })),
            sourcesLog: currentResearch.sourcesLog // Include final sources log in response
        });

    } catch (error) {
        // Reset phase on error
        io.emit('research-phase', 'idle');
        // Enhanced error handling
        if (error.name === 'AbortError') {
            broadcast('Research process stopped');
            res.status(200).json({ status: 'stopped' });
        } else {
            broadcast(`Error: ${error.message}`);
            console.error('Research error:', error);

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

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

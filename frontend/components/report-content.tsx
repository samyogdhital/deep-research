'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Button } from "@/components/ui/button";
import { Download } from 'lucide-react';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

interface ReportContentProps {
    report: {
        reportTitle: string;
        report: string;
        sourcesLog: {
            queries: Array<{
                query: string;
                objective: string;
                successfulScrapes: Array<{
                    url: string;
                    extractedContent: string;
                }>;
                failedScrapes: Array<{
                    url: string;
                    error: string;
                }>;
            }>;
        };
    };
}

export function ReportContent({ report }: ReportContentProps) {
    const downloadReport = (format: 'pdf' | 'md') => {
        const reportContent = report.report;
        const fileName = `research-report.${format}`;
        const mimeType = 'text/markdown';

        const blob = new Blob([reportContent], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    return (
        <main className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-6">{report.reportTitle}</h1>
                <div className="flex justify-end">
                    <Button
                        variant="outline"
                        onClick={() => downloadReport('md')}
                        className="flex items-center gap-2 px-3 py-2 border border-black transition-colors hover:text-white hover:bg-black dark:bg-transparent dark:text-[#007e81] dark:border-[#007e81] dark:hover:bg-[#00676a] dark:hover:text-white"
                    >
                        <Download size={16} />
                        Download Markdown
                    </Button>
                </div>
            </div>

            {/* Report content */}
            <div className="prose dark:prose-invert max-w-none">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                        h1: ({ node, ...props }) => <h1 className="text-4xl font-bold mb-6" {...props} />,
                        h2: ({ node, ...props }) => <h2 className="text-3xl font-bold mt-8 mb-4" {...props} />,
                        h3: ({ node, ...props }) => <h3 className="text-2xl font-bold mt-6 mb-3" {...props} />,
                        a: ({ node, ...props }) => (
                            <a
                                className="text-blue-600 hover:text-blue-800 underline"
                                target="_blank"
                                rel="noopener noreferrer"
                                {...props}
                            />
                        ),
                        p: ({ node, ...props }) => <p className="my-4" {...props} />,
                    }}
                >
                    {report.report}
                </ReactMarkdown>
            </div>

            {/* Sources accordion */}
            <Accordion type="single" collapsible defaultValue="sources">
                <AccordionItem value="sources">
                    <AccordionTrigger className="text-xl font-bold">
                        All Sources
                    </AccordionTrigger>
                    <AccordionContent>
                        {report.sourcesLog?.queries.map((query, idx) => (
                            <Accordion key={idx} type="single" collapsible className="ml-4 mb-4">
                                <AccordionItem value={`query-${idx}`}>
                                    <AccordionTrigger className="text-lg font-semibold">
                                        {query.query} - {query.objective}
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        {/* Successfully scraped section */}
                                        {query.successfulScrapes?.length > 0 && (
                                            <div className="mb-4">
                                                <h4 className="font-medium mb-2 text-green-600 dark:text-green-400">
                                                    Successfully Scraped ({query.successfulScrapes.length})
                                                </h4>
                                                <ol className="list-decimal ml-4 space-y-4">
                                                    {query.successfulScrapes.map((scrape, sIdx) => (
                                                        <li key={sIdx} className="text-gray-800 dark:text-gray-200">
                                                            <a href={scrape.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-blue-600 dark:text-blue-400 hover:underline"
                                                            >
                                                                {scrape.url}
                                                            </a>
                                                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                                                {scrape.extractedContent}
                                                            </p>
                                                        </li>
                                                    ))}
                                                </ol>
                                            </div>
                                        )}

                                        {/* Failed scrapes section */}
                                        {query.failedScrapes?.length > 0 && (
                                            <div>
                                                <h4 className="font-medium mb-2 text-red-500">
                                                    Failed to Scrape ({query.failedScrapes.length})
                                                </h4>
                                                <ul className="list-disc ml-4 space-y-2">
                                                    {query.failedScrapes.map((fail, fIdx) => (
                                                        <li key={fIdx} className="text-sm text-gray-500">
                                                            {fail.url} - {fail.error}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        ))}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </main>
    );
}

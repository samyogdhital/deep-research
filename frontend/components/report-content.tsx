'use client';

import { useEffect, useState } from 'react';
import { socket } from '@/lib/research-store';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { type ResearchData } from '@deep-research/db/schema';
import type { Components } from 'react-markdown';
import { formatDistanceToNow } from 'date-fns';

interface Report {
  title: string;
  report_id: string;
  sections: Array<{
    rank: number;
    sectionHeading: string;
    content: string;
  }>;
  citedUrls: Array<{
    rank: number;
    url: string;
    title: string;
    oneValueablePoint: string;
  }>;
  isVisited?: boolean;
  timestamp?: string;
}

interface ReportContentProps {
  initialData: ResearchData;
  reportId: string;
}

export function ReportContent({ initialData, reportId }: ReportContentProps) {
  const [researchData, setResearchData] = useState(initialData);

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    // Listen for real-time updates
    const events = [
      'generating_followups',
      'followups_generated',
      'new_serp_query',
      'new_website_successfully_scrape',
      'website_analyzer_agent',
      'crunching_serp_query',
      'crunched_information',
      'report_writing_start',
      'report_writing_successfull',
    ];

    events.forEach((event) => {
      socket.on(event, (data: ResearchData) => {
        console.log(`Received ${event} event:`, data);
        if (data.report_id === reportId) {
          setResearchData(data);
        }
      });
    });

    return () => {
      events.forEach((event) => socket.off(event));
      if (socket.connected) {
        socket.disconnect();
      }
    };
  }, [reportId]);

  const { report } = researchData;

  if (!report) return null;

  const components: Partial<Components> = {
    h1: ({ children }) => (
      <h1 className='text-3xl font-bold mb-8 mt-16 text-gray-900 dark:text-gray-50'>
        {String(children).replace(/^#+\s*/, '')}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className='text-2xl font-semibold mb-6 mt-12 text-gray-800 dark:text-gray-100'>
        {String(children).replace(/^#+\s*/, '')}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className='text-xl font-medium mb-4 mt-8 text-gray-800 dark:text-gray-100'>
        {String(children).replace(/^#+\s*/, '')}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className='text-lg font-medium mb-2 mt-4 text-gray-800 dark:text-gray-100'>
        {String(children).replace(/^#+\s*/, '')}
      </h4>
    ),
    h5: ({ children }) => (
      <h5 className='text-base font-medium mb-2 mt-3 text-gray-800 dark:text-gray-100'>
        {String(children).replace(/^#+\s*/, '')}
      </h5>
    ),
    h6: ({ children }) => (
      <h6 className='text-sm font-medium mb-2 mt-3 text-gray-800 dark:text-gray-100'>
        {String(children).replace(/^#+\s*/, '')}
      </h6>
    ),
    p: ({ children }) => (
      <p className='text-base leading-7 [&:not(:first-child)]:mt-6 text-gray-700 dark:text-gray-300'>
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul className='my-6 ml-6 list-disc [&>li]:mt-2 text-gray-700 dark:text-gray-300'>
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className='my-6 ml-6 list-decimal [&>li]:mt-2 text-gray-700 dark:text-gray-300'>
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className='text-gray-700 dark:text-gray-300'>{children}</li>
    ),
    a: ({ children, href }) => {
      // Check if this is a citation reference
      const isCitation = href?.startsWith('#citation-');
      const citationNumber = isCitation ? href.replace('#citation-', '') : null;

      if (isCitation) {
        return (
          <button
            onClick={(e) => {
              e.preventDefault();
              const element = document.getElementById(href.substring(1));
              if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
                element.classList.add('flash-highlight');
                setTimeout(
                  () => element.classList.remove('flash-highlight'),
                  1000
                );
              }
            }}
            className='inline-flex items-center px-2 py-0.5 rounded bg-[#e5f5f5] hover:bg-[#d1efef] dark:bg-[#002f30] dark:hover:bg-[#003f40] text-[#007e81] hover:text-[#006669] dark:text-[#00a3a8] dark:hover:text-[#008589] transition-colors cursor-pointer'
          >
            [{citationNumber}]
          </button>
        );
      }

      return (
        <a
          href={href}
          target='_blank'
          rel='noopener noreferrer'
          className='font-medium underline underline-offset-4 text-[#007e81] hover:text-[#006669] dark:text-[#00a3a8] dark:hover:text-[#008589]'
        >
          {children}
        </a>
      );
    },
    blockquote: ({ children }) => (
      <blockquote className='mt-6 border-l-2 border-[#007e81] dark:border-[#00a3a8] pl-6 italic text-gray-700 dark:text-gray-300'>
        {children}
      </blockquote>
    ),
    code: ({ children, className }) => {
      const match = /language-(\w+)/.exec(className || '');
      const isInline = !match;
      return isInline ? (
        <code className='rounded bg-gray-100 dark:bg-gray-800 px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold text-gray-900 dark:text-gray-100'>
          {children}
        </code>
      ) : (
        <code className='block rounded-md bg-gray-100 dark:bg-gray-800 p-4 font-mono text-sm overflow-x-auto text-gray-900 dark:text-gray-100'>
          {children}
        </code>
      );
    },
    strong: ({ children }) => (
      <strong className='font-bold text-gray-900 dark:text-gray-50'>
        {children}
      </strong>
    ),
    em: ({ children }) => (
      <em className='italic text-gray-800 dark:text-gray-200'>{children}</em>
    ),
    table: ({ children }) => (
      <div className='my-8 overflow-x-auto'>
        <table className='w-full border-collapse border border-gray-200 dark:border-gray-800'>
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className='bg-gray-50 dark:bg-gray-800 text-left'>
        {children}
      </thead>
    ),
    tbody: ({ children }) => (
      <tbody className='divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900'>
        {children}
      </tbody>
    ),
    tr: ({ children }) => (
      <tr className='hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'>
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th className='py-4 px-6 text-sm font-semibold text-gray-900 dark:text-gray-100'>
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className='py-4 px-6 text-sm text-gray-700 dark:text-gray-300'>
        {children}
      </td>
    ),
  };

  const downloadReport = () => {
    // Combine all sections into markdown
    const markdown =
      `# ${report.title}\n\n` +
      report.sections
        .map((section) => `## ${section.sectionHeading}\n\n${section.content}`)
        .join('\n\n') +
      '\n\n## Sources\n\n' +
      report.citedUrls
        .map(
          (url) =>
            `${url.rank}. [${url.title}](${url.url})\n   ${url.oneValueablePoint}`
        )
        .join('\n\n');

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title.toLowerCase().replace(/\s+/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className='min-h-screen bg-white dark:bg-bg_color text-gray-900 dark:text-gray-50'>
      <div className='container mx-auto px-4 py-12 max-w-4xl'>
        {/* Report Title Section */}
        <div className='mb-16'>
          <div className='pb-8 border-b border-gray-200 dark:border-gray-800'>
            <h1 className='text-4xl font-bold mb-3 text-gray-900 dark:text-gray-50'>
              {report.title}
            </h1>
            {report.timestamp && (
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                Created{' '}
                {formatDistanceToNow(new Date(report.timestamp), {
                  addSuffix: true,
                })}
              </p>
            )}
          </div>
        </div>

        {/* Report Sections */}
        <div className='space-y-12'>
          {report.sections.map((section) => (
            <div
              key={section.rank}
              className='prose prose-lg dark:prose-invert max-w-none'
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={components}
              >
                {`# ${section.sectionHeading}\n\n${section.content}`}
              </ReactMarkdown>
            </div>
          ))}
        </div>

        {/* Citations */}
        <div className='mt-12'>
          <h2 className='text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-50'>
            Sources
          </h2>
          <div className='space-y-4'>
            {report.citedUrls.map((citation) => (
              <div
                key={citation.rank}
                id={`citation-${citation.rank}`}
                className='p-4 bg-gray-50 dark:bg-gray_800 rounded-lg shadow-sm transition-colors'
                style={{
                  scrollMarginTop: '2rem',
                }}
              >
                <div className='flex items-start gap-3'>
                  <span className='inline-flex items-center justify-center px-2 py-0.5 rounded bg-[#e5f5f5] dark:bg-[#002f30] text-[#007e81] dark:text-[#00a3a8] font-medium min-w-[2rem]'>
                    [{citation.rank}]
                  </span>
                  <div className='flex-1'>
                    <h3 className='font-medium text-gray-900 dark:text-gray-50'>
                      {citation.title}
                    </h3>
                    <a
                      href={citation.url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-[#007e81] hover:text-[#006669] dark:text-[#00a3a8] dark:hover:text-[#008589] block mt-1 break-all'
                    >
                      {citation.url}
                    </a>
                    <p className='mt-2 text-sm text-gray-600 dark:text-gray-400'>
                      {citation.oneValueablePoint}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Research Progress */}
        <div className='mt-12'>
          <h2 className='text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-50'>
            Research Details
          </h2>

          {/* SERP Queries */}
          <div className='space-y-6'>
            {researchData.serpQueries.map((query) => (
              <div
                key={query.query_timestamp}
                className='p-4 bg-gray-50 dark:bg-bg_color rounded shadow-sm'
              >
                <h3 className='font-medium mb-2 text-gray-900 dark:text-gray-50'>
                  Query {query.query_timestamp}: {query.query}
                </h3>
                <p className='text-sm text-gray-600 dark:text-gray-400 mb-4'>
                  Objective: {query.objective}
                </p>

                {/* Successful Scrapes */}
                <div className='space-y-2'>
                  {query.successful_scraped_websites.map((website) => (
                    <div
                      key={website.url}
                      className='p-2 bg-gray-50 dark:bg-bg_color rounded'
                    >
                      <a
                        href={website.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-blue-500 hover:text-blue-600 dark:text-blue-400 font-inter'
                      >
                        {website.title}
                      </a>
                      <p className='text-sm text-gray-500 dark:text-gray-400 font-inter'>
                        Relevance: {website.isRelevant}/10
                      </p>
                    </div>
                  ))}
                </div>

                {/* Failed Websites */}
                {query.failedWebsites.length > 0 && (
                  <div className='mt-4'>
                    <p className='text-sm text-red-500 font-inter'>
                      Failed to scrape:
                    </p>
                    <ul className='list-disc list-inside'>
                      {query.failedWebsites.map((url) => (
                        <li
                          key={url}
                          className='text-sm text-gray-500 font-inter'
                        >
                          {url}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Information Crunching Results */}
          {researchData.information_crunching_agent.serpQueries.length > 0 && (
            <div className='mt-8'>
              <h3 className='text-xl font-semibold mb-4'>
                Information Crunching Results
              </h3>
              <div className='space-y-4'>
                {researchData.information_crunching_agent.serpQueries.map(
                  (query) => (
                    <div
                      key={query.query_timestamp}
                      className='p-4 bg-gray-50 dark:bg-bg_color rounded'
                    >
                      <h4 className='font-medium mb-2'>
                        Query {query.query_timestamp} Results
                      </h4>
                      {query.crunched_information.map((info, index) => (
                        <div key={index} className='mt-2'>
                          <a
                            href={info.url}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-blue-500 hover:text-blue-600 dark:text-blue-400'
                          >
                            Source
                          </a>
                          <div className='mt-1 space-y-1'>
                            {info.content.map((content, i) => (
                              <p
                                key={i}
                                className='text-sm text-gray-600 dark:text-gray-300'
                              >
                                {content}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <style jsx global>{`
        @keyframes flash {
          0% {
            background-color: transparent;
          }
          50% {
            background-color: rgba(0, 126, 129, 0.1);
          }
          100% {
            background-color: transparent;
          }
        }
        .flash-highlight {
          animation: flash 1s ease-out;
        }
      `}</style>
    </div>
  );
}

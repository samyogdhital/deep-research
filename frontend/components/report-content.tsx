'use client';

import { useState } from 'react';
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
            <div className='flex items-center justify-between'>
              {report.timestamp && (
                <p className='text-sm text-gray-500 dark:text-gray-400'>
                  Created{' '}
                  {formatDistanceToNow(new Date(report.timestamp), {
                    addSuffix: true,
                  })}
                </p>
              )}
              <Button
                variant='link'
                onClick={() => (window.location.href = `/realtime/${reportId}`)}
                className='text-[#007e81] hover:text-[#006669] dark:text-[#00a3a8] dark:hover:text-[#008589]'
              >
                Tree view
              </Button>
            </div>
          </div>
        </div>

        {/* Report Sections */}
        <div className='space-y-12 mb-12 border-b border-gray-200 dark:border-gray-700 pb-12'>
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

        {/* Sources Accordion */}
        <div className='mt-12'>
          <Accordion type='single' collapsible className='w-full'>
            <AccordionItem
              value='sources'
              className='rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'
            >
              <AccordionTrigger className='text-xl font-semibold text-gray-900 dark:text-gray-300 hover:no-underline px-4 py-3'>
                Sources
              </AccordionTrigger>
              <AccordionContent>
                <div className='space-y-2 p-4'>
                  {report.citedUrls
                    .sort((a, b) => a.rank - b.rank)
                    .map((citation) => (
                      <div
                        key={citation.rank}
                        id={`citation-${citation.rank}`}
                        className='p-3 flex items-start gap-3'
                        style={{ scrollMarginTop: '2rem' }}
                      >
                        <span className='inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-300 text-sm font-medium shrink-0'>
                          {citation.rank}
                        </span>
                        <div className='flex-1 min-w-0'>
                          <a
                            href={citation.url}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-sm text-black hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-400 truncate block transition-colors'
                          >
                            {citation.url}
                          </a>
                          <p className='text-sm text-gray-700 dark:text-gray-400 mt-1 line-clamp-2'>
                            {citation.oneValueablePoint}
                          </p>
                          <div className='flex items-center mt-1'>
                            <div className='flex items-center text-xs text-gray-600 dark:text-gray-500 gap-1'>
                              <span>Relevancy:</span>
                              <span className='font-medium'>
                                {citation.rank}/10
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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

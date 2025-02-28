'use client';

import { useEffect, useState } from 'react';
import { socket } from '@/lib/research-store';
import { ResearchData } from '@/types/research';
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
import type { Components } from 'react-markdown';

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
}

interface ReportContentProps {
  initialData: ResearchData;
  reportId: string;
}

export function ReportContent({ initialData, reportId }: ReportContentProps) {
  const [researchData, setResearchData] = useState(initialData);
  console.log('Initial research data:', initialData);

  useEffect(() => {
    if (!socket.connected) {
      console.log('Socket connecting...');
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
      <h1 className='text-4xl font-bold mb-6 font-inter tracking-tight'>
        {String(children).replace(/^#\s+/, '')}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className='text-2xl font-semibold mb-4 font-inter tracking-tight'>
        {String(children).replace(/^##\s+/, '')}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className='text-xl font-medium mb-3 font-inter tracking-tight'>
        {String(children).replace(/^###\s+/, '')}
      </h3>
    ),
    p: ({ children }) => (
      <p className='text-base leading-7 [&:not(:first-child)]:mt-6 font-inter'>
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul className='my-6 ml-6 list-disc [&>li]:mt-2 font-inter'>{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className='my-6 ml-6 list-decimal [&>li]:mt-2 font-inter'>
        {children}
      </ol>
    ),
    li: ({ children }) => <li className='font-inter'>{children}</li>,
    a: ({ children, href }) => {
      // Check if this is a citation link (matches pattern [number])
      const isCitation = href?.match(/^\d+$/);
      return (
        <a
          href={isCitation ? `#citation-${href}` : href}
          className={
            isCitation
              ? 'font-medium text-primary hover:text-primary/80 font-inter inline-flex items-center gap-0.5'
              : 'font-medium underline underline-offset-4 text-primary hover:text-primary/80 font-inter'
          }
          target={isCitation ? undefined : '_blank'}
          rel={isCitation ? undefined : 'noopener noreferrer'}
        >
          {children}
          {isCitation && <sup className='text-xs font-medium'>[{href}]</sup>}
        </a>
      );
    },
    blockquote: ({ children }) => (
      <blockquote className='mt-6 border-l-2 border-primary pl-6 italic font-inter'>
        {children}
      </blockquote>
    ),
    code: ({ children, className }) => {
      const match = /language-(\w+)/.exec(className || '');
      const isInline = !match;
      return isInline ? (
        <code className='rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold'>
          {children}
        </code>
      ) : (
        <code className='block rounded-md bg-muted p-4 font-mono text-sm overflow-x-auto'>
          {children}
        </code>
      );
    },
    strong: ({ children }) => (
      <strong className='font-bold font-inter'>{children}</strong>
    ),
    em: ({ children }) => <em className='italic font-inter'>{children}</em>,
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
    <div className='container mx-auto px-4 py-8 max-w-4xl font-inter'>
      {/* Download button */}
      <div className='flex justify-end mb-8'>
        <Button
          variant='outline'
          onClick={downloadReport}
          className='flex items-center gap-2 px-3 py-2 border border-black transition-colors hover:text-white hover:bg-black dark:bg-transparent dark:text-[#007e81] dark:border-[#007e81] dark:hover:bg-[#00676a] dark:hover:text-white'
        >
          <Download size={16} />
          Download Report
        </Button>
      </div>

      {/* Report Title */}
      <h1 className='text-4xl font-bold mb-8 font-inter'>{report.title}</h1>

      {/* Report Sections */}
      <div className='space-y-8'>
        {report.sections.map((section) => (
          <div
            key={section.rank}
            className='prose prose-lg dark:prose-invert max-w-none font-inter'
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              className='font-inter'
              components={components}
            >
              {`# ${section.sectionHeading}\n\n${section.content}`}
            </ReactMarkdown>
          </div>
        ))}
      </div>

      {/* Citations */}
      <div className='mt-12'>
        <h2 className='text-2xl font-semibold mb-4 font-inter'>Sources</h2>
        <div className='space-y-4'>
          {report.citedUrls.map((citation) => (
            <div
              key={citation.rank}
              id={`citation-${citation.rank}`}
              className='p-4 bg-gray-100 dark:bg-gray-800 rounded font-inter'
            >
              <h3 className='font-medium font-inter flex items-center gap-2'>
                <span className='text-primary'>[{citation.rank}]</span>
                <span>{citation.title}</span>
              </h3>
              <a
                href={citation.url}
                target='_blank'
                rel='noopener noreferrer'
                className='text-primary hover:text-primary/80 font-inter block mt-1'
              >
                {citation.url}
              </a>
              <p className='mt-2 text-sm text-gray-600 dark:text-gray-300 font-inter'>
                {citation.oneValueablePoint}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Research Progress */}
      <div className='mt-12'>
        <h2 className='text-2xl font-semibold mb-4 font-inter'>
          Research Progress
        </h2>

        {/* SERP Queries */}
        <div className='space-y-6'>
          {researchData.serpQueries.map((query) => (
            <div
              key={query.query_rank}
              className='p-4 bg-gray-50 dark:bg-gray-900 rounded font-inter'
            >
              <h3 className='font-medium mb-2 font-inter'>
                Query {query.query_rank}: {query.query}
              </h3>
              <p className='text-sm text-gray-600 dark:text-gray-400 mb-4 font-inter'>
                Objective: {query.objective}
              </p>

              {/* Successful Scrapes */}
              <div className='space-y-2'>
                {query.successful_scraped_websites.map((website) => (
                  <div
                    key={website.url}
                    className='p-2 bg-white dark:bg-gray-800 rounded font-inter'
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
                    key={query.query_rank}
                    className='p-4 bg-gray-50 dark:bg-gray-900 rounded'
                  >
                    <h4 className='font-medium mb-2'>
                      Query {query.query_rank} Results
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
  );
}

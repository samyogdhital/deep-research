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
  report: Report;
}

export function ReportContent({ report }: ReportContentProps) {
  const [showSources, setShowSources] = useState(false);

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
    <div className='container mx-auto px-4 py-8 max-w-4xl'>
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
      <h1 className='text-4xl font-bold mb-8 text-gray-900 dark:text-white'>
        {report.title}
      </h1>

      {/* Report Sections */}
      <div className='space-y-8 mb-12'>
        {report.sections.map((section) => (
          <div
            key={section.rank}
            className='prose dark:prose-invert max-w-none'
          >
            <h2 className='text-2xl font-bold mb-4'>
              {section.sectionHeading}
            </h2>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                a: ({ node, ...props }) => (
                  <a
                    className='text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline'
                    target='_blank'
                    rel='noopener noreferrer'
                    {...props}
                  />
                ),
                p: ({ node, ...props }) => (
                  <p
                    className='my-4 text-gray-700 dark:text-gray-300'
                    {...props}
                  />
                ),
              }}
            >
              {section.content}
            </ReactMarkdown>
          </div>
        ))}
      </div>

      {/* Sources Section */}
      <Accordion type='single' collapsible className='w-full'>
        <AccordionItem value='sources'>
          <AccordionTrigger className='text-xl font-bold'>
            Sources ({report.citedUrls.length})
          </AccordionTrigger>
          <AccordionContent>
            <div className='space-y-4 mt-4'>
              {report.citedUrls.map((source) => (
                <div
                  key={source.rank}
                  className='border-b pb-4 dark:border-gray-700'
                >
                  <div className='flex items-start gap-3'>
                    <span className='text-gray-500 dark:text-gray-400 min-w-[24px]'>
                      {source.rank}.
                    </span>
                    <div>
                      <a
                        href={source.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium'
                      >
                        {source.title}
                      </a>
                      <p className='mt-2 text-gray-700 dark:text-gray-300'>
                        {source.oneValueablePoint}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

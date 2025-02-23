'use client';

import { useEffect, useState } from 'react';
import { getReport, getAllReports } from '@/lib/db';
import { useParams } from 'next/navigation';
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

export default function ReportPage() {
  const params = useParams();
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadReport = async () => {
      try {
        // Try to load report
        const data = await getReport(params.slug as string);
        if (!data) {
          setError('Report not found');
          return;
        }

        // Force refresh sidebar data to ensure it's populated
        await getAllReports();
        
        setReport(data);
      } catch (err) {
        setError('Failed to load report');
      }
    };
    loadReport();
  }, [params.slug]);

  if (error) {
    return <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-red-500">{error}</h1>
    </div>;
  }

  if (!report) {
    return <div>Loading...</div>;
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-6">{report.reportTitle}</h1>
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => {/* Add download handler */}}
            className="flex items-center gap-2"
          >
            <Download size={16} />
            Download Report
          </Button>
        </div>
      </div>

      {/* Report Content */}
      <div className="prose dark:prose-invert max-w-none mb-8">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
        >
          {report.report}
        </ReactMarkdown>
      </div>

      {/* Sources Section */}
      <Accordion type="single" collapsible defaultValue="sources">
        {/* ...sources accordion content... */}
      </Accordion>
    </main>
  );
}
import { notFound } from 'next/navigation';
import { ReportContent } from '@/components/report-content';
import { getReport } from '@/lib/db';

// Import the Report type
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

export default async function ReportPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const params = await props.params;
  const report = await getReport(params.slug);

  // If report is null, show 404 page
  if (!report) {
    notFound();
  }

  // Mark as visited if it's new
  if (!report.isVisited) {
    await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/reports/${params.slug}/visit`,
      {
        method: 'PATCH',
      }
    );
  }

  return <ReportContent report={report} />;
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}) {
  const params = await props.params;
  const report = await getReport(params.slug);

  return {
    title: report?.title || `Research Report - ${params.slug}`,
    description:
      report?.sections[0]?.content?.substring(0, 160) || 'Research Report',
  };
}

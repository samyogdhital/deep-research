import { notFound } from 'next/navigation';
import { ReportContent } from '@/components/report-content';
import { getReport } from '@/lib/db';

export default async function ReportPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const report = await getReport(params.slug);

  // If report is null, show 404 page
  if (!report) {
    notFound();
  }

  // Mark as visited if it's new
  if (!report.isVisited) {
    await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/reports/${params.slug}/visit`, {
      method: 'PATCH'
    });
  }

  return <ReportContent report={report} />;
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return {
    title: `Research Report - ${params.slug}`,
  };
}
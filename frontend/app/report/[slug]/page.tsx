import { notFound } from 'next/navigation';
import { ReportContent } from '@/components/report-content';
import { getReport } from '@/lib/db';

export default async function ReportPage(
  props: {
    params: Promise<{ slug: string }>
  }
) {
  const params = await props.params;
  const report = await getReport(params.slug);

  // If report is null, show 404 page
  if (!report) {
    notFound();
  }

  return <ReportContent report={report} />;
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return {
    title: `Research Report - ${params.slug}`,
  };
}
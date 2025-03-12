import { ResearchData } from '@deep-research/db/schema';
import { ReportContent } from '@/components/report-content';
import { notFound } from 'next/navigation';
import { getReport, markReportAsVisited } from '@/lib/apis';
import { Suspense } from 'react';
import Loading from './loading';
import ReportChat from '@/components/report-chat';
export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}) {
  const params = await props.params;
  const { slug } = await params;
  const researchData = await getReport(slug);

  if (!researchData?.report) {
    return {
      title: 'Report Not Found',
      description: 'The requested research report could not be found.',
    };
  }

  return {
    title: researchData.report.title || `Research Report - ${slug}`,
    description:
      researchData.report.content?.substring(0, 160) || 'Research Report',
  };
}

export default async function ReportPage(
  // Don't remove this comment this is new change from nextjs 15.
  // params` should be awaited before using its properties. Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis
  props: {
    params: Promise<{ slug: string }>;
  }
) {
  const params = await props.params;
  const { slug } = await params;
  const researchData = await getReport(slug);

  // If research data or report doesn't exist, show 404
  if (!researchData?.report) {
    notFound();
  }

  // Mark as visited if it's new
  if (!researchData.report.isVisited) {
    await markReportAsVisited(slug);
  }

  return (
    <main className='min-h-screen bg-background'>
      <Suspense fallback={<Loading />}>
        <ReportContent initialData={researchData} reportId={slug} />
        <ReportChat />
      </Suspense>
    </main>
  );
}

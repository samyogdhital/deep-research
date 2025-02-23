import { notFound } from 'next/navigation';
import { ReportContent } from '@/components/report-content';

// Add caching options for Next.js fetch
const getReport = async (id: string) => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/reports/${id}`,
    {
      next: {
        revalidate: 60,  // Cache for 60 seconds
        tags: ['report'] // Add cache tag for manual invalidation
      }
    }
  );

  if (response.status === 404) {
    notFound();
  }

  if (!response.ok) {
    throw new Error('Failed to fetch report');
  }

  return response.json();
};

export default async function ReportPage({
  params
}: {
  params: { slug: string }
}) {
  const report = await getReport(params.slug);
  return <ReportContent report={report} />;
}

// Add error boundary page
export function generateMetadata({ params }: { params: { slug: string } }) {
  return {
    title: `Research Report - ${params.slug}`,
  };
}
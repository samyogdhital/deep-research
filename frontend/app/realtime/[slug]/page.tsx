import { RealtimeView } from '@/components/RealtimeView';
import { Suspense } from 'react';
import { getReport } from '@/lib/db';

export default async function RealtimePage(
  // Don't remove this comment this is new change from nextjs 15.
  // params` should be awaited before using its properties. Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis
  props: {
    params: Promise<{ slug: string }>;
  }
) {
  const params = await props.params;
  const { slug } = params;

  // Fetch initial data server-side
  const initialData = await getReport(slug);

  if (!initialData) {
    return <div>Report not found</div>;
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RealtimeView initialData={initialData} />
    </Suspense>
  );
}

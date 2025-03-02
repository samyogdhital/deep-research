import { RealtimeView } from '@/components/RealtimeView';
import { Suspense } from 'react';

export default async function RealtimePage(
  // Don't remove this comment this is new change from nextjs 15.
  // params` should be awaited before using its properties. Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis
  props: {
    params: Promise<{ slug: string }>;
  }
) {
  const params = await props.params;
  const { slug } = await params;

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RealtimeView reportId={slug} />
    </Suspense>
  );
}

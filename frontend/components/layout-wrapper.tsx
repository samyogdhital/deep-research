import { cookies } from 'next/headers';
import { getAllReports } from '@/lib/db';
import ContentWrapper from './content-wrapper';

interface Props {
  children: React.ReactNode;
}

export type ReportsType = {
  id: string;
  report_title: string;
  report: string;
  timestamp: number;
}[];

export async function LayoutWrapper({ children }: Props) {
  // Get cookies.
  const cookieStore = await cookies();
  const isExpanded = cookieStore.get('sidebar-expanded')?.value === 'true';

  // Fetch reports server-side
  const reports: ReportsType = await getAllReports(); // Server-side call
  return (
    <div className='flex min-h-screen'>
      <ContentWrapper {...{ reports, isExpanded }}>{children}</ContentWrapper>
    </div>
  );
}

import { ServerSidebar } from './sidebar/server-sidebar'

interface Props {
  children: React.ReactNode;
}

export function LayoutWrapper({ children }: Props) {
  return (
    <div className="flex min-h-screen">
      <ServerSidebar />
      <main className="flex-1 ml-64">
        {children}
      </main>
    </div>
  );
}

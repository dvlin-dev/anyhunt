import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AppShell } from '@/features/reader-shell/components/app-shell';

export const Route = createFileRoute('/app')({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});

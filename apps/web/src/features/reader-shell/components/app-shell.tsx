import type { ReactNode } from 'react';
import { Button, Skeleton } from '@anyhunt/ui';
import { Bell, Compass, LogOut, Plus, Radar, ScrollText } from 'lucide-react';
import { authMethods } from '@/lib/auth/auth-methods';
import { useAuthStore } from '@/stores/auth-store';

const navigation = [
  { href: '/app', label: 'Topics', icon: Radar },
  { href: '/app/inbox', label: 'Inbox', icon: Bell },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/app/skills', label: 'Skills', icon: ScrollText },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useAuthStore((state) => state.isHydrated);
  const bootstrapped = useAuthStore((state) => state.isBootstrapped);
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  if (!hydrated || !bootstrapped) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-8 h-64 w-full rounded-2xl" />
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Anyhunt workspace
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Sign in to continue</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your Topics, Inbox, and Skills are private to your account.
        </p>
        <Button asChild className="mx-auto mt-7">
          <a href="/login?redirect=/app">Sign in</a>
        </Button>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-card lg:flex lg:flex-col">
        <div className="flex h-16 items-center border-b border-border px-6">
          <a href="/app" className="font-mono text-lg font-semibold tracking-[0.16em]">
            ANYHUNT
          </a>
        </div>
        <nav aria-label="Workspace" className="flex-1 space-y-1 p-3">
          {navigation.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <Icon className="size-4" /> {label}
            </a>
          ))}
          <a
            href="/app/subscriptions"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Following
          </a>
        </nav>
        <div className="border-t border-border p-4">
          <p className="truncate text-sm font-medium">{user?.name || user?.email}</p>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => void authMethods.logout()}
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <a href="/app" className="font-mono font-semibold tracking-[0.14em]">
              ANYHUNT
            </a>
            <Button size="sm" asChild>
              <a href="/app/topics/new">
                <Plus className="mr-1.5 size-4" /> New
              </a>
            </Button>
          </div>
          <nav aria-label="Workspace" className="flex gap-1 overflow-x-auto px-3 pb-2">
            {navigation.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="shrink-0 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
        </header>
        <main id="main-content" className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}

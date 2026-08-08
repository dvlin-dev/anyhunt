/**
 * [POS]: Anyhunt 首页与登录后的 Topic 空状态
 */

import { createFileRoute } from '@tanstack/react-router';
import { ArrowRight, Radar } from 'lucide-react';
import { Button } from '@anyhunt/ui';
import { useAuthModal } from '@/components/auth/auth-modal';
import { Container, MarketingPageShell } from '@/components/layout';
import { useAuthStore } from '@/stores/auth-store';

export const Route = createFileRoute('/')({ component: HomePage });

function HomePage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const { openAuthModal } = useAuthModal();

  return (
    <MarketingPageShell>
      <Container className="py-20 sm:py-28" size="narrow">
        {isAuthenticated ? (
          <section aria-labelledby="topics-heading">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Workspace
            </p>
            <h1 id="topics-heading" className="mt-4 text-4xl font-semibold tracking-tight">
              {user?.name ? `${user.name}'s topics` : 'Your topics'}
            </h1>
            <div className="mt-12 rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-sm">
              <Radar className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="mt-5 text-lg font-medium">Your research workspace is ready</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Open your Topics, Inbox, and reusable Skills in one focused workspace.
              </p>
              <Button asChild className="mt-6">
                <a href="/app">Open workspace</a>
              </Button>
            </div>
          </section>
        ) : (
          <section className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-16 sm:px-12 sm:py-20">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--muted))_0,transparent_45%)] opacity-70" />
            <div className="relative max-w-2xl">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Continuous research agent
              </p>
              <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.035em] sm:text-6xl">
                Follow a topic.
                <br />
                Keep the signal.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                Anyhunt researches the open web, turns evidence into a focused digest, and improves
                its reusable skill with every run.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button size="lg" onClick={() => openAuthModal({ mode: 'register' })}>
                  Create an account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => openAuthModal({ mode: 'login' })}
                >
                  Sign in
                </Button>
              </div>
            </div>
          </section>
        )}
      </Container>
    </MarketingPageShell>
  );
}

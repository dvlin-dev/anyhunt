/**
 * [PROPS]: None
 * [EMITS]: Reader navigation and authentication actions
 * [POS]: Anyhunt public topic navigation
 */

import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Menu, X } from 'lucide-react';
import { useAuthModal } from '@/components/auth/auth-modal';
import { useAuthStore } from '@/stores/auth-store';
import { Container } from './Container';
import { DesktopHeaderAuthActions } from './header/auth-actions';
import type { HeaderAuthViewState } from './header/types';

function resolveHeaderAuthViewState(isLoading: boolean, isAuthenticated: boolean): HeaderAuthViewState {
  if (isLoading) {
    return 'loading';
  }

  if (isAuthenticated) {
    return 'authenticated';
  }

  return 'guest';
}

export function Header() {
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const isBootstrapped = useAuthStore((state) => state.isBootstrapped);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = !isHydrated || !isBootstrapped;
  const authViewState = resolveHeaderAuthViewState(isLoading, isAuthenticated);

  const { openAuthModal } = useAuthModal();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const MobileMenuIcon = mobileMenuOpen ? X : Menu;

  const navLinks = [
    { to: '/explore' as const, label: 'Explore' },
    { to: '/topics' as const, label: 'Topics' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Container>
        <div className="flex h-16 items-center justify-between">
          <Link to="/welcome" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight">ANYHUNT</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            {navLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <DesktopHeaderAuthActions
              viewState={authViewState}
              onSignIn={() => openAuthModal({ mode: 'login' })}
              onRegister={() => openAuthModal({ mode: 'register' })}
            />
          </div>

          <button
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            className="rounded-lg p-2 transition-colors hover:bg-muted md:hidden"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <MobileMenuIcon className="h-5 w-5" />
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="space-y-1 border-t border-border py-3 md:hidden">
            {navLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
            <div className="px-3 pt-2">
              <DesktopHeaderAuthActions
                viewState={authViewState}
                onSignIn={() => openAuthModal({ mode: 'login' })}
                onRegister={() => openAuthModal({ mode: 'register' })}
              />
            </div>
          </div>
        )}
      </Container>
    </header>
  );
}

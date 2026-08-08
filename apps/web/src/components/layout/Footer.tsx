import { Container } from './Container';

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <Container>
        <div className="flex flex-col gap-3 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono tracking-[0.12em]">ANYHUNT</p>
          <p>© {new Date().getFullYear()} Anyhunt. Follow what matters.</p>
        </div>
      </Container>
    </footer>
  );
}

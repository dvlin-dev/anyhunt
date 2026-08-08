import { Button, Skeleton } from '@anyhunt/ui';

export function PageLoading() {
  return (
    <div aria-label="Loading" aria-busy="true" className="space-y-4">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
    </div>
  );
}

export function PageError({ retry }: { retry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6">
      <h2 className="font-medium">We could not load this page</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Check your connection and try again. Your saved data is unchanged.
      </p>
      {retry && (
        <Button className="mt-5" variant="outline" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}

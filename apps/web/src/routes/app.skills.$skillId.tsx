import { createFileRoute } from '@tanstack/react-router';
import { Badge, Button, Card, CardContent } from '@anyhunt/ui';
import { Download } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { skillsApi } from '@/features/skills/api';
import { skillKeys, useSkill, useSkillStatus } from '@/features/skills/hooks';
import { PageError, PageLoading } from '@/features/reader-shell/components/query-state';

export const Route = createFileRoute('/app/skills/$skillId')({ component: SkillPage });

function SkillPage() {
  const { skillId } = Route.useParams();
  const skill = useSkill(skillId);
  const status = useSkillStatus();
  const queryClient = useQueryClient();
  const rollback = useMutation({
    mutationFn: (version: number) => skillsApi.rollback(skillId, version),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: skillKeys.detail(skillId) }),
  });
  if (skill.isLoading) return <PageLoading />;
  if (skill.isError || !skill.data) return <PageError retry={() => void skill.refetch()} />;
  const current = skill.data;
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <a href="/app/skills" className="text-sm text-muted-foreground hover:text-foreground">← Skills</a>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{current.name}</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{current.description}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => status.mutate({ skillId, enabled: !current.enabled })}
            >
              {current.enabled ? 'Disable' : 'Enable'}
            </Button>
            <Button
              onClick={async () => {
                const blob = await skillsApi.download(skillId);
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = `${current.name}.zip`;
                anchor.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="mr-2 size-4" /> Export
            </Button>
          </div>
        </div>
      </header>
      <section aria-labelledby="versions-heading">
        <h2 id="versions-heading" className="text-lg font-semibold">Versions</h2>
        <div className="mt-4 space-y-3">
          {current.versions?.map((version) => (
            <Card key={version.id} className="hover:shadow-sm">
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div>
                  <Badge variant="outline">v{version.version}</Badge>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(version.createdAt).toLocaleString()}
                  </p>
                </div>
                {version.version !== current.currentVersion ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={rollback.isPending}
                    onClick={() => rollback.mutate(version.version)}
                  >
                    Roll back
                  </Button>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">Current</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

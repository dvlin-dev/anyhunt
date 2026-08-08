import { createFileRoute } from '@tanstack/react-router';
import { SkillsLibrary } from '@/features/skills/components/skills-library';
import { useImportSkill, useSkills, useSkillStatus } from '@/features/skills/hooks';
import { PageError, PageLoading } from '@/features/reader-shell/components/query-state';

export const Route = createFileRoute('/app/skills')({ component: SkillsPage });

function SkillsPage() {
  const skills = useSkills();
  const importer = useImportSkill();
  const status = useSkillStatus();
  if (skills.isLoading) return <PageLoading />;
  if (skills.isError) return <PageError retry={() => void skills.refetch()} />;
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Skills</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Import standard Agent Skills, review them, then attach enabled Skills to the Topics that
          need them. Anyhunt never rewrites imported Skills.
        </p>
      </header>
      {(importer.error || status.error) && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {(importer.error ?? status.error) instanceof Error
            ? (importer.error ?? status.error as Error).message
            : 'The Skill could not be updated.'}
        </p>
      )}
      <SkillsLibrary
        skills={skills.data ?? []}
        isImporting={importer.isPending}
        onImportUrl={(url) => importer.mutateAsync({ url })}
        onImportFile={(file) => importer.mutateAsync({ file })}
        onStatus={(skillId, enabled) => status.mutateAsync({ skillId, enabled })}
      />
    </div>
  );
}

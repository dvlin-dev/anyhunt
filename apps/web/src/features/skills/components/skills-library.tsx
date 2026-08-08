import { useState, type FormEvent } from 'react';
import { Badge, Button, Card, CardContent, Input, Label, Switch } from '@anyhunt/ui';
import { FileArchive, Link as LinkIcon, ScrollText } from 'lucide-react';
import type { Skill } from '../types';

interface SkillsLibraryProps {
  skills: Skill[];
  onImportUrl: (url: string) => Promise<unknown> | void;
  onImportFile: (file: File) => Promise<unknown> | void;
  onStatus: (skillId: string, enabled: boolean) => Promise<unknown> | void;
  isImporting?: boolean;
}

export function SkillsLibrary({
  skills,
  onImportUrl,
  onImportFile,
  onStatus,
  isImporting = false,
}: SkillsLibraryProps) {
  const [url, setUrl] = useState('');

  function submitUrl(event: FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    void onImportUrl(url.trim());
    setUrl('');
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2">
        <form className="rounded-2xl border border-border bg-card p-5" onSubmit={submitUrl}>
          <div className="flex items-center gap-2 font-medium">
            <LinkIcon className="size-4" /> Import from URL
          </div>
          <Label htmlFor="skill-url" className="sr-only">Skill URL</Label>
          <div className="mt-4 flex gap-2">
            <Input
              id="skill-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/research-skill.zip"
              required
            />
            <Button type="submit" disabled={isImporting}>Import</Button>
          </div>
        </form>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 font-medium">
            <FileArchive className="size-4" /> Import a ZIP
          </div>
          <Label htmlFor="skill-file" className="sr-only">Skill ZIP</Label>
          <Input
            id="skill-file"
            className="mt-4"
            type="file"
            accept=".zip,application/zip"
            disabled={isImporting}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onImportFile(file);
              event.target.value = '';
            }}
          />
        </div>
      </div>

      {skills.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <ScrollText className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-4 font-medium">No Skills imported</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Import a standard Agent Skill, then enable it before attaching it to a Topic.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {skills.map((skill) => (
            <Card key={skill.id} className="hover:shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <a href={`/app/skills/${skill.id}`} className="font-semibold hover:underline">
                      {skill.name}
                    </a>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {skill.description}
                    </p>
                  </div>
                  <Switch
                    aria-label={`${skill.enabled ? 'Disable' : 'Enable'} ${skill.name}`}
                    checked={skill.enabled}
                    onCheckedChange={(checked) => void onStatus(skill.id, checked)}
                  />
                </div>
                <Badge className="mt-4" variant="outline">v{skill.currentVersion}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

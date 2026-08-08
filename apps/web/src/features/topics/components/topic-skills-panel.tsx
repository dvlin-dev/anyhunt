import { Card, CardContent, CardHeader, CardTitle } from '@anyhunt/ui';
import type { SkillSummary } from '../types';

interface TopicSkillsPanelProps {
  managedSkill?: SkillSummary | null;
  attachedSkills?: SkillSummary[];
  availableSkills: SkillSummary[];
  onAttachSkill?: (skillId: string) => void;
  onDetachSkill?: (skillId: string) => void;
}

export function TopicSkillsPanel({
  managedSkill,
  attachedSkills = [],
  availableSkills,
  onAttachSkill,
  onDetachSkill,
}: TopicSkillsPanelProps) {
  const attachedIds = new Set(attachedSkills.map((skill) => skill.id));
  const attachable = availableSkills.filter((skill) => skill.enabled && !attachedIds.has(skill.id));

  return <div className="space-y-6">
    <Card className="hover:shadow-sm"><CardHeader><CardTitle>Managed Skill</CardTitle></CardHeader><CardContent>
      {managedSkill ? <a className="text-sm font-medium underline decoration-border underline-offset-4 hover:decoration-foreground" href={`/app/skills/${managedSkill.id}`}>{managedSkill.name}</a> : <p className="text-sm leading-6 text-muted-foreground">Anyhunt creates this after it finds reusable research experience.</p>}
    </CardContent></Card>
    <Card className="hover:shadow-sm"><CardHeader><CardTitle>Attached Skills</CardTitle></CardHeader><CardContent className="space-y-4">
      {attachedSkills.length ? <ul className="space-y-2">{attachedSkills.map((skill) => <li key={skill.id} className="flex items-center justify-between gap-3 text-sm"><span>{skill.name}</span>{onDetachSkill && <button type="button" onClick={() => onDetachSkill(skill.id)} className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Detach</button>}</li>)}</ul> : <p className="text-sm text-muted-foreground">No additional Skills attached.</p>}
      {onAttachSkill && attachable.length > 0 && <label className="block text-sm"><span className="sr-only">Attach a Skill</span><select defaultValue="" onChange={(event) => { if (event.target.value) onAttachSkill(event.target.value); event.target.value = ''; }} className="h-9 w-full rounded-lg border border-border bg-background px-3"><option value="">Attach a Skill…</option>{attachable.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></label>}
    </CardContent></Card>
  </div>;
}

export interface SkillVersion {
  id: string;
  version: number;
  files: Record<string, string>;
  contentHash: string;
  sourceUrl?: string | null;
  createdAt: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  versions?: SkillVersion[];
}

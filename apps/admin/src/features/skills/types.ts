export interface AdminSkill {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  enabled: boolean;
  currentVersion: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { managedTopics: number; attachedTopics: number; versions: number };
}

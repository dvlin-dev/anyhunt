import { useState } from 'react';
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader,
  SimplePagination, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@anyhunt/ui';
import { ListEmptyState, ListErrorState, ListLoadingRows } from '@/components/list-state';
import { useAdminSkills } from '@/features/skills';

export default function SkillsPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const skills = useAdminSkills(page, search);
  return <div className="space-y-6">
    <PageHeader title="Skills" description="Monitor reusable research experience without exposing Skill content." />
    <Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><CardTitle>Skill health</CardTitle><form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}><Input aria-label="Search Skills" placeholder="Search by name" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /><Button type="submit" variant="outline">Search</Button></form></div></CardHeader><CardContent>
      {skills.isLoading ? <ListLoadingRows /> : skills.isError ? <ListErrorState message="Failed to load Skills" /> : skills.data?.items.length === 0 ? <ListEmptyState message="No Skills found" /> : <>
        <Table><TableHeader><TableRow><TableHead>Skill</TableHead><TableHead>Owner</TableHead><TableHead>Health</TableHead><TableHead>Usage</TableHead><TableHead>Updated</TableHead></TableRow></TableHeader>
          <TableBody>{skills.data?.items.map((skill) => <TableRow key={skill.id}><TableCell><div className="font-medium">{skill.name}</div><div className="max-w-md truncate text-xs text-muted-foreground">{skill.description}</div></TableCell><TableCell className="font-mono text-xs">{skill.ownerId}</TableCell><TableCell><Badge variant={skill.archivedAt ? 'outline' : skill.enabled && skill.currentVersion > 0 ? 'success' : 'warning'}>{skill.archivedAt ? 'Archived' : skill.enabled && skill.currentVersion > 0 ? `Healthy · v${skill.currentVersion}` : 'Needs attention'}</Badge></TableCell><TableCell>{skill._count.managedTopics} managed · {skill._count.attachedTopics} attached<div className="text-xs text-muted-foreground">{skill._count.versions} versions</div></TableCell><TableCell>{new Date(skill.updatedAt).toLocaleString()}</TableCell></TableRow>)}</TableBody></Table>
        <div className="mt-4"><SimplePagination page={skills.data?.page ?? page} totalPages={Math.max(1, Math.ceil((skills.data?.total ?? 0) / (skills.data?.limit ?? 20)))} onPageChange={setPage} /></div>
      </>}
    </CardContent></Card>
  </div>;
}

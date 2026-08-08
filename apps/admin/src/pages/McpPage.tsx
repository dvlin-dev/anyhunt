import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from '@anyhunt/ui';
import { ListEmptyState, ListErrorState, ListLoadingRows } from '@/components/list-state';
import { useMcpStatus } from '@/features/mcp';

export default function McpPage() {
  const status = useMcpStatus();
  return <div className="space-y-6">
    <PageHeader title="MCP" description="Monitor deployment-owned MCP connections and allowed Tools." />
    <Card><CardHeader><CardTitle>Server health</CardTitle></CardHeader><CardContent>
      {status.isLoading ? <ListLoadingRows rows={3} /> : status.isError ? <ListErrorState message="Failed to load MCP health" /> : status.data?.servers.length === 0 ? <ListEmptyState message="No MCP servers are configured" /> : <div className="grid gap-3 md:grid-cols-2">
        {status.data?.servers.map((server) => <section key={server.name} className="rounded-xl border border-border p-4" aria-label={`${server.name} MCP server`}>
          <div className="flex items-center justify-between gap-3"><h2 className="font-medium">{server.name}</h2><Badge variant={server.status === 'connected' ? 'success' : 'destructive'}>{server.status}</Badge></div>
          <div className="mt-3 flex flex-wrap gap-1">{server.tools.map((tool) => <Badge key={tool} variant="outline">{tool}</Badge>)}</div>
        </section>)}
      </div>}
      <p className="mt-4 text-xs text-muted-foreground">MCP servers are configured by the deployment. URLs, headers and Tool arguments are never shown here.</p>
    </CardContent></Card>
  </div>;
}

/**
 * [PROPS]: none
 * [EMITS]: none
 * [POS]: Admin 运营概览
 */

import { ShieldCheck, UserPlus, Users } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Skeleton,
  type ChartConfig,
} from '@anyhunt/ui';
import {
  formatDashboardDateLabel,
  formatDashboardNumber,
  useChartData,
  useDashboardStats,
} from '@/features/dashboard';

const chartConfig: ChartConfig = {
  value: { label: 'Registrations', color: 'hsl(var(--primary))' },
};

export default function DashboardPage() {
  const statsQuery = useDashboardStats();
  const chartQuery = useChartData();
  const cards = [
    {
      label: 'Total users',
      value: statsQuery.data?.totalUsers ?? 0,
      icon: Users,
    },
    {
      label: 'New today',
      value: statsQuery.data?.newUsersToday ?? 0,
      icon: UserPlus,
    },
    {
      label: 'Administrators',
      value: statsQuery.data?.adminUsers ?? 0,
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Account and system activity at a glance.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{label}</p>
              <div className="rounded-lg bg-muted p-2">
                <Icon className="h-4 w-4" />
              </div>
            </div>
            {statsQuery.isLoading ? (
              <Skeleton className="mt-3 h-9 w-24" />
            ) : (
              <p className="mt-3 text-3xl font-semibold tabular-nums">
                {formatDashboardNumber(value)}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold">Registrations</h3>
        <p className="text-sm text-muted-foreground">Last seven days</p>
        {chartQuery.isLoading ? (
          <Skeleton className="mt-4 h-64 w-full" />
        ) : (
          <ChartContainer config={chartConfig} className="mt-4 h-64 w-full">
            <AreaChart data={chartQuery.data?.registrations ?? []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDashboardDateLabel}
                tickLine={false}
                axisLine={false}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatDashboardDateLabel(String(value))}
                  />
                }
              />
              <Area
                dataKey="value"
                type="monotone"
                stroke="var(--color-value)"
                fill="var(--color-value)"
                fillOpacity={0.12}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}

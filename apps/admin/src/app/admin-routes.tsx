/**
 * [PROVIDES]: ADMIN_PROTECTED_ROUTES、ADMIN_NAV_GROUPS、isPathActive
 * [DEPENDS]: React lazy、lucide-react
 * [POS]: Admin 路由与侧栏导航单一事实源
 */

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import {
  Brain,
  CircleAlert,
  Gauge,
  Layers,
  LayoutDashboard,
  ListTodo,
  Radio,
  Rss,
  Send,
  Server,
  Wrench,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type AdminNavGroupId =
  | 'overview'
  | 'users'
  | 'content'
  | 'operations'
  | 'logs'
  | 'ai';

type RouteComponent = LazyExoticComponent<ComponentType>;

export interface AdminNavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export interface AdminNavGroup {
  id: AdminNavGroupId;
  label: string;
  icon: LucideIcon;
  items: AdminNavItem[];
}

export interface AdminProtectedRoute {
  id: string;
  component: RouteComponent;
  index?: true;
  path?: string;
  nav?: {
    groupId: AdminNavGroupId;
    path: string;
    label: string;
    icon: LucideIcon;
  };
}

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const UsersPage = lazy(() => import('@/pages/UsersPage'));
const TopicsPage = lazy(() => import('@/pages/TopicsPage'));
const TopicReportsPage = lazy(() => import('@/pages/TopicReportsPage'));
const SubscriptionsPage = lazy(() => import('@/pages/SubscriptionsPage'));
const RunsPage = lazy(() => import('@/pages/RunsPage'));
const DeliveriesPage = lazy(() => import('@/pages/DeliveriesPage'));
const SkillsPage = lazy(() => import('@/pages/SkillsPage'));
const QueuesPage = lazy(() => import('@/pages/QueuesPage'));
const LogsRequestsPage = lazy(() => import('@/pages/logs/LogsRequestsPage'));
const LlmPage = lazy(() => import('@/pages/LlmPage'));
const McpPage = lazy(() => import('@/pages/McpPage'));

const GROUPS: Array<Omit<AdminNavGroup, 'items'>> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'content', label: 'Research', icon: Rss },
  { id: 'operations', label: 'Operations', icon: Layers },
  { id: 'logs', label: 'Logs', icon: TriangleAlert },
  { id: 'ai', label: 'AI', icon: Brain },
];

export const ADMIN_PROTECTED_ROUTES: AdminProtectedRoute[] = [
  {
    id: 'dashboard',
    index: true,
    component: DashboardPage,
    nav: {
      groupId: 'overview',
      path: '/',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
  },
  {
    id: 'users',
    path: 'users',
    component: UsersPage,
    nav: { groupId: 'users', path: '/users', label: 'Users', icon: Users },
  },
  {
    id: 'topics',
    path: 'topics',
    component: TopicsPage,
    nav: { groupId: 'content', path: '/topics', label: 'Topics', icon: Rss },
  },
  {
    id: 'reports',
    path: 'reports',
    component: TopicReportsPage,
    nav: { groupId: 'content', path: '/reports', label: 'Reports', icon: CircleAlert },
  },
  {
    id: 'subscriptions',
    path: 'subscriptions',
    component: SubscriptionsPage,
    nav: { groupId: 'content', path: '/subscriptions', label: 'Subscriptions', icon: Radio },
  },
  {
    id: 'runs',
    path: 'runs',
    component: RunsPage,
    nav: { groupId: 'operations', path: '/runs', label: 'Runs', icon: Gauge },
  },
  {
    id: 'deliveries',
    path: 'deliveries',
    component: DeliveriesPage,
    nav: { groupId: 'operations', path: '/deliveries', label: 'Deliveries', icon: Send },
  },
  {
    id: 'skills',
    path: 'skills',
    component: SkillsPage,
    nav: { groupId: 'operations', path: '/skills', label: 'Skills', icon: Wrench },
  },
  {
    id: 'queues',
    path: 'queues',
    component: QueuesPage,
    nav: {
      groupId: 'operations',
      path: '/queues',
      label: 'Queues',
      icon: Layers,
    },
  },
  {
    id: 'request-logs',
    path: 'logs/requests',
    component: LogsRequestsPage,
    nav: {
      groupId: 'logs',
      path: '/logs/requests',
      label: 'Request logs',
      icon: ListTodo,
    },
  },
  {
    id: 'llm',
    path: 'llm',
    component: LlmPage,
    nav: { groupId: 'ai', path: '/llm', label: 'Models', icon: Brain },
  },
  {
    id: 'mcp',
    path: 'mcp',
    component: McpPage,
    nav: { groupId: 'ai', path: '/mcp', label: 'MCP', icon: Server },
  },
];

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = GROUPS.flatMap((group) => {
  const items = ADMIN_PROTECTED_ROUTES.flatMap((route) =>
    route.nav?.groupId === group.id
      ? [
          {
            path: route.nav.path,
            label: route.nav.label,
            icon: route.nav.icon,
          },
        ]
      : [],
  );
  return items.length > 0 ? [{ ...group, items }] : [];
});

export function isPathActive(pathname: string, itemPath: string): boolean {
  if (itemPath === '/') return pathname === '/';
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

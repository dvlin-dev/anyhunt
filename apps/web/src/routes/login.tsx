/**
 * [POS]: 统一登录页面路由
 *
 * 支持 redirect 参数：
 * - /login?redirect=/
 */
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod/v3';
import { getRedirectUrl } from '@/lib/redirect';
import { AuthRouteShell } from '@/components/auth/auth-route-shell';

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  component: LoginPage,
  head: () => ({
    meta: [
      { title: 'Sign In - Anyhunt' },
      { name: 'description', content: 'Sign in to your Anyhunt account' },
    ],
  }),
});

function LoginPage() {
  const { redirect: searchRedirect } = Route.useSearch();
  const redirectTo = getRedirectUrl(searchRedirect);
  return <AuthRouteShell mode="login" redirectTo={redirectTo} />;
}

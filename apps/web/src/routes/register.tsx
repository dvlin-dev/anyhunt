/**
 * [POS]: 注册页面路由
 *
 * 支持 redirect 参数：
 * - /register?redirect=/
 */
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod/v3';
import { getRedirectUrl } from '@/lib/redirect';
import { AuthRouteShell } from '@/components/auth/auth-route-shell';

const registerSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute('/register')({
  validateSearch: registerSearchSchema,
  component: RegisterPage,
  head: () => ({
    meta: [
      { title: 'Create Account - Anyhunt' },
      { name: 'description', content: 'Create your Anyhunt account' },
    ],
  }),
});

function RegisterPage() {
  const { redirect: searchRedirect } = Route.useSearch();
  const redirectTo = getRedirectUrl(searchRedirect);
  return <AuthRouteShell mode="register" redirectTo={redirectTo} />;
}

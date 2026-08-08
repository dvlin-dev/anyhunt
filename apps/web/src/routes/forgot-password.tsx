/**
 * [POS]: 忘记密码页面路由
 */
import { createFileRoute } from '@tanstack/react-router';
import { AuthRouteShell } from '@/components/auth/auth-route-shell';

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
  head: () => ({
    meta: [
      { title: 'Reset Password - Anyhunt' },
      { name: 'description', content: 'Reset your Anyhunt password' },
    ],
  }),
});

function ForgotPasswordPage() {
  return <AuthRouteShell mode="forgotPassword" />;
}

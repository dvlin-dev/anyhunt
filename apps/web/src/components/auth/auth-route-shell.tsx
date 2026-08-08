/**
 * [PROPS]: auth mode 与登录后跳转路径
 * [EMITS]: 身份流程完成后的导航
 * [POS]: 登录、注册和密码重置路由的共享页面壳
 */

import { ForgotPasswordForm } from './forgot-password-form';
import { LoginForm } from './login-form';
import { RegisterForm } from './register-form';

export type AuthRouteMode = 'login' | 'register' | 'forgotPassword';

export function AuthRouteShell({
  mode,
  redirectTo = '/',
}: {
  mode: AuthRouteMode;
  redirectTo?: string;
}) {
  const navigate = (path: string) => window.location.assign(path);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 px-4 py-12">
      <div className="w-full max-w-md">
        {mode === 'login' ? (
          <LoginForm
            onSuccess={() => navigate(redirectTo)}
            onRequestRegister={() => navigate('/register')}
            onRequestForgotPassword={() => navigate('/forgot-password')}
          />
        ) : mode === 'register' ? (
          <RegisterForm
            onSuccess={() => navigate(redirectTo)}
            onRequestSignIn={() => navigate('/login')}
          />
        ) : (
          <ForgotPasswordForm
            onSuccess={() => navigate('/login')}
            onRequestSignIn={() => navigate('/login')}
          />
        )}
      </div>
    </main>
  );
}

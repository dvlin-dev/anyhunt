/**
 * [INPUT]: PrismaClient/OTP 发送器/secondaryStorage/ADMIN_EMAILS/BETTER_AUTH_RATE_LIMIT_*
 * [OUTPUT]: Better Auth 实例（Anyhunt Dev 专用配置，OTP 验证后自动登录）
 * [POS]: Auth 配置入口
 *
 * [PROTOCOL]: 仅在本文件 Header 事实或所属目录职责、结构、关键契约变化时，才更新 Header 或目录 CLAUDE.md。
 */
import { betterAuth, type SecondaryStorage } from 'better-auth';
import { APIError } from 'better-call';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { jwt } from 'better-auth/plugins/jwt';
import type { JwtOptions } from 'better-auth/plugins/jwt';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import type { JWTPayload } from 'jose';
import type { PrismaClient } from '../../generated/prisma-main/client';
import { isDisposableEmail } from './email-validator';
import { REFRESH_TOKEN_TTL_SECONDS, isProduction } from './auth.constants';
import {
  getAuthBaseUrl,
  getJwtPluginOptions,
  getTrustedOrigins,
} from './auth.config';

const DEFAULT_AUTH_RATE_LIMIT_WINDOW_SECONDS = 60;
const DEFAULT_AUTH_RATE_LIMIT_MAX = 120;

type AuthSessionSnapshot = {
  session: { id: string; expiresAt: Date };
  user: { id: string };
};

type JwtApi = {
  signJWT: (input: {
    body: { payload: JWTPayload; overrideOptions?: JwtOptions };
  }) => Promise<{ token: string }>;
  verifyJWT: (input: { body: { token: string } }) => Promise<{
    payload?: JWTPayload | null;
  }>;
};

type AuthApi = {
  getSession: (input: {
    headers: Headers;
  }) => Promise<AuthSessionSnapshot | null>;
};

type AuthContextSnapshot = {
  options: {
    emailVerification?: {
      autoSignInAfterVerification?: boolean;
    };
    rateLimit?: {
      window?: number;
      max?: number;
    };
  };
};

export type Auth = {
  handler: (request: Request) => Promise<Response>;
  api: AuthApi & JwtApi;
  $context: Promise<AuthContextSnapshot>;
};

const parsePositiveIntEnv = (
  key: string,
  fallback: number,
  opts: { min?: number } = {},
): number => {
  const raw = process.env[key];
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);
  const min = opts.min ?? 1;
  if (!Number.isInteger(value) || value < min) {
    console.warn(
      `[BetterAuth] Invalid ${key}="${raw}", fallback to ${fallback}`,
    );
    return fallback;
  }

  return value;
};

export function getAuthRateLimitConfig(): { window: number; max: number } {
  return {
    window: parsePositiveIntEnv(
      'BETTER_AUTH_RATE_LIMIT_WINDOW_SECONDS',
      DEFAULT_AUTH_RATE_LIMIT_WINDOW_SECONDS,
    ),
    max: parsePositiveIntEnv(
      'BETTER_AUTH_RATE_LIMIT_MAX',
      DEFAULT_AUTH_RATE_LIMIT_MAX,
    ),
  };
}

export function isAdminEmail(
  email: string | null | undefined,
  rawAdminEmails: string | undefined,
): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  const adminEmails = (rawAdminEmails ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(normalized);
}

/**
 * Create Better Auth instance with Prisma adapter
 *
 * Better Auth 提供的功能：
 * - Email/Password 认证
 * - Email OTP 验证
 * - Session 管理
 * - 支持第三方登录（Google/Apple）
 *
 * 认证方式：
 * - Web 端：refreshToken Cookie + accessToken（JWT）
 * - API/Mobile：refreshToken（Secure Storage）+ accessToken（JWT）
 */
export function createBetterAuth(
  prisma: PrismaClient,
  sendOTP: (email: string, otp: string) => Promise<void>,
  secondaryStorage?: SecondaryStorage,
): Auth {
  // 验证 BETTER_AUTH_SECRET
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'BETTER_AUTH_SECRET must be set and at least 32 characters long',
    );
  }

  const baseURL = getAuthBaseUrl();
  const trustedOrigins = getTrustedOrigins();
  const jwtOptions = getJwtPluginOptions(baseURL);
  const authRateLimit = getAuthRateLimitConfig();

  const auth = betterAuth({
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),
    secondaryStorage,
    secret,
    baseURL,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },
    emailVerification: {
      autoSignInAfterVerification: true,
    },
    session: {
      expiresIn: REFRESH_TOKEN_TTL_SECONDS,
      updateAge: 60 * 60 * 24,
      storeSessionInDatabase: false,
      cookieCache: {
        enabled: true,
        strategy: 'jwe',
        maxAge: REFRESH_TOKEN_TTL_SECONDS,
      },
    },
    trustedOrigins,
    advanced: {
      useSecureCookies: isProduction,
      // 跨子域 Cookie 共享：anyhunt.app, console.anyhunt.app, admin.anyhunt.app
      // 仅在生产环境启用（本地开发使用单域）
      ...(isProduction && {
        crossSubDomainCookies: {
          enabled: true,
          domain: '.anyhunt.app',
        },
      }),
    },
    rateLimit: {
      enabled: true,
      window: authRateLimit.window,
      max: authRateLimit.max,
      storage: secondaryStorage ? 'secondary-storage' : 'memory',
    },
    // 数据库钩子
    databaseHooks: {
      // 防止已删除用户创建新 session
      session: {
        create: {
          before: async (session: { userId: string }) => {
            const user = await prisma.user.findUnique({
              where: { id: session.userId },
              select: { deletedAt: true },
            });
            if (user?.deletedAt) {
              throw new APIError('FORBIDDEN', {
                message: 'Account has been deleted',
              });
            }
            return { data: session };
          },
        },
      },
      // 用户创建后初始化管理员标记
      user: {
        create: {
          after: async (user: { id: string; email: string }) => {
            if (isAdminEmail(user.email, process.env.ADMIN_EMAILS)) {
              await prisma.user.update({
                where: { id: user.id },
                data: { isAdmin: true },
              });
            }
          },
        },
      },
    },
    plugins: [
      jwt(jwtOptions),
      // Email OTP 插件：邮箱验证码验证
      emailOTP({
        sendVerificationOTP: async ({ email, otp, type }) => {
          // 检查是否临时邮箱（注册和密码重置都检查）
          if (isDisposableEmail(email)) {
            throw new APIError('BAD_REQUEST', {
              message: 'This email is not supported.',
            });
          }

          // 注册验证和密码重置都发送 OTP
          if (type === 'email-verification' || type === 'forget-password') {
            await sendOTP(email, otp);
          }
        },
        sendVerificationOnSignUp: true,
        otpLength: 6,
        expiresIn: 300, // 5 分钟
        allowedAttempts: 3,
        overrideDefaultEmailVerification: true, // 使用 OTP 替代验证链接
      }),
    ],
  });

  // Expose the narrow application facade; the configured jwt plugin provides
  // signJWT/verifyJWT at runtime even when Better Auth widens its plugin tuple.
  return auth;
}

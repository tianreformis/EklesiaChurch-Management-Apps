import { Hono } from 'hono';
import { z } from 'zod';
import {
  acceptInvitationSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from '@eklesia/shared';
import {
  acceptInvitation,
  getInvitationInfo,
  login,
  logout,
  requestPasswordReset,
  resetPassword,
  toProfile,
  type AuthServiceDependencies,
} from '../modules/auth/service.js';
import {
  clearSessionCookie,
  isSecureBaseUrl,
  readSessionToken,
  writeSessionCookie,
} from '../lib/cookies.js';
import { unauthorized } from '../lib/errors.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { jsonBody, pathParams } from '../middleware/validate.js';
import type { AppEnv } from '../types.js';

const tokenRouteSchema = z.object({ token: z.string().min(10, 'Tautan tidak valid.') });

/** Rute autentikasi. Semua jalur yang menulis dibatasi laju per alamat IP. */
export function createAuthRoutes(deps: AuthServiceDependencies) {
  const cookieName = deps.env.SESSION_COOKIE_NAME;
  const maxAgeSeconds = deps.env.SESSION_TTL_DAYS * 24 * 60 * 60;
  const secure = isSecureBaseUrl(deps.env.APP_BASE_URL);

  return new Hono<AppEnv>()
    .post(
      '/login',
      rateLimit({ name: 'login', windowMs: 15 * 60_000, max: 10 }),
      jsonBody(loginSchema),
      async (c) => {
        const result = await login(deps, c.req.valid('json'));
        writeSessionCookie(c, result.token, { name: cookieName, maxAgeSeconds, secure });
        return c.json({ profile: result.profile });
      },
    )
    .post('/logout', async (c) => {
      await logout(deps.db, readSessionToken(c, cookieName));
      clearSessionCookie(c, cookieName);
      return c.json({ ok: true as const });
    })
    .get('/me', (c) => {
      const auth = c.get('auth');
      if (!auth) {
        throw unauthorized();
      }
      return c.json({ profile: toProfile(auth) });
    })
    .post(
      '/forgot-password',
      rateLimit({ name: 'forgot-password', windowMs: 15 * 60_000, max: 5 }),
      jsonBody(forgotPasswordSchema),
      async (c) => {
        const result = await requestPasswordReset(deps, c.req.valid('json').email);
        return c.json(result);
      },
    )
    .post(
      '/reset-password',
      rateLimit({ name: 'reset-password', windowMs: 15 * 60_000, max: 10 }),
      jsonBody(resetPasswordSchema),
      async (c) => {
        await resetPassword(deps, c.req.valid('json'));
        return c.json({ ok: true as const });
      },
    )
    .get('/invitations/:token', pathParams(tokenRouteSchema), async (c) => {
      const info = await getInvitationInfo(deps.db, c.req.param('token'));
      return c.json({ invitation: info });
    })
    .post(
      '/invitations/accept',
      rateLimit({ name: 'accept-invitation', windowMs: 15 * 60_000, max: 10 }),
      jsonBody(acceptInvitationSchema),
      async (c) => {
        const result = await acceptInvitation(deps, c.req.valid('json'));
        writeSessionCookie(c, result.token, { name: cookieName, maxAgeSeconds, secure });
        return c.json({ profile: result.profile });
      },
    );
}

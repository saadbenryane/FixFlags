import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { twoFactor } from 'better-auth/plugins'
import { passkey } from '@better-auth/passkey'
import { prisma } from './db'
import { getEnv } from './env'
import { resend } from '@/lib/email/client'
import { emailButtonStyle, emailLayout, escapeEmailHtml } from '@/lib/email/layout'
import { NOTIFICATION_EMAIL_COPY } from '@/lib/marketing/copy/notification-emails'
import { deleteUserProductData } from '@/lib/account/cleanup'
import { recordSignupConversion } from '@/lib/analytics/signup-conversion'
import { BRAND } from '@/lib/marketing/copy-barrel'
import {
  getAuthBaseUrl,
  getPasskeyOrigin,
  getPasskeyRpID,
  isGoogleOAuthConfigured,
  isGithubOAuthConfigured,
} from '@/lib/auth/env'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? `${BRAND.name} <${BRAND.supportEmail}>`

export const auth = betterAuth({
  appName: BRAND.name,
  // Backup-code enrollment uses the plugin's secret record. Public
  // authenticator-app routes stay unavailable for passkey-only two-factor.
  disabledPaths: ['/two-factor/get-totp-uri', '/two-factor/verify-totp'],
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const account = await prisma.user.findUnique({ where: { id: session.userId }, select: { lifecycleStatus: true } })
          if (!account || account.lifecycleStatus !== 'ACTIVE') throw new APIError('FORBIDDEN', { message: 'This account is unavailable.' })
          return { data: session }
        },
      },
    },
    user: {
      create: {
        // Fires once per signup (email + OAuth). Fire-and-forget: signup must
        // never fail or slow down for analytics. recordSignupConversion never
        // throws and does its own error logging.
        after: async (user) => {
          void recordSignupConversion({ id: user.id, email: user.email })
        },
      },
    },
  },
  baseURL: getAuthBaseUrl(),
  secret: process.env.BETTER_AUTH_SECRET!,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: getEnv().REQUIRE_EMAIL_VERIFICATION,
    sendResetPassword: async ({ user, url }) => {
      if (!resend) {
        throw new Error('Password reset email is not configured (RESEND_API_KEY missing)')
      }
      const copy = NOTIFICATION_EMAIL_COPY.passwordReset
      const greeting = `Hi${user.name ? ` ${user.name}` : ''},`
      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: user.email,
        subject: copy.subject,
        html: emailLayout(`<p>${escapeEmailHtml(greeting)}</p><p>${copy.body}</p><p><a href="${escapeEmailHtml(url)}" style="${emailButtonStyle}">${copy.action}</a></p><p>${copy.unrequested}</p>`),
        text: `${greeting}\n\n${copy.body}\n\n${copy.action}: ${url}\n\n${copy.unrequested}`,
      })
      if (error) throw new Error(error.message)
      if (!data?.id) throw new Error('Email provider did not confirm acceptance')
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      if (!resend) throw new Error('Email verification is not configured')
      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: user.email,
        subject: NOTIFICATION_EMAIL_COPY.verification.subject,
        html: emailLayout(`<p>${NOTIFICATION_EMAIL_COPY.verification.body}</p><p><a href="${escapeEmailHtml(url)}" style="${emailButtonStyle}">${NOTIFICATION_EMAIL_COPY.verification.action}</a></p>`),
        text: `${NOTIFICATION_EMAIL_COPY.verification.body}\n\n${NOTIFICATION_EMAIL_COPY.verification.action}: ${url}`,
      })
      if (error) throw new Error(error.message)
      if (!data?.id) throw new Error('Email provider did not confirm acceptance')
    },
  },
  socialProviders: {
    ...(isGoogleOAuthConfigured() && {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    }),
    ...(isGithubOAuthConfigured() && {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      },
    }),
  },
  user: {
    changeEmail: {
      enabled: true,
    },
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        await deleteUserProductData(user.id)
      },
      sendDeleteAccountVerification: async ({ user, url }) => {
        if (!resend) throw new Error('Account deletion email is not configured')
        const copy = NOTIFICATION_EMAIL_COPY.deletion
        const { data, error } = await resend.emails.send({
          from: FROM_EMAIL,
          to: user.email,
          subject: copy.subject,
          html: emailLayout(`<p>${copy.body}</p><p><a href="${escapeEmailHtml(url)}" style="${emailButtonStyle}">${copy.action}</a></p>`),
          text: `${copy.body}\n\n${copy.action}: ${url}`,
        })
        if (error) throw new Error(error.message)
        if (!data?.id) throw new Error('Email provider did not confirm acceptance')
      },
    },
    additionalFields: {
      plan: {
        type: 'string',
        defaultValue: 'FREE',
        input: false,
      },
      role: {
        type: 'string',
        defaultValue: 'user',
        input: false,
      },
      lifecycleStatus: { type: 'string', defaultValue: 'ACTIVE', input: false },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Passkey is the second factor. Refuse to enable 2FA until at least one
      // passkey is registered so users cannot lock themselves out of email sign-in.
      if (ctx.path !== '/two-factor/enable') return
      const session = await getSessionFromCtx(ctx)
      const userId = session?.user?.id
      if (!userId) return
      const passkeyCount = await prisma.passkey.count({ where: { userId } })
      if (passkeyCount < 1) {
        throw new APIError('BAD_REQUEST', {
          message: 'Add a passkey before enabling two-factor authentication',
        })
      }
    }),
  },
  plugins: [
    passkey({
      rpID: getPasskeyRpID(),
      rpName: BRAND.name,
      origin: getPasskeyOrigin(),
    }),
    twoFactor({
      issuer: BRAND.name,
      // Passkey is the primary second factor; backup codes cover recovery.
      skipVerificationOnEnable: true,
      allowPasswordless: true,
    }),
  ],
})

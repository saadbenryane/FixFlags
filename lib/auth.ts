import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './db'
import { getEnv } from './env'
import { resend } from '@/lib/email/client'
import { deleteUserProductData } from '@/lib/account/cleanup'
import { recordSignupConversion } from '@/lib/analytics/signup-conversion'
import { BRAND } from '@/lib/marketing/copy'
import {
  getAuthBaseUrl,
  isGoogleOAuthConfigured,
  isGithubOAuthConfigured,
} from '@/lib/auth/env'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? `${BRAND.name} <${BRAND.supportEmail}>`

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  databaseHooks: {
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
      void resend.emails.send({
        from: FROM_EMAIL,
        to: user.email,
        subject: `Reset your ${BRAND.name} password`,
        html: `
          <p>Hi${user.name ? ` ${user.name}` : ''},</p>
          <p>Click the link below to reset your password. This link expires in one hour.</p>
          <p><a href="${url}">Reset password</a></p>
          <p>If you did not request this, you can ignore this email.</p>
        `,
      })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      if (!resend) throw new Error('Email verification is not configured')
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: user.email,
        subject: `Verify your ${BRAND.name} email`,
        html: `
          <p>Verify your email to activate your ${BRAND.name} account.</p>
          <p><a href="${url}">Verify email</a></p>
        `,
      })
      if (error) throw new Error(error.message)
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
        const { error } = await resend.emails.send({
          from: FROM_EMAIL,
          to: user.email,
          subject: `Confirm ${BRAND.name} account deletion`,
          html: `
            <p>This permanently deletes your ${BRAND.name} account, reports, screenshots, and API keys.</p>
            <p><a href="${url}">Confirm account deletion</a></p>
          `,
        })
        if (error) throw new Error(error.message)
      },
    },
    additionalFields: {
      plan: {
        type: 'string',
        defaultValue: 'FREE',
      },
      role: {
        type: 'string',
        defaultValue: 'user',
      },
    },
  },
})

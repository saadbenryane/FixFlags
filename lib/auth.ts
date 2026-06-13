import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './db'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'QualityOS <hello@qualityos.com>'

function hasGoogleOAuth(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

function hasGithubOAuth(): boolean {
  return !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET!,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      if (!resend) {
        throw new Error('Password reset email is not configured (RESEND_API_KEY missing)')
      }
      void resend.emails.send({
        from: FROM_EMAIL,
        to: user.email,
        subject: 'Reset your QualityOS password',
        html: `
          <p>Hi${user.name ? ` ${user.name}` : ''},</p>
          <p>Click the link below to reset your password. This link expires in one hour.</p>
          <p><a href="${url}">Reset password</a></p>
          <p>If you did not request this, you can ignore this email.</p>
        `,
      })
    },
  },
  socialProviders: {
    ...(hasGoogleOAuth() && {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    }),
    ...(hasGithubOAuth() && {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      },
    }),
  },
  user: {
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

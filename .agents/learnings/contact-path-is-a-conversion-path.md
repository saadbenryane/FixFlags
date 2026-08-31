# Contact paths are conversion paths

**Date:** 2026-08-31
**Check module:** `lib/audit/checks/conversion-friction.ts`
**Confidence:** HIGH
**Evidence:** Production report `cmtgkvqd50001n020ae6okywu` on saadbenryane.com

## False positive pattern

A consulting homepage with "Start a project", case studies, and a contact form was flagged IMPORTANT `friction-no-commitment-path` because it had no SaaS free trial, demo, or pricing page.

## Root cause

The check treated trial/demo/pricing/booking as the only valid first step. Studio and personal-brand sites convert through contact.

## Fix

Count start a project, get in touch, contact, and work-with-me as a conversion path. Do not prescribe a fake free trial.

## Regression prevention

- `lib/audit/__tests__/checks-ux.test.ts`
- `.agents/accuracy/false-positives.json` `fp-015`

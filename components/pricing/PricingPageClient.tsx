"use client";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  LockKeyhole,
  ShieldCheck,
  Timer,
  Users,
  Zap,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PricingCTAButton } from "@/components/pricing/PricingCTAButton";
import { PricingComparisonTable } from "@/components/pricing/PricingComparisonTable";
import { FaqSection } from "@/components/marketing/FaqSection";
import { MarketingPageViewTracker } from "@/components/marketing/MarketingPageViewTracker";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Surface } from "@/components/ui/surface";
import { Body, Heading, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { PLANS, PRICING, PRICING_FAQ, BILLING_ACTION_COPY } from "@/lib/marketing/copy";
import { CONTACT_PLAN } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { useMe } from "@/hooks/useMe";
import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics/events";

const PLAN_ICONS = {
  FREE: ShieldCheck,
  BUILDER: Zap,
  TEAM: Users,
} as const;

const ASSURANCE_ICONS = [Timer, CreditCard, LockKeyhole] as const;

export function PricingPageClient() {
  useEffect(() => {
    trackEvent("viewed_pricing");
  }, []);
  const { user } = useMe();
  const currentPlan = user?.plan ?? "FREE";
  const isLoggedIn = !!user;

  return (
    <Section spacing="tight" className="relative overflow-hidden">
      <MarketingPageViewTracker page="/pricing" />
      <Container
        variant="marketing"
        className="space-y-12 px-4 sm:space-y-14 sm:px-6 lg:space-y-16 lg:px-12"
      >
        <div className="grid items-center gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)] lg:gap-10">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 font-mono text-[0.6875rem] font-medium uppercase tracking-label text-brand sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
              {PRICING.label}
            </p>
            <Heading
              as="h1"
              className="mt-4 max-w-[17ch] font-display text-balance text-[2.75rem] font-bold leading-[1.03] tracking-display sm:text-[3.35rem] lg:text-[3.65rem]"
            >
              {PRICING.headline}
            </Heading>
            <Body className="mt-5 max-w-2xl text-muted-foreground text-pretty sm:text-lg">
              {PRICING.subhead}
            </Body>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              {BILLING_ACTION_COPY.tierOffers.pricingCallout}
            </p>

            <ul className="mt-6 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              {PRICING.assurances.map((assurance, index) => {
                const Icon = ASSURANCE_ICONS[index]!;
                return (
                  <li
                    key={assurance}
                    className="flex min-h-11 items-center gap-2.5"
                  >
                    <Icon
                      className="h-4 w-4 shrink-0 text-foreground/70"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <span>{assurance}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="relative mx-auto hidden w-full max-w-[29rem] lg:block">
            <Image
              src="/marketing/visuals/pricing-glass-mark.webp"
              alt=""
              width={1448}
              height={1086}
              priority
              sizes="(min-width: 1280px) 34rem, 28rem"
              className="relative h-auto w-full select-none object-contain mix-blend-multiply [-webkit-mask-image:radial-gradient(ellipse_at_center,black_56%,transparent_83%)] [mask-image:radial-gradient(ellipse_at_center,black_56%,transparent_83%)]"
              draggable={false}
            />
          </div>
        </div>

        <h2 className="sr-only">Plans</h2>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
          {PLANS.map((plan) =>
            (() => {
              const PlanIcon = PLAN_ICONS[plan.plan];
              return (
                <Card
                  key={plan.name}
                  className={cn(
                    "relative flex h-full min-h-[31rem] flex-col overflow-hidden bg-background/88 shadow-card",
                    plan.highlight &&
                      "bg-[linear-gradient(180deg,hsl(var(--brand)/0.055),hsl(var(--background)/0.94))] shadow-card-hover ring-1 ring-brand/30",
                  )}
                >
                  <CardHeader className="space-y-4 p-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <span
                        className={cn(
                          "inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] bg-muted/70 text-foreground shadow-sm",
                          plan.highlight && "bg-brand/10 text-brand",
                        )}
                      >
                        <PlanIcon
                          className="h-5 w-5"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                      </span>
                      {plan.highlight ? (
                        <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-brand-foreground">
                          Best for frequent checks
                        </span>
                      ) : null}
                    </div>

                    <div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {plan.persona}
                      </CardDescription>
                    </div>

                    <p className="text-sm font-medium leading-snug text-pretty">
                      {plan.outcome}
                    </p>

                    <div>
                      <div className="flex items-end gap-1">
                        <span className="font-mono text-4xl font-semibold tabular-nums tracking-display">
                          {plan.price}
                        </span>
                        <span className="pb-1 text-sm text-muted-foreground">
                          {plan.period}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-muted-foreground">
                        {plan.audits}
                      </p>
                    </div>
                  </CardHeader>

                  <CardContent className="flex flex-1 flex-col gap-6 p-5 pt-0 sm:p-6 sm:pt-0">
                    <ul className="flex-1 space-y-3">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2.5 text-sm leading-snug"
                        >
                          <CheckCircle2
                            className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                            aria-hidden
                          />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <PricingCTAButton
                      plan={plan.plan}
                      cta={plan.cta}
                      signUpHref={plan.href as Route}
                      highlight={plan.highlight}
                      isLoggedIn={isLoggedIn}
                      currentPlan={currentPlan}
                      userEmail={user?.email ?? undefined}
                    />
                  </CardContent>
                </Card>
              );
            })(),
          )}
        </div>

        <div className="space-y-6">
          <div className="max-w-2xl">
            <Heading as="h2">Compare plans</Heading>
            <Muted className="mt-2 text-sm">{PRICING.allPlansInclude}</Muted>
          </div>
          <PricingComparisonTable />
        </div>

        <Surface
          variant="elevated"
          className="grid overflow-hidden p-0 shadow-card md:grid-cols-[11rem_minmax(0,1fr)_auto] md:items-stretch"
        >
          <div className="relative hidden min-h-40 overflow-hidden bg-muted/30 md:block">
            <Image
              src="/marketing/visuals/pricing-glass-mark.webp"
              alt=""
              fill
              sizes="11rem"
              className="object-cover object-center mix-blend-multiply"
            />
          </div>
          <div className="p-5 sm:p-6">
            <p className="text-lg font-semibold tracking-heading">
              {CONTACT_PLAN.name}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {CONTACT_PLAN.outcome}
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {CONTACT_PLAN.features.map((feature) => (
                <span key={feature} className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand" aria-hidden />
                  {feature}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center p-5 pt-0 sm:p-6 sm:pt-0 md:pt-6">
            <Button variant="ink" className="w-full md:w-auto" asChild>
              <Link href={CONTACT_PLAN.href}>
                {CONTACT_PLAN.cta}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </Surface>

        <div className="mx-auto max-w-3xl">
          <FaqSection
            items={PRICING_FAQ}
            title="Pricing questions"
            sectionLabel={null}
          />
        </div>
      </Container>
    </Section>
  );
}

import { HomepageReportPreview } from "@/components/marketing/landing/HomepageReportPreview";
import { LandingSectionHeader } from "@/components/marketing/landing/LandingSectionHeader";
import { RevealOnView } from "@/components/marketing/landing/RevealOnView";
import {
  SampleSectionCta,
  SampleViewTracker,
} from "@/components/marketing/landing/SampleFunnelEvents";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { LANDING_PAGE } from "@/lib/marketing/copy";
import type { CuratedSampleAudit } from "@/lib/marketing/curated-sample";
import { buildSampleReportDisplay } from "@/lib/marketing/sample-report-display";
import { getStaticSampleAudit } from "@/lib/marketing/static-sample";
import { buildCuratedSampleWorkspaceModel } from "@/lib/report/workspace-adapters";

interface SampleReportSectionProps {
  audit?: CuratedSampleAudit;
}

export function SampleReportSection({ audit }: SampleReportSectionProps) {
  const copy = LANDING_PAGE.sampleReport;
  const report = buildSampleReportDisplay(audit ?? getStaticSampleAudit());
  const workspace = buildCuratedSampleWorkspaceModel(report);

  return (
    <Section
      spacing="marketing"
      className="overflow-hidden bg-background py-14 sm:py-16 lg:py-20"
    >
      <SampleViewTracker placement="homepage" />
      <Container
        id="sample-review"
        className="scroll-mt-[calc(var(--header-height-marketing)+1rem)] px-4 sm:px-6 lg:px-12"
        variant="marketing"
      >
        <div className="grid items-center gap-10 xl:grid-cols-[minmax(18rem,0.58fr)_minmax(0,1.42fr)] xl:gap-12">
          <RevealOnView className="flex flex-col gap-6">
            <LandingSectionHeader
              align="left"
              label={copy.label}
              brandEyebrow
              headline={copy.headlineDisplay}
              accentPeriod={copy.headlineAccentPeriod}
              subhead={copy.body}
              size="lg"
              className="max-w-md space-y-4 sm:space-y-5"
            />
            <SampleSectionCta />
          </RevealOnView>

          <RevealOnView className="min-w-0">
            <HomepageReportPreview model={workspace} />
          </RevealOnView>
        </div>
      </Container>
    </Section>
  );
}

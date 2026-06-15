import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { SEGMENT_PROOF_SECTION } from '@/lib/marketing/copy'

export function SegmentProofSection() {
  return (
    <Section spacing="default">
      <Container className="space-y-10">
        <SectionIntro
          label={SEGMENT_PROOF_SECTION.label}
          headline={SEGMENT_PROOF_SECTION.headline}
          subhead={SEGMENT_PROOF_SECTION.subhead}
        />

        <div className="grid gap-6 md:grid-cols-2">
          {SEGMENT_PROOF_SECTION.tiles.map((tile) => (
            <div
              key={tile.id}
              className="rounded-card bg-card p-6 shadow-card sm:p-8"
            >
              <h3 className="mb-2 font-display text-xl tracking-display">{tile.title}</h3>
              <p className="mb-3 text-sm font-medium leading-relaxed text-foreground text-pretty">
                {tile.job}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{tile.proof}</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  )
}

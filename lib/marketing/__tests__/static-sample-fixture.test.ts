import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, it } from 'vitest'
import sharp from 'sharp'
import sampleBundle from '@/lib/marketing/sample-evidence-anchors.json'
import { calculateOverallScore } from '@/lib/audit/scoring'
import { originalFixture } from '@/lib/demo/fixtures/original'
import {
  getStaticSampleAudit,
  getStaticSampleObservationIds,
  LATEST_STATIC_SAMPLE_OBSERVATION_ID,
} from '@/lib/marketing/static-sample'

describe('static sample vs original fixture', () => {
  it('matches demo fixture headline in flag evidence', () => {
    const audit = getStaticSampleAudit()
    const messageFlag = audit.flags.find((f) => f.checkId === 'h1-generic')
    assert.ok(messageFlag)
    assert.ok(messageFlag.evidence?.includes(originalFixture.headline))
  })

  it('uses the demo fixture URL', () => {
    const audit = getStaticSampleAudit()
    assert.ok(audit.url.endsWith('/demo'))
  })

  it('includes at least seven flags', () => {
    const audit = getStaticSampleAudit()
    assert.ok(audit.flags.length >= 7)
  })

  it('resolves every history point to a complete immutable observation', () => {
    const ids = getStaticSampleObservationIds()
    const latest = getStaticSampleAudit()

    assert.equal(latest.id, LATEST_STATIC_SAMPLE_OBSERVATION_ID)
    assert.deepEqual(latest.scoreHistory?.map((point) => point.id), ids)

    for (const id of ids) {
      const audit = getStaticSampleAudit(id)
      const ownHistoryPoint = audit.scoreHistory?.find((point) => point.id === id)
      const rubricScores = Object.fromEntries(
        audit.rubricRows.map((row) => [row.name, row.score])
      )

      assert.equal(audit.id, id)
      assert.equal(audit.reportCompleteness, 'FULL')
      assert.ok(audit.flags.length >= 7)
      assert.equal(audit.rubricRows.length, 3)
      assert.equal(audit.screenshots.length, 2)
      assert.ok((audit.actionTimeline?.length ?? 0) >= 3)
      assert.equal(audit.score, calculateOverallScore(rubricScores))
      assert.equal(ownHistoryPoint?.score, audit.score)
      assert.equal(
        ownHistoryPoint?.href,
        `/samples?observation=${encodeURIComponent(id)}&view=report`
      )
    }

    const changed = getStaticSampleAudit('curated-sample-v0')
    const originalAnchors = structuredClone(
      (changed.performanceData as { evidenceAnchors?: Record<string, unknown> }).evidenceAnchors
    )
    changed.flags.splice(0)
    changed.actionTimeline?.splice(0)
    ;(changed.performanceData as { evidenceAnchors?: Record<string, unknown> }).evidenceAnchors = {
      invented: {},
    }

    const reloaded = getStaticSampleAudit('curated-sample-v0')
    assert.ok(reloaded.flags.length >= 7)
    assert.ok((reloaded.actionTimeline?.length ?? 0) >= 3)
    assert.deepEqual(
      (reloaded.performanceData as { evidenceAnchors?: Record<string, unknown> }).evidenceAnchors,
      originalAnchors
    )
  })

  it('publishes only the two curated states that have their own captures', () => {
    assert.deepEqual(getStaticSampleObservationIds(), [
      'curated-sample-v0',
      'curated-sample-v1',
    ])
    const [firstReview, updateReview] = getStaticSampleObservationIds().map((id) =>
      getStaticSampleAudit(id)
    )
    assert.notEqual(firstReview?.screenshots[0]?.url, updateReview?.screenshots[0]?.url)
    assert.notEqual(firstReview?.screenshots[1]?.url, updateReview?.screenshots[1]?.url)
    assert.ok((firstReview?.score ?? 100) < (updateReview?.score ?? 0))
  })

  it('binds every capture to real WebP bytes, dimensions, and a SHA-256', async () => {
    for (const [id, observation] of Object.entries(sampleBundle.observations)) {
      assert.match(observation.documentSha256, /^[a-f0-9]{64}$/)
      for (const [device, capture] of Object.entries(observation.captures)) {
        const bytes = await readFile(path.join(process.cwd(), 'public', capture.path))
        const metadata = await sharp(bytes).metadata()
        assert.equal(metadata.format, 'webp', `${id} ${device} must be a real WebP`)
        assert.equal(metadata.width, capture.width)
        assert.equal(metadata.height, capture.height)
        assert.equal(createHash('sha256').update(bytes).digest('hex'), capture.sha256)
      }
    }
  })

  it('rejects an explicit unknown observation instead of substituting another Review', () => {
    assert.throws(
      () => getStaticSampleAudit('not-published'),
      /Unknown curated sample observation: not-published/
    )
  })

  it('keeps observation identity, dates, score, flags, and Timeline coherent', () => {
    const observations = getStaticSampleObservationIds().map((id) =>
      getStaticSampleAudit(id)
    )

    for (const [index, audit] of observations.entries()) {
      assert.equal(audit.parentId, index === 0 ? null : observations[index - 1]?.id)
      assert.ok(audit.completedAt)
      assert.ok(audit.createdAt.getTime() < audit.completedAt.getTime())
      assert.ok(
        audit.actionTimeline?.every(
          (event) => event.url?.startsWith('https://fixflags.com/demo') ?? true
        )
      )
      assert.match(
        audit.intentionalNotes?.join(' ') ?? '',
        /versioned curated fixture/i
      )
    }
  })
})

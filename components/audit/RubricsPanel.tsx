'use client'

import { useState } from 'react'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { RubricSummaryGrid } from '@/components/audit/RubricSummaryGrid'
import { RubricCard } from '@/components/audit/RubricCard'
import type { RubricComputed } from '@/lib/audit/rubric'
import type { RankableFlag } from '@/lib/audit/priority-flags'

interface RubricRow {
  id: string
  name: string
  grade: string | null
  score: number | null
  status: string | null
  summary: string
  flags: RankableFlag[]
}

interface Props {
  rubrics: RubricComputed[]
  rubricRows: RubricRow[]
  showFeedback?: boolean
  aiLocked?: boolean
  signUpHref?: string
  showFlagList?: boolean
}

/** One rubric panel: summary tiles that expand the selected rubric's detail in place. */
export function RubricsPanel({
  rubrics,
  rubricRows,
  showFeedback = true,
  aiLocked = false,
  signUpHref,
  showFlagList = true,
}: Props) {
  const [openName, setOpenName] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <RubricSummaryGrid
        rubrics={rubrics}
        rubricRows={rubricRows}
        activeName={openName}
        onSelect={(name) => setOpenName((current) => (current === name ? null : name))}
      />

      {RUBRIC_ORDER.map((rubricName) => {
        if (rubricName !== openName) return null
        const rubric = rubrics.find((r) => r.name === rubricName)
        const rubricRow = rubricRows.find((r) => r.name === rubricName)
        if (!rubric || !rubricRow) return null
        return (
          <RubricCard
            key={rubric.name}
            rubric={rubric}
            rubricRow={rubricRow}
            showFeedback={showFeedback}
            aiLocked={aiLocked}
            signUpHref={signUpHref}
            showFlagList={showFlagList}
            open
            onOpenChange={() => setOpenName(null)}
          />
        )
      })}
    </div>
  )
}

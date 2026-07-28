'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { AdminInbox } from '@/components/admin/AdminInbox'
import { ReactionsList, type ReportReactionItem, type FlagReactionGroup } from '@/components/admin/ReactionsList'
import { FeedbackDigestPanel } from '@/components/admin/FeedbackDigestPanel'

type TabKey = 'conversations' | 'reactions' | 'digest'

interface Props {
  reactions: {
    reportSummary: { up: number; down: number; total: number }
    reportComments: ReportReactionItem[]
    flagGroups: FlagReactionGroup[]
  }
  reactionCount: number
  unread: number
}

export function FeedbackHub({ reactions, reactionCount, unread }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initial = searchParams.get('tab')
  const hasSession = Boolean(searchParams.get('session'))
  const [tab, setTab] = useState<TabKey>(
    hasSession
      ? 'conversations'
      : initial === 'reactions' || initial === 'digest'
        ? initial
        : 'conversations'
  )

  function onChange(next: string) {
    const value = next as TabKey
    setTab(value)
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    params.set('tab', value)
    router.replace(`/admin/feedback?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={tab} onValueChange={onChange}>
      <TabsList>
        <TabsTrigger value="conversations" className="gap-1.5">
          Conversations
          {unread > 0 && (
            <Badge variant="destructive" size="sm">
              {unread > 9 ? '9+' : unread}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="reactions" className="gap-1.5">
          Reactions
          {reactionCount > 0 && (
            <span className="text-3xs text-muted-foreground">{reactionCount}</span>
          )}
        </TabsTrigger>
        <TabsTrigger value="digest">Feedback digest</TabsTrigger>
      </TabsList>

      <TabsContent value="conversations" className="mt-4">
        <AdminInbox />
      </TabsContent>
      <TabsContent value="reactions" className="mt-4">
        <ReactionsList {...reactions} />
      </TabsContent>
      <TabsContent value="digest" className="mt-4">
        <FeedbackDigestPanel />
      </TabsContent>
    </Tabs>
  )
}

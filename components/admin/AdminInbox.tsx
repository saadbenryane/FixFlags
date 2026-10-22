"use client";

import { InteractiveButton } from '@/components/ui/interactive-controls'
import { SupportAssignment } from "./SupportAssignment";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "@/components/support/MessageBubble";
import { SupportComposer } from "./SupportComposer";
import { AdminActionButton } from "./AdminActionButton";
import type {
  SupportMessageDto,
  SupportSessionListItem,
} from "@/lib/live-support/types";
import { extractAuditIdFromPageUrl } from "@/lib/live-support/extract-audit-id";
const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load conversation data.");
  return response.json();
};
type Selected = SupportSessionListItem & {
  assignedAgentId: string | null;
  currentAdminId: string;
  assignee?: { name: string | null; email: string } | null;
};
function Conversation({
  session,
  onChanged,
}: {
  session: Selected;
  onChanged: () => void;
}) {
  const [messages, setMessages] = useState<SupportMessageDto[]>([]),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [olderBusy, setOlderBusy] = useState(false);
  const newest = useRef<string | null>(null),
    bottom = useRef<HTMLDivElement>(null);
  const read = useCallback(
    async (url: string, older = false) => {
      const data = (await fetcher(url)) as {
        messages: SupportMessageDto[];
        newest: string | null;
      };
      setMessages((prior) =>
        Array.from(
          new Map([...prior, ...data.messages].map((m) => [m.id, m])).values(),
        ).sort((a, b) => (BigInt(a.sequence) < BigInt(b.sequence) ? -1 : 1)),
      );
      if (!older && data.newest) {
        newest.current = data.newest;
        const result = await fetch(
          `/api/admin/support/sessions/${session.id}/messages`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ through: data.newest }),
          },
        );
        if (!result.ok) throw new Error("Read position could not be saved.");
        onChanged();
      }
    },
    [session.id, onChanged],
  );
  useEffect(() => {
    let live = true,
      busy = false;
    async function poll() {
      if (busy) return;
      busy = true;
      try {
        await read(
          `/api/admin/support/sessions/${session.id}/messages${newest.current ? "?after=" + newest.current : ""}`,
        );
        if (live) {
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (live) {
          setError(
            err instanceof Error ? err.message : "Could not load messages.",
          );
          setLoading(false);
        }
      } finally {
        busy = false;
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), 2000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [session.id, read]);
  useEffect(() => {
    if (messages.length)
      bottom.current?.scrollIntoView({ behavior: "auto", block: "nearest" });
  }, [messages.length]);
  async function older() {
    if (!messages[0]) return;
    setOlderBusy(true);
    try {
      await read(
        `/api/admin/support/sessions/${session.id}/messages?before=${messages[0].sequence}`,
        true,
      );
    } catch {
      setError("Could not load earlier messages.");
    } finally {
      setOlderBusy(false);
    }
  }
  const auditId = extractAuditIdFromPageUrl(session.pageUrl);
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div>
          <h2 className="font-semibold break-all">
            {session.visitorEmail ?? session.user?.email ?? "Visitor"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {session.status} ·{" "}
            {session.assignedAgentId
              ? session.assignedAgentId === session.currentAdminId
                ? "Assigned to you"
                : `Assigned to ${session.assignee?.name ?? session.assignee?.email ?? "administrator"}`
              : "Unassigned"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminActionButton
            action="SUPPORT_STATUS"
            targetId={session.id}
            input={{ status: session.status === "CLOSED" ? "OPEN" : "CLOSED" }}
            label={session.status === "CLOSED" ? "Reopen" : "Close"}
            onCompleted={onChanged}
          />
          <AdminActionButton
            action="SUPPORT_ASSIGN"
            targetId={session.id}
            input={{ assigneeId: session.currentAdminId }}
            label="Assign to me"
            onCompleted={onChanged}
          />
          <AdminActionButton
            action="SUPPORT_ASSIGN"
            targetId={session.id}
            input={{ assigneeId: null }}
            label="Unassign"
            onCompleted={onChanged}
          />
        </div>
      </div>
      <SupportAssignment sessionId={session.id} onChanged={onChanged} />
      <div
        className="max-h-[32rem] space-y-3 overflow-y-auto p-4"
        aria-label="Conversation messages"
      >
        {messages[0] && BigInt(messages[0].sequence) > BigInt(1) && (
          <Button
            variant="ghost"
            disabled={olderBusy}
            onClick={() => void older()}
          >
            Load earlier messages
          </Button>
        )}
        {loading && <p role="status">Loading messages…</p>}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {messages.map((message) =>
          message.role === "SYSTEM" ? (
            <p
              key={message.id}
              className="text-center text-xs text-muted-foreground"
            >
              {message.body}
            </p>
          ) : (
            <MessageBubble
              key={message.id}
              variant={message.role === "AGENT" ? "agent" : "visitor"}
            >
              {message.body}
            </MessageBubble>
          ),
        )}
        <div ref={bottom} />
      </div>
      {session.status !== "CLOSED" && (
        <SupportComposer sessionId={session.id} onSent={onChanged} />
      )}
      <div className="flex flex-wrap gap-4 p-4 text-sm">
        {session.project && (
          <Link
            href={`/admin/sites/${session.project.id}`}
            className="underline"
          >
            Open Site
          </Link>
        )}
        {auditId && (
          <Link href={`/admin/audits/${auditId}`} className="underline">
            Open check
          </Link>
        )}
        {session.lead && (
          <Link
            href={`/admin/leads/${encodeURIComponent(session.lead.normalizedDomain)}`}
            className="underline"
          >
            Open lead
          </Link>
        )}
      </div>
    </div>
  );
}
export function AdminInbox() {
  const params = useSearchParams(),
    [selectedId, setSelectedId] = useState<string | null>(
      params.get("session"),
    ),
    [filter, setFilter] = useState("open"),
    [page, setPage] = useState(1);
  const listed = useSWR<{
    sessions: SupportSessionListItem[];
    hasNext: boolean;
  }>(`/api/admin/support/sessions?filter=${filter}&page=${page}`, fetcher, {
    refreshInterval: 5000,
  });
  const selected = useSWR<{ session: Selected }>(
    selectedId ? `/api/admin/support/sessions/${selectedId}` : null,
    fetcher,
    { refreshInterval: 5000 },
  );
  const mutateSelected = selected.mutate,
    mutateListed = listed.mutate;
  const changed = useCallback(() => {
    void mutateSelected();
    void mutateListed();
  }, [mutateSelected, mutateListed]);
  useEffect(() => {
    if (params.get("session")) setSelectedId(params.get("session"));
  }, [params]);
  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-3 rounded-card bg-muted/30 p-3">
        <div className="flex flex-wrap gap-1">
          {["open", "closed", "all"].map((value) => (
            <Button
              key={value}
              size="sm"
              variant={value === filter ? "default" : "ghost"}
              onClick={() => {
                setFilter(value);
                setPage(1);
              }}
            >
              {value}
            </Button>
          ))}
        </div>
        {listed.isLoading && (
          <p role="status" className="p-3 text-sm">
            Loading conversations…
          </p>
        )}
        {listed.error && (
          <p role="alert" className="p-3 text-sm text-destructive">
            Could not load conversations.{" "}
            <Button variant="link" onClick={() => void listed.mutate()}>
              Retry
            </Button>
          </p>
        )}
        {listed.data?.sessions.map((session) => (
          <InteractiveButton
            type="button"
            key={session.id}
            aria-pressed={selectedId === session.id}
            onClick={() => setSelectedId(session.id)}
            className={`block w-full rounded-lg p-3 text-left ${selectedId === session.id ? "bg-muted" : "hover:bg-muted/60"}`}
          >
            <span className="block truncate text-sm font-medium">
              {session.visitorEmail ?? session.user?.email ?? "Visitor"}
            </span>
            <span className="text-xs text-muted-foreground">
              {session.status}
              {session.unreadByAgent > 0
                ? ` · ${session.unreadByAgent} unread`
                : ""}
            </span>
          </InteractiveButton>
        ))}
        {listed.data?.sessions.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">
            No conversations in this view.
          </p>
        )}
        <div className="flex gap-2">
          {page > 1 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
          )}
          {listed.data?.hasNext && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          )}
        </div>
      </aside>
      <section className="min-w-0 rounded-card bg-muted/20">
        {selected.error && !selected.data ? (
          <p role="alert" className="p-4 text-sm text-destructive">
            Could not load this conversation.{" "}
            <Button variant="link" onClick={() => void selected.mutate()}>
              Retry
            </Button>
          </p>
        ) : selected.data ? (
          <>
            <p
              hidden={!selected.error}
              role="alert"
              className="p-4 text-sm text-destructive"
            >
              The conversation could not be refreshed. Your draft remains here.
            </p>{" "}
            <Conversation
              key={selectedId}
              session={selected.data.session}
              onChanged={changed}
            />
          </>
        ) : (
          <p className="p-8 text-sm text-muted-foreground">
            {selectedId ? "Loading conversation…" : "Select a conversation"}
          </p>
        )}
      </section>
    </div>
  );
}

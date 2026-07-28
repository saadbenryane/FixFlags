import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AuditInput } from "@/components/audit/AuditInput";
import { UsageMeter } from "@/components/dashboard/UsageMeter";
import { UpgradeButton } from "@/components/dashboard/UpgradeButton";
import { ProjectsPanel } from "@/components/dashboard/ProjectsPanel";
import { DashboardCheckoutToast } from "@/components/dashboard/DashboardCheckoutToast";
import { ContextualUpgradeCard } from "@/components/billing/ContextualUpgradeCard";
import { FirstAuditPrompt } from "@/components/dashboard/FirstAuditPrompt";
import { McpDashboardCard } from "@/components/dashboard/McpDashboardCard";
import { RecentChecksList } from "@/components/dashboard/RecentChecksList";
import { DashboardReleaseHub } from "@/components/dashboard/DashboardReleaseHub";

import { Container } from "@/components/ui/container";
import { Surface } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionTitle } from "@/components/ui/typography";
import {
  getEffectiveScanLimit,
  getPendingCheckCount,
  isDevUnlimitedScans,
  isUnlimitedScanLimit,
} from "@/lib/auth/permissions";
import { planLabel } from "@/lib/billing/plans";
import {
  hasRevokedSubscriptionStatus,
} from "@/lib/auth/entitlements";
import { isAtCheckLimit } from "@/lib/audit/usage";
import { getAppViewer } from "@/lib/auth/app-viewer";
import { getEntitlements } from "@/lib/auth/entitlements";
import { projectLimitForPlan } from "@/lib/billing/plans";
import { loadFinishPlanFlags } from "@/lib/audit/load-finish-plan-flags";
import { buildLiveExplorerModel } from "@/lib/report/explorer-model";
import { buildDashboardWorkspaceModel } from "@/lib/report/workspace-adapters";
import { parseProductContract } from "@/lib/audit/product-contract";

type DashboardSearchParams = {
  url?: string | string[];
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<DashboardSearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const initialAuditUrl = typeof params.url === "string" ? params.url : "";
  const viewer = await getAppViewer();
  if (!viewer) redirect("/sign-in");
  const { user } = viewer;
  const userId = user.id;

  const PAGE_SIZE = 20;
  const projectLimit = projectLimitForPlan(user.plan);
  const [auditBatch, pending, auditCounts, projects, completedHistoryRows] = await Promise.all([
    prisma.audit.findMany({
      where: { userId, parentId: null },
      select: {
        id: true,
        url: true,
        status: true,
        score: true,
        createdAt: true,
        rubrics: {
          select: {
            name: true,
            grade: true,
            score: true,
            flags: { select: { severity: true } },
          },
        },
        monitoringAudits: {
          where: { status: "COMPLETED" },
          select: { id: true, score: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
    }),
    getPendingCheckCount(userId),
    prisma.audit.groupBy({
      by: ["source"],
      where: { userId },
      _count: true,
    }),
    projectLimit > 0
      ? prisma.project.findMany({
          where: { userId, isManaged: true },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            name: true,
            url: true,
            _count: { select: { audits: true } },
          },
        })
      : Promise.resolve([]),
    prisma.audit.findMany({
      where: { userId, status: "COMPLETED" },
      select: {
        id: true,
        parentId: true,
        score: true,
        createdAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);
  const initialHasMore = auditBatch.length > PAGE_SIZE;
  const audits = initialHasMore ? auditBatch.slice(0, PAGE_SIZE) : auditBatch;

  const completedAudits = audits.filter(
    (audit) => audit.status === "COMPLETED",
  );
  const latestCompleted = completedAudits[0] ?? null;
  const releaseAuditIds = new Set<string>();
  if (latestCompleted) {
    releaseAuditIds.add(latestCompleted.id);
    let changed = true;
    while (changed) {
      changed = false;
      for (const audit of completedHistoryRows) {
        if (
          audit.parentId &&
          releaseAuditIds.has(audit.parentId) &&
          !releaseAuditIds.has(audit.id)
        ) {
          releaseAuditIds.add(audit.id);
          changed = true;
        }
      }
    }
  }
  const releaseAudits = completedHistoryRows
    .filter((audit) => releaseAuditIds.has(audit.id))
    .sort(
      (left, right) =>
        (left.completedAt ?? left.createdAt).getTime() -
        (right.completedAt ?? right.createdAt).getTime(),
    );
  const releaseHistory = releaseAudits.filter((audit) => audit.score !== null);
  const currentReleaseId =
    releaseAudits[releaseAudits.length - 1]?.id ?? latestCompleted?.id ?? null;
  const currentRelease = currentReleaseId
    ? await prisma.audit.findUnique({
        where: { id: currentReleaseId },
        select: {
          id: true,
          url: true,
          pageType: true,
          verdict: true,
          score: true,
          completedAt: true,
          createdAt: true,
          launchReadinessState: true,
          productContract: true,
          screenshots: {
            select: {
              device: true,
              url: true,
              width: true,
              height: true,
            },
          },
          rubrics: {
            select: {
              name: true,
              grade: true,
              score: true,
              flags: { select: { severity: true } },
            },
          },
          flags: {
            select: {
              id: true,
              checkId: true,
              rubric: true,
              severity: true,
              impactTag: true,
              problem: true,
              evidence: true,
              whyItMatters: true,
              fix: true,
              agentPrompt: true,
              cursorPrompt: true,
              claudePrompt: true,
              windsurfPrompt: true,
              lovablePrompt: true,
              boltPrompt: true,
              verificationRule: true,
              pageUrl: true,
              confidence: true,
              source: true,
              status: true,
            },
          },
        },
      })
    : null;

  const used = user.auditsUsed;
  const isUnlimited =
    isDevUnlimitedScans() || isUnlimitedScanLimit(getEffectiveScanLimit(user));
  const effectiveLimit = isUnlimited ? null : getEffectiveScanLimit(user);
  // A revoked subscription (payment failure, cancellation) leaves the user effectively on the
  // free tier even though `plan` hasn't been resynced yet - treat them the same as FREE here so
  // the upgrade nudges aren't hidden from someone who actually needs to see them.
  const isEffectivelyFree =
    user.plan === "FREE" ||
    hasRevokedSubscriptionStatus(user.subscriptionStatus);
  const atAuditLimit =
    isEffectivelyFree &&
    !isUnlimited &&
    effectiveLimit !== null &&
    isAtCheckLimit(used, pending, effectiveLimit);

  const entitlements = getEntitlements(user);

  const totalCritical = completedAudits.reduce(
    (sum, a) =>
      sum +
      a.rubrics.reduce(
        (s, r) => s + r.flags.filter((f) => f.severity === "CRITICAL").length,
        0,
      ),
    0,
  );
  const releaseWorkspace = currentRelease
    ? await (async () => {
        const productContract = parseProductContract(currentRelease.productContract);
        const flags = await loadFinishPlanFlags({
          userId,
          auditUrl: currentRelease.url,
          flags: currentRelease.flags,
        });
        const rubricRows = currentRelease.rubrics.map((rubric) => ({
          name: rubric.name,
          grade: rubric.grade,
          score: rubric.score,
        }));
        const explorer = buildLiveExplorerModel({
          url: currentRelease.url,
          pageType: currentRelease.pageType,
          score: currentRelease.score,
          verdict: currentRelease.verdict,
          flags,
          screenshots: currentRelease.screenshots,
          rubricRows,
          productContract,
          promptAccess: "none",
        });
        return buildDashboardWorkspaceModel({
          explorer,
          auditId: currentRelease.id,
          url: currentRelease.url,
          pageType: currentRelease.pageType,
          checkedAt: currentRelease.completedAt ?? currentRelease.createdAt,
          history: releaseHistory.map((audit) => ({
            id: audit.id,
            score: audit.score!,
            checkedAt: audit.completedAt ?? audit.createdAt,
          })),
        });
      })()
    : null;
  const mcpAudits = auditCounts.find((a) => a.source === "MCP")?._count ?? 0;
  const webAudits = auditCounts.find((a) => a.source !== "MCP")?._count ?? 0;

  return (
    <Container
      variant="report"
      className="space-y-5 px-4 py-5 pb-24 sm:space-y-6 sm:px-6 sm:py-7 sm:pb-24 lg:px-0"
    >
      <Suspense fallback={null}>
        <DashboardCheckoutToast />
      </Suspense>

      <PageHeader
        title="Dashboard"
        description="Review what changed, copy the right fix, then Re-check."
        className="flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          {!isEffectivelyFree && (
            <Badge
              variant="outline"
              className="text-success border-success/30 bg-success/5 text-xs gap-1.5"
            >
              {planLabel(user.plan)}
            </Badge>
          )}
          {isEffectivelyFree && !isUnlimited && (
            <UpgradeButton
              context="free_default"
              userEmail={user.email ?? undefined}
            />
          )}
        </div>
      </PageHeader>

      {releaseWorkspace ? <DashboardReleaseHub model={releaseWorkspace} /> : null}

      {/* Primary action: start a new Check after orienting to current release health. */}
      <Surface variant="elevated" className="sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Review a URL</SectionTitle>
          {completedAudits.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {completedAudits.length} check
              {completedAudits.length !== 1 ? "s" : ""}
              {totalCritical > 0 && (
                <span className="ml-2 text-destructive">
                  {totalCritical} critical Flag{totalCritical !== 1 ? "s" : ""}
                </span>
              )}
            </span>
          )}
        </div>
        <AuditInput
          initialUrl={initialAuditUrl}
          autoStart={Boolean(initialAuditUrl)}
          idSuffix="-dashboard"
        />
      </Surface>

      {atAuditLimit && (
        <ContextualUpgradeCard
          moment="audit_limit_reached"
          isLoggedIn
          currentPlan="FREE"
          userEmail={user.email ?? undefined}
        />
      )}

      {/* Usage + MCP summary row: defer MCP upsell until the user has a check */}
      <div
        className={
          audits.length > 0 ? "grid gap-4 sm:grid-cols-2" : "grid gap-4"
        }
      >
        <UsageMeter
          used={used}
          limit={isUnlimited ? null : effectiveLimit}
          pending={pending}
          plan={user.plan}
        />
        {audits.length > 0 ? (
          <McpDashboardCard
            mcpAudits={mcpAudits}
            webAudits={webAudits}
            canUseMcp={entitlements.canUseMcp}
            primaryTool={user.preferredTools[0]}
          />
        ) : null}
      </div>

      {audits.length === 0 ? (
        <FirstAuditPrompt />
      ) : (
        <div className="space-y-6">
          <RecentChecksList
            audits={audits}
            initialHasMore={initialHasMore}
          />
          <ProjectsPanel
            plan={user.plan}
            initialProjects={projects.map((project) => ({
              id: project.id,
              name: project.name,
              url: project.url,
              auditCount: project._count.audits,
            }))}
          />
        </div>
      )}
    </Container>
  );
}

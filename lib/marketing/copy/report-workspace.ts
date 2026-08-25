export const REPORT_COPY = {
  workspace: {
    heading: "Your review",
    identityFallback: "Website review",
    status: {
      checking: "Checking",
      completed: "Completed",
      partial: "Partial",
      degraded: "Degraded",
      failed: "Failed",
      unavailable: "Unavailable",
    },
    checkingScope: "Flags appear as they are confirmed.",
    checkingProgress: (percent: number, detail: string) =>
      `${percent}% · ${detail}`,
    flagsFoundSoFar: (count: number) =>
      `${count} ${count === 1 ? "Flag" : "Flags"} found so far`,
    scan: {
      working: "Working",
      stepOf: (current: number, total: number) => `Step ${current} of ${total}`,
      progressLabel: "Live progress",
    },
    context: ({
      unresolved,
      checkedScope,
    }: {
      unresolved: number;
      checkedScope: string | null;
    }) => {
      const unresolvedLabel = `${unresolved} unresolved ${unresolved === 1 ? "Flag" : "Flags"}`;
      if (!checkedScope) return `${unresolvedLabel}.`;
      if (/^\d+ pages$/.test(checkedScope)) {
        return `${unresolvedLabel} across ${checkedScope}.`;
      }
      const preposition = checkedScope.includes("release") ? "in" : "on";
      return `${unresolvedLabel} ${preposition} ${checkedScope}.`;
    },
    summaryLabel: "Review score and history",
    scoreLabel: "Score",
    scorePending: "pending",
    scoreUnavailable: "unavailable",
    dashboard: {
      title: "Products",
      attentionTitle: "Attention now",
      attentionBody:
        "The highest-leverage improvements FixFlags can support with current evidence.",
      noAttention: "Nothing important requires action now.",
      noAttentionBody:
        "FixFlags will keep the complete evidence available and look again on the next Review.",
      keepWatching: "Keep FixFlags watching",
      addProductContext: "Add product context",
      productContextBody:
        "Add a small privacy-bounded browser snippet after FixFlags has reviewed the Product.",
      productContextReady:
        "Install this once on the reviewed origin. The write key is shown only now.",
      copySnippet: "Copy snippet",
      observedContext: "Observed product context",
      verificationPending: "Run an update review for independent verification.",
      historyTitle: "Improvement history",
      latestRelease: "Latest completed release",
      openReport: "Open report",
      topFlags: "Top ranked Flags",
      total: (count: number) => `${count} total`,
      nextActionLabel: "Next action",
      nextActionBody:
        "Open a Flag, copy its fix, publish the change, then run an update review.",
      clearReleaseBody:
        "No unresolved Flags remain. Open the report to verify the release details.",
      reviewTopFlag: "Review the top Flag",
      reviewClearRelease: "Review the release",
      rechecks: (count: number) =>
        `${count} completed ${count === 1 ? "update review" : "update reviews"}`,
      pageDescription:
        "See what deserves attention, improve it, and verify whether it worked.",
    },
    unavailableState: {
      identity: "FixFlags report",
      identityBody: "Report details are not available",
      summaryValue: "Unavailable",
      privateTitle: "Report unavailable",
      privateBody:
        "This report does not exist or is no longer available.",
      sharedTitle: "This shared report is unavailable",
      sharedBody:
        "The link may have expired, been revoked, or no longer be eligible for sharing. Ask the owner for a new link.",
      returnHome: "Return home",
      reviewSite: "Review my product",
    },
    chat: {
      title: "Agent",
      placeholder: "Ask about this report",
      empty: "Ask what to fix first, or about a Flag on this report.",
      send: "Send",
      unavailable: "Could not reach FixFlags chat right now.",
      notConfigured:
        "Live chat is off for this review. Use a quick prompt below for an instant answer, or open a Flag in the fix list for its evidence and fix prompt.",
      replyFallback:
        "I could not generate a reply. Try asking about a specific Flag.",
      notSignedIn: "Sign in to chat",
      notOwner: "You can only chat on your own reports",
      notFound: "Report not found",
      messageRequired: "Message required",
      cannedExplain: "Explain this Flag",
      cannedFirst: "What should I fix first?",
      cannedHint:
        "Quick prompts give instant answers while live chat is off. Open a Flag in the fix list for its evidence and fix prompt.",
      capReached: (cap: number) =>
        `Free-form chat is capped at ${cap} replies for this review. Open a Flag in the fix list for its evidence and fix prompt, or use the quick prompts below.`,
      historyLabel: "Review history",
      historyTooltip: "History",
      historyDescription: "Return to an earlier product review.",
      historyEmpty: "Your completed and active reviews will appear here.",
      historyError: "Could not load review history.",
      historyMore: "Load more",
      currentScan: "Current review",
      currentSession: "Current browser session",
      saveHistory: "Sign in to save this review and see your review history.",
      signIn: "Sign in",
      newScan: "New review",
      newScanInstruction: "Paste the page you want me to review.",
      preparing: "I’m preparing this review.",
      loadingConversation: "Loading this conversation…",
      startPlaceholder: "Paste a URL to review",
      startLabel: "URL to review",
      startAction: "Start review",
      startError: "Could not start this review. Check the URL and try again.",
      returnToReport: "Back to this report",
      authBody: "Sign in to ask about the Flags and fixes in this report.",
      retry: "Try again",
      allowanceBody:
        "You’ve used this month’s Agent allowance. Your report and review updates remain available.",
      allowanceAction: "Upgrade to continue",
      viewFlag: "View Flag",
      productReview: "Product review",
      updateReview: "Update review",
    },
    playback: {
      label: "Path playback",
      scrubLabel: "Scrub through the review path",
      counter: (current: number, total: number) => `${current}/${total}`,
      stepNumber: (index: number) => `Step ${index}`,
      evidenceTitle: (index: number) => `Step ${index} evidence`,
      closeEvidence: "Close evidence",
      backToLive: "Back to live",
      noScreenshot: "No screenshot was captured for this step.",
      empty: (url: string) =>
        `Browser evidence appears here as FixFlags captures ${url}.`,
      /** Docked transport under the Product stage. */
      transportLabel: "Preview controls",
      liveCapture: "Live capture",
      capturing: "Capturing the page",
      noSteps:
        "Path replay appears when this Product Review captures a multi-step path",
    },
    panels: {
      chatTab: "Agent",
      productTab: "Report",
      productReality: "Product",
      deviceToggleLabel: "Viewport",
      desktopDevice: "Desktop",
      mobileDevice: "Mobile",
      inspectFindings: (count: number) =>
        `Inspect ${count} ${count === 1 ? "Flag" : "Flags"}`,
      browserView: "Timeline",
      reportView: "Report",
      canvasView: "Canvas",
      previewView: "Preview",
      previewTab: "Preview",
      toggleLabel: "Workspace view",
      mobileTabsLabel: "Review panels",
    },
    canvas: {
      title: "Visual Canvas",
      emptyTitle: "Create a Canvas from this report",
      emptyBody:
        "Turn recorded scores, Flags, and evidence into a private visual brief you can revise without losing earlier versions.",
      titlePlaceholder: "Canvas title",
      instructionPlaceholder: "What should this Canvas emphasize?",
      create: "Create Canvas",
      revisePlaceholder: "Describe the next revision",
      revise: "Create revision",
      versions: "Versions",
      restore: (version: number) => `Restore version ${version}`,
      loading: "Loading Canvas…",
      loadFailed: "Could not load this Canvas. Try again.",
      saveFailed: "Could not update this Canvas. Try again.",
      retry: "Try again",
      source: "View source",
      score: "Release score",
      scoreUnavailable: "Not scored",
      lockedTitle: "Turn this report into a visual Canvas",
      lockedBody:
        "Sign in to create private, evidence-grounded visual reports with version history.",
      upgrade: "Sign in to create a Canvas",
      start: "Create a Canvas from this report.",
    },
    timelineGate: {
      title: "See how FixFlags checked the path",
      body: "Sign in to inspect the captured Timeline and replay the evidence behind this report.",
      action: "Sign in to view Timeline",
    },
    journeyRunDeepReview: "Review this path again",
    funnelReplayPath: "Replay path",
    funnelLabel: "Funnel",
  },
  reportFirst: {
    loadingLabel: "Loading report",
    loadingTitle: "Loading report…",
    preparingReport: "Preparing your report while the review runs.",
    capturesTitle: "Page captures",
    capturesBody: "Desktop and mobile views resolve independently.",
    capturesLabel: "Desktop and mobile captures",
    summaryLabel: "Report summary",
    checkingLabel: "Checking",
    unavailableLabel: "Unavailable",
    statusPendingLabel: "Status pending",
    affectedViewport: (device: "desktop" | "mobile") => `Flagged on ${device}`,
    unaffectedViewport: "Not detected for this Flag",
    unmeasuredElement: "Exact element was not pinned on this capture",
    pageScopeEvidence: "This issue is not a visible element on the page",
  },
  lovableBolt: {
    heroTitle: "Paste this into Lovable or Bolt",
    heroBody:
      "One click copies a fix prompt tuned for your builder. Publish the change, then run an update review here.",
    defaultToolHint:
      "Choose your builder, copy the fix, paste it into your AI editor.",
  },
  sampleFocused: {
    eyebrow: "Sample fix list",
    title: "See what FixFlags found",
    body: "A reviewed DemoSite report with real evidence and one complete fix prompt.",
    detailsCta: "View the sample report",
  },
  progressive: {
    eyebrow: "Fix list",
    preparingFixList: "Preparing your fix list…",
  },
  recheck: {
    label: "Update review",
    helper: "See if these Flags are still open.",
    error: "Could not start the update review. Try again.",
  },
  keepReport: {
    title: "Email me this report",
    helper: "Send the link.",
    emailLabel: "Email",
    emailPlaceholder: "you@company.com",
    action: "Email me this report",
    saving: "Sending",
    saved: "We emailed you the report link.",
    error: "Could not send that email. Try again.",
  },
  launchGates: {
    title: "Launch gates",
    body: "Five concrete checks from your report evidence. Fix any failed gates before you publish.",
  },
  recheckHint: {
    title: "Next: verify the published change",
    bodyPrefix:
      "Paste the fix prompts into your editor, publish the changes, then select",
    bodySuffix:
      "above to get an independent result for each attempted Improvement.",
  },
  verificationReceipts: {
    title: "Independent verification",
    body: "Each receipt comes from a fresh completed update review and shows the evidence, coverage, and remaining risk.",
    countLabel: (count: number) =>
      `${count} ${count === 1 ? "verification receipt" : "verification receipts"}`,
    outcomes: {
      IMPROVED: "Improved",
      UNCHANGED: "Unchanged",
      REGRESSED: "Regressed",
      INCONCLUSIVE: "Inconclusive",
    },
    improvedBody: "Independently verified by this update review.",
    noLongerObserved: "No longer observed in this review.",
    coverageLabel: "Coverage",
    evidenceLabel: "Evidence",
    remainingRiskLabel: "Remaining risk",
    openReview: "Open update review",
  },
  sampleCta: {
    title: "Run the same check on your site",
    body: "Paste a URL. See Flags across three rubrics. Sign up for fix prompts you can paste into your editor.",
  },
  noFlags: {
    title: "No flags found",
    body: "This check found no Flags.",
  },
  aiPending: {
    title: "Fix prompts generating",
    body: "Generating fix prompts for every flag. This usually takes under a minute.",
    stillPendingTitle: "Fix prompts still generating",
    stillPendingBody:
      "This is taking longer than usual. Refresh the page, or check back in a minute.",
    refreshCta: "Refresh",
  },
  prescriptionUnavailable: {
    title: "Fix prompts unavailable",
  },
  triageUnavailable: {
    title: "AI summary unavailable",
    signupCta: "Sign up to retry",
    retryCta: "Retry AI summary",
  },
  partialReport: {
    title: "Partial report",
    body: "Some optional evidence was unavailable. Unassessed rubrics are left unmeasured rather than inferred.",
  },
  failedChecks: {
    title: "Some checks could not run",
    body: (modules: string[]) => {
      const label =
        modules.length === 1
          ? `The ${modules[0]} check`
          : `${modules.join(", ")} checks`;
      return `${label} could not run, so some fixes may be missing from this report.`;
    },
  },
  captureLimited: {
    title: "Limited screenshots",
    body: "We could only capture a limited view of this page. Flags still reflect what we could verify.",
  },
  capturePartial: {
    title: "Partial screenshots",
    body: "Desktop or mobile capture was incomplete. Some visual evidence may be missing.",
  },
  pageSpeedPartial: {
    title: "PageSpeed partially available",
    body: (missingRoutes: Array<{ url: string; missing: string[] }>) => {
      const missing = missingRoutes
        .slice(0, 3)
        .map((route) => {
          let label = route.url;
          try {
            const parsed = new URL(route.url);
            label = parsed.pathname === "/" ? "homepage" : parsed.pathname;
          } catch {
            // Keep the stored route label.
          }
          return `${label} (${route.missing.join(" & ")})`;
        })
        .join(", ");
      return `PageSpeed evidence uses the observations captured in this run. Missing coverage: ${missing}.`;
    },
  },
  pageSpeedUnavailable: {
    title: "PageSpeed unavailable",
    body: "No PageSpeed observation completed in this run. Experience Flags use the other captured evidence.",
  },
  finishPlan: {
    title: "What to fix next",
    loadingBody: "Your Finish Plan will appear when the review is complete.",
    readyBody: (count: number) =>
      `${count} ${count === 1 ? "Flag" : "Flags"} ranked by impact. Review every confirmed Flag and its evidence.`,
    copyCta: "Copy Finish Plan",
    copyLabel: "Finish Plan prompt",
    previewToggle: "Preview prompt",
    generating: "Generating fix prompts for every Flag…",
    demonstratedNote:
      "Create a free account to get fix prompts for this report.",
  },
  sectionTitles: {
    allFixes: "All fixes",
    productContract: "Product contract",
    productContractHeading: "What this product appears to do",
    journey: "Funnel",
    flow: "CTA flow test",
    timelineCompleted: "How we checked",
    timelineProgressive: "How FixFlags is checking",
    timelineEmpty: "Review steps will appear as FixFlags checks the page.",
    madeWith: "Made with",
    previews: "Share & search previews",
    remember: "What we proved",
    rememberHint:
      "Only independently verified Improvements stay with this product across reviews.",
  },
  reviewContext: {
    title: "Review context",
    hint: "Stack, contract, funnel, previews, launch gates",
  },
  explorer: {
    fixPrompt: "Fix Prompt",
    allPages: "All Pages",
    noMatchFilter: "No flags match this filter.",
    checkingIssues: "Checking for Flags…",
    selectFlag: "Select a flag to see evidence and the fix prompt.",
    flagsAppear: "Flags appear here as the review finishes.",
    noFlagsNice: "No flags. Nice work.",
    moreChecks: "More checks",
  },
  runYourOwnAudit: "Check your site",
} as const;

export const MADE_WITH_COPY = {
  sectionLabel: "Technology profile",
  title: "Made with",
  checked: "Checked",
  viewEvidence: "View stack and evidence",
  verified: "Verified",
  strongSignal: "Strong signal",
  legacy:
    "Technology signals were not captured for this review. Run an update review to create a verified profile.",
  unavailable:
    "Technology signals were unavailable for this check. The rest of the report is unaffected.",
  empty: "No technologies could be verified from the site’s public signals.",
  partial:
    "Partial profile. Only signals preserved by the historical capture are shown.",
  changed: "Changed since the last update review",
  added: "Added",
  removed: "Removed",
  evidenceChanged: "Evidence changed",
  disclaimer:
    "FixFlags reads public page signals. The report score reflects the site outcome, not the quality of any individual tool.",
  insightWithRubric: (
    stack: string,
    rubric: string,
    score: number,
    flagCount: number,
  ) =>
    `On this ${stack} site, ${rubric} is the lowest-scoring rubric at ${score} with ${flagCount} unresolved ${flagCount === 1 ? "Flag" : "Flags"}.`,
  insightWithScore: (stack: string, score: number) =>
    `This ${stack} site scored ${score}. The score reflects the site outcome, not the tools themselves.`,
  insightCount: (count: number) =>
    `FixFlags verified ${count} public ${count === 1 ? "technology" : "technologies"} on this site.`,
  publicProfileLabel: "Public technology profile",
  publicProfileLead:
    "Public page signals, checked by the same capture that produced this site’s FixFlags report.",
  latestPublicReport: "Latest public report",
  completed: "Completed",
  openPublicReport: "Open the public report",
  relatedProfiles: "Related public profiles",
  ownSitePrompt: "Check your own site’s stack, score, evidence, and fix list.",
  checkAgain: "Run a product review on this site again",
  metaTitle: (hostname: string, technologies: string[]) =>
    `${hostname} is made with ${technologies.slice(0, 3).join(", ")} | FixFlags`,
  metaDescription: (hostname: string) =>
    `Verified public technology signals for ${hostname}, connected to its latest FixFlags score and unresolved Flags.`,
  reportSummary: (score: number | null, flagCount: number) =>
    score === null
      ? `${flagCount} unresolved ${flagCount === 1 ? "Flag" : "Flags"}`
      : `${flagCount} ${flagCount === 1 ? "Flag" : "Flags"}`,
} as const;

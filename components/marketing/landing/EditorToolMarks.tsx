import type { ReactNode } from "react";
import {
  getEditorMark,
  type EditorMarkName,
} from "@/components/brand/EditorMarks";
import { LANDING_PAGE } from "@/lib/marketing/copy";
import { HOMEPAGE_EDITOR_INTEGRATIONS } from "@/lib/integrations/editor-catalog";
import { cn } from "@/lib/utils";

type ToolLogoName = (typeof HOMEPAGE_EDITOR_INTEGRATIONS)[number]["label"];

const LOGO_MARKS: Record<ToolLogoName, ReactNode> = Object.fromEntries(
  HOMEPAGE_EDITOR_INTEGRATIONS.map(({ label }) => [
    label,
    getEditorMark(label as EditorMarkName),
  ]),
) as Record<ToolLogoName, ReactNode>;

interface EditorToolMarksProps {
  className?: string;
  compact?: boolean;
  label?: string;
  /**
   * Homepage hero logo strip: mono label, equal marks, nowrap at lg+.
   * Prefer this over long Tailwind override soup on the call site.
   */
  variant?: "default" | "hero";
  /** When false, hide the logoCloud label (section header already names the tools). */
  showLabel?: boolean;
  /** Use compact display names when marks sit inside a tight integration grid. */
  shortLabels?: boolean;
}

export function EditorToolMarks({
  className,
  compact = false,
  label: labelOverride,
  variant = "default",
  showLabel = true,
  shortLabels = false,
}: EditorToolMarksProps) {
  const { label: defaultLabel, disclaimer } = LANDING_PAGE.logoCloud;
  const label = labelOverride ?? defaultLabel;
  const logos = HOMEPAGE_EDITOR_INTEGRATIONS.map((editor) => editor.label);
  const isHero = variant === "hero";

  return (
    <div className={cn(isHero ? "space-y-2.5" : "space-y-3", className)}>
      {showLabel ? (
        <p
          className={cn(
            isHero
              ? "font-mono text-xs font-medium uppercase tracking-label text-muted-foreground"
              : "text-sm font-medium text-muted-foreground",
          )}
        >
          {label}
        </p>
      ) : null}
      <ul
        className={cn(
          "flex flex-wrap items-center",
          isHero
            ? "justify-start gap-x-4 gap-y-2 lg:flex-nowrap"
            : compact
              ? "gap-x-5 gap-y-2.5"
              : "gap-x-6 gap-y-3 sm:gap-x-8",
        )}
      >
        {logos.map((name) => (
          <li
            key={name}
            className={cn(
              "flex items-center gap-1.5 font-semibold tracking-heading",
              isHero
                ? "text-xs tracking-normal text-foreground/75 [&_svg]:h-5 [&_svg]:w-5 [&_svg]:opacity-95"
                : "gap-2 text-sm text-foreground/65 [&_svg]:h-5 [&_svg]:w-5",
            )}
          >
            {LOGO_MARKS[name]}
            {shortLabels && name === "Claude Code" ? "Claude" : name}
          </li>
        ))}
      </ul>
      {disclaimer ? (
        <p className="text-2xs text-muted-foreground/70">{disclaimer}</p>
      ) : null}
    </div>
  );
}

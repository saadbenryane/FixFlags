import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface ArticleCTAProps {
  headline: string
  body: string
  buttonLabel: string
  buttonHref: string
  className?: string
}

export function ArticleCTA({
  headline,
  body,
  buttonLabel,
  buttonHref,
  className,
}: ArticleCTAProps) {
  return (
    <div className={cn("surface-card p-6 sm:p-8 mt-12 my-12", className)}>
      <h3 className="text-xl font-medium">{headline}</h3>
      <p className="mt-2 text-muted-foreground">{body}</p>
      <Button asChild className="mt-4">
        <Link href={buttonHref}>{buttonLabel}</Link>
      </Button>
    </div>
  )
}

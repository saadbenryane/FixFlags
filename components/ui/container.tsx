import * as React from "react"
import { cn } from "@/lib/utils"

export type ContainerProps = React.HTMLAttributes<HTMLDivElement>

export function Container({ className, ...props }: ContainerProps) {
  return <div className={cn("container mx-auto max-w-screen-xl", className)} {...props} />
}

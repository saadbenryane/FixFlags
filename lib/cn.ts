import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Lightweight className helper - keep Lucide / rubric helpers out of this module. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

'use client'

import { Button } from '@/components/ui/button'

interface CsvDownloadButtonProps {
  label: string
  filename: string
  /** Pre-built CSV string (built server-side by the pure functions). */
  csv: string
}

/**
 * Admin CSV export button. The CSV content is generated server-side and passed
 * in; the client just triggers a same-document Blob download. Kept inside the
 * admin analytics folder so no new admin API route is needed.
 */
export function CsvDownloadButton({ label, filename, csv }: CsvDownloadButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
      }}
    >
      {label}
    </Button>
  )
}

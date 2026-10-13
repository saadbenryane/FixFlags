import { requireAdminPage } from '@/lib/auth/require-admin-page'
import { loadAdminEvidence } from '@/lib/admin/evidence'
import { AdminPageFrame, AdminSurface } from '@/components/admin/AdminPageFrame'
import { adminDate } from '@/lib/admin/format'
export default async function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdminPage()
  const { id } = await params,
    { audit, expiresAt } = await loadAdminEvidence(actor, id)
  return (
    <AdminPageFrame
      title="Private evidence"
      description={`Session access expires ${adminDate(expiresAt)}.`}
    >
      <AdminSurface title="Admitted scope">
        <pre className="overflow-auto whitespace-pre-wrap break-all text-xs">
          {JSON.stringify(audit.executionSpec, null, 2)}
        </pre>
        <a className="text-sm underline" href={`/api/admin/evidence/${id}`} download>
          Download redacted evidence
        </a>
      </AdminSurface>
      {audit.flags.map((flag) => (
        <AdminSurface key={flag.id} title={flag.problem}>
          <p className="text-sm">{flag.severity}</p>
          <p className="whitespace-pre-wrap text-sm">{flag.evidence}</p>
          <p className="text-sm text-muted-foreground">{flag.fix}</p>
        </AdminSurface>
      ))}
      <AdminSurface title="Captures">
        {audit.screenshots.map((s) => (
          <a
            key={s.id}
            href={`/api/admin/evidence/${id}/screenshots/${s.id}`}
            className="block py-2 text-sm underline"
            target="_blank"
            rel="noreferrer"
          >
            Open {s.device.toLowerCase()} capture
          </a>
        ))}
        {!audit.screenshots.length && (
          <p className="text-sm text-muted-foreground">No captures recorded.</p>
        )}
      </AdminSurface>
    </AdminPageFrame>
  )
}

import type { Doc } from '../../convex/_generated/dataModel'

const styles: Record<Doc<'stories'>['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
}

const labels: Record<Doc<'stories'>['status'], string> = {
  pending: 'Awaiting approval',
  approved: 'Published',
  rejected: 'Not approved',
}

export function StatusBadge({ status }: { status: Doc<'stories'>['status'] }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

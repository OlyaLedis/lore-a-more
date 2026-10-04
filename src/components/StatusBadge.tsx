import type { Doc } from '../../convex/_generated/dataModel'

const styles: Record<Doc<'stories'>['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
}

const labels: Record<Doc<'stories'>['status'], string> = {
  pending: 'Pending approval',
  approved: 'Published',
  rejected: 'Not approved',
}

const badge = 'whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium'

export function StatusBadge({ status }: { status: Doc<'stories'>['status'] }) {
  return <span className={`${badge} ${styles[status]}`}>{labels[status]}</span>
}

// The status of an author's edit to a published story.
export function RevisionBadge({ status }: { status: Doc<'storyRevisions'>['status'] | null }) {
  if (status === 'pending') return <span className={`${badge} ${styles.pending}`}>Edits pending approval</span>
  if (status === 'rejected') return <span className={`${badge} ${styles.rejected}`}>Edits not approved</span>
  return null
}

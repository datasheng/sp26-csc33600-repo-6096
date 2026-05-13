import type {
  BookingStatus, PaymentStatus, ReviewRequestStatus,
  JobPostingStatus, ApplicationStatus, EndorsementStatus,
} from '@/types'

type AnyStatus =
  | BookingStatus | PaymentStatus | ReviewRequestStatus
  | JobPostingStatus | ApplicationStatus | EndorsementStatus
  | 'verified' | 'unverified'

const MAP: Record<string, string> = {
  pending:     'bg-yellow-100 text-yellow-800',
  accepted:    'bg-blue-100 text-blue-800',
  approved:    'bg-green-100 text-green-800',
  open:        'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed:   'bg-green-100 text-green-800',
  filled:      'bg-emerald-100 text-emerald-800',
  closed:      'bg-gray-100 text-gray-700',
  cancelled:   'bg-red-100 text-red-800',
  rejected:    'bg-red-100 text-red-800',
  withdrawn:   'bg-gray-100 text-gray-700',
  paid:        'bg-green-100 text-green-800',
  failed:      'bg-red-100 text-red-800',
  submitted:   'bg-teal-100 text-teal-800',
  verified:    'bg-green-100 text-green-800',
  unverified:  'bg-gray-100 text-gray-600',
}

export function StatusBadge({ status }: { status: AnyStatus }) {
  const cls = MAP[status] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={'inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ' + cls}>
      {status.replace('_', ' ')}
    </span>
  )
}

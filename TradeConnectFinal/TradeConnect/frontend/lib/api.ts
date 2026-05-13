// ============================================================
// lib/api.ts - every Flask API call in one place.
// Mirrors the backend route map after Phase 1+2+3.
// ============================================================

import type {
  User, UserType,
  Tradesperson, TradespersonWithUser,
  Service,
  BookingWithDetails, BookingStatus,
  Payment, PaymentMethod, Subscription,
  Review, ReviewRequest,
  JobPosting, JobPostingStatus,
  JobApplication, ApplicationStatus,
  EndorsementRequest, EndorsementStatus,
  UploadedDocument,
} from '@/types'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = options.body instanceof FormData
    ? options.headers
    : { 'Content-Type': 'application/json', ...options.headers }

  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  })

  const text = await res.text()
  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { error: text || `Request failed with status ${res.status}` }
  }

  if (!res.ok) {
    throw new Error(data.error ?? `Request failed with status ${res.status}`)
  }

  return data as T
}

export const authApi = {
  register: (body: {
    first_name: string; last_name: string; email: string; password: string
    user_type: UserType; phone?: string; city?: string; state?: string
  }) =>
    request<{ message: string; user_id: number } & Partial<User>>(
      '/api/auth/register',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  login: (body: { email: string; password: string }) =>
    request<{ message: string } & Partial<User>>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  logout: () =>
    request<{ message: string }>('/api/auth/logout', { method: 'POST' }),

  me: () => request<{ user: User }>('/api/auth/me'),
}

export const usersApi = {
  updateProfile: (body: Partial<Pick<User,
    'first_name' | 'last_name' | 'phone' | 'address' | 'city' | 'state' | 'zip'
  >>) =>
    request<{ message: string; user: User }>('/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
}

export const tradespeopleApi = {
  search: (params?: { trade_category?: string; city?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString()
    return request<{ tradespeople: (TradespersonWithUser & { service_names?: string })[] }>(
      `/api/tradespeople${qs ? `?${qs}` : ''}`,
    )
  },

  getOne: (tp_id: number) =>
    request<{ tradesperson: TradespersonWithUser }>(`/api/tradespeople/${tp_id}`),

  getMe: () =>
    request<{ tradesperson: TradespersonWithUser }>('/api/tradespeople/me'),

  upsert: (body: Partial<Tradesperson>) =>
    request<{ message: string }>('/api/tradespeople/profile', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}

export const servicesApi = {
  search: (params?: { trade_type?: string; city?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString()
    return request<{ services: Service[] }>(`/api/services${qs ? `?${qs}` : ''}`)
  },

  getForTradesperson: (tp_id: number) =>
    request<{ services: Service[] }>(`/api/services/tradesperson/${tp_id}`),

  create: (body: {
    service_name: string; description?: string
    hourly_rate?: number; trade_type?: string
  }) =>
    request<{ message: string; service_id: number }>('/api/services', {
      method: 'POST', body: JSON.stringify(body),
    }),
}

export type EnrichedBooking = BookingWithDetails & {
  service_name?: string
  employer_name?: string
  tradesperson_name?: string
  payment_status?: 'pending' | 'paid' | 'failed'
  payment_amount?: number | null
  platform_fee_amount?: number | null
  platform_fee_percentage?: number | null
  tradesperson_payout?: number | null
  has_review?: boolean
}

export const bookingsApi = {
  getAll: (params?: { status?: BookingStatus }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString()
    return request<{ bookings: EnrichedBooking[] }>(
      `/api/bookings${qs ? `?${qs}` : ''}`,
    )
  },

  getOne: (id: number) =>
    request<{ booking: EnrichedBooking }>(`/api/bookings/${id}`),

  create: (body: {
    tradesperson_id: number; service_id: number; scheduled_at: string
    address: string; city: string; quoted_price?: number
  }) =>
    request<{ message: string; booking_id: number }>('/api/bookings', {
      method: 'POST', body: JSON.stringify(body),
    }),

  updateStatus: (id: number, status: BookingStatus) =>
    request<{ message: string }>(`/api/bookings/${id}/status`, {
      method: 'PATCH', body: JSON.stringify({ status }),
    }),
}

export const paymentsApi = {
  getForBooking: (booking_id: number) =>
    request<{ payment: Payment | null }>(`/api/payments/booking/${booking_id}`),

  create: (body: { booking_id: number; amount: number; method: PaymentMethod }) =>
    request<{
      message: string
      payment_id: number
      platform_fee_amount: number
      tradesperson_payout: number
    }>('/api/payments', {
      method: 'POST', body: JSON.stringify(body),
    }),
}

export interface SubscriptionPlanOption {
  plan_id: number
  plan_name: 'Free' | 'Pro' | 'Elite'
  description: string | null
  monthly_price: number
  job_limit: number
}

export const subscriptionsApi = {
  plans: () => request<{ plans: SubscriptionPlanOption[] }>('/api/subscriptions/plans'),

  mine: () => request<{ subscription: Subscription | null }>('/api/subscriptions/me'),

  activate: (plan_name: 'Pro' | 'Elite') =>
    request<{ message: string; subscription_id: number; plan_id: number; job_limit: number }>(
      '/api/subscriptions',
      { method: 'POST', body: JSON.stringify({ plan_name }) },
    ),

  cancel: () =>
    request<{ message: string; job_limit: number }>('/api/subscriptions/me/cancel', {
      method: 'PATCH',
    }),
}

export interface RevenueSummary {
  total_payment_volume: number
  total_platform_fees: number
  active_subscriptions: number
  monthly_subscription_revenue: number
  total_estimated_revenue: number
  streams: { stream_name: string; revenue: number }[]
}

export const revenueApi = {
  summary: () => request<RevenueSummary>('/api/revenue/summary'),
}

export type EnrichedReview = Review & {
  tradesperson_name?: string
  reviewer_name?: string
}

export type EnrichedReviewRequest = ReviewRequest & {
  tradesperson_name?: string
  service_name?: string
}

export const reviewsApi = {
  getForTradesperson: (tp_id: number) =>
    request<{ reviews: EnrichedReview[] }>(`/api/reviews/tradesperson/${tp_id}`),

  getRequests: () =>
    request<{ requests: EnrichedReviewRequest[] }>('/api/reviews/requests'),

  getSubmitted: () =>
    request<{ reviews: EnrichedReview[] }>('/api/reviews/submitted'),

  submit: (body: {
    booking_id: number; tradesperson_id: number
    rating: number; comment?: string
  }) =>
    request<{ message: string }>('/api/reviews', {
      method: 'POST', body: JSON.stringify(body),
    }),
}

export interface NotificationItem {
  id: number
  key: string
  message: string
  created_at: string | null
  time: string
  read: boolean
}

export const notificationsApi = {
  getAll: () =>
    request<{ notifications: NotificationItem[]; unread_count: number }>(
      '/api/notifications',
    ),

  markRead: (id: number, key: string) =>
    request<{ message: string }>(
      `/api/notifications/${id}/read?key=${encodeURIComponent(key)}`,
      { method: 'PATCH' },
    ),

  markAllRead: () =>
    request<{ message: string }>('/api/notifications/read-all', {
      method: 'PATCH',
    }),
}

export interface AvailableJob {
  id: number
  job_posting_id: number
  title: string
  description?: string
  trade: string
  city: string
  address: string
  budget_min: number | null
  budget_max: number | null
  employer: string
  employer_id: number
  scheduled_at: string | null
  created_at: string | null
  my_application: {
    application_id: number
    status: ApplicationStatus
    proposed_price?: number | null
  } | null
}

export const jobsApi = {
  available: (q?: string) => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : ''
    return request<{ jobs: AvailableJob[]; gated?: 'no_supervisor' }>(
      `/api/jobs/available${qs}`,
    )
  },

  cap: () =>
    request<{
      job_limit: number; jobs_taken: number; remaining: number
      active_bookings: number; pending_applications: number
    }>('/api/jobs/cap'),
}

export const jobPostingsApi = {
  list: (params?: { status?: JobPostingStatus; q?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString()
    return request<{ postings: JobPosting[]; gated?: 'no_supervisor' }>(
      `/api/job_postings${qs ? `?${qs}` : ''}`,
    )
  },

  get: (id: number) =>
    request<{ posting: JobPosting; applications?: JobApplication[] }>(
      `/api/job_postings/${id}`,
    ),

  create: (body: {
    title: string; description?: string; trade_type: string
    city?: string; address?: string
    budget_min?: number | null; budget_max?: number | null
    scheduled_at: string
  }) =>
    request<{ message: string; job_posting_id: number }>('/api/job_postings', {
      method: 'POST', body: JSON.stringify(body),
    }),

  update: (id: number, body: Partial<{
    title: string; description: string; city: string; address: string
    budget_min: number | null; budget_max: number | null; scheduled_at: string
  }>) =>
    request<{ message: string }>(`/api/job_postings/${id}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),

  close: (id: number) =>
    request<{ message: string }>(`/api/job_postings/${id}/close`, {
      method: 'POST',
    }),

  cancel: (id: number) =>
    request<{ message: string }>(`/api/job_postings/${id}/cancel`, {
      method: 'POST',
    }),
}

export const jobApplicationsApi = {
  create: (body: {
    job_posting_id: number; proposed_price: number
    service_id?: number; message?: string
  }) =>
    request<{ message: string; application_id: number }>('/api/job_applications', {
      method: 'POST', body: JSON.stringify(body),
    }),

  mine: (status?: ApplicationStatus) => {
    const qs = status ? `?status=${status}` : ''
    return request<{ applications: JobApplication[] }>(
      `/api/job_applications/mine${qs}`,
    )
  },

  withdraw: (id: number) =>
    request<{ message: string }>(`/api/job_applications/${id}/withdraw`, {
      method: 'POST',
    }),

  decide: (id: number, decision: 'accept' | 'reject') =>
    request<{ message: string; booking_id?: number }>(
      `/api/job_applications/${id}/decide`,
      { method: 'POST', body: JSON.stringify({ decision }) },
    ),
}

export const endorsementsApi = {
  create: (body: {
    supervisor_email: string
    message?: string
    document_ids?: number[]
  }) =>
    request<{ message: string; endorsement_request_id: number }>(
      '/api/endorsement_requests',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  mine: () =>
    request<{ requests: EndorsementRequest[] }>('/api/endorsement_requests/mine'),

  incoming: (status?: EndorsementStatus) => {
    const qs = status ? `?status=${status}` : ''
    return request<{ requests: EndorsementRequest[] }>(
      `/api/endorsement_requests/incoming${qs}`,
    )
  },

  decide: (id: number, decision: 'approve' | 'reject', note?: string) =>
    request<{ message: string }>(
      `/api/endorsement_requests/${id}/decide`,
      { method: 'POST', body: JSON.stringify({ decision, note }) },
    ),

  withdraw: (id: number) =>
    request<{ message: string }>(
      `/api/endorsement_requests/${id}/withdraw`,
      { method: 'POST' },
    ),
}

export const documentsApi = {
  upload: async (file: File): Promise<{
    document_id: number; original_filename: string
    mime_type: string; file_size_bytes: number
  }> => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE}/api/documents/upload`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    })
    const text = await res.text()
    const data = text ? JSON.parse(text) : {}
    if (!res.ok) {
      throw new Error(data.error ?? `Upload failed (${res.status})`)
    }
    return data
  },

  mine: () =>
    request<{ documents: UploadedDocument[] }>('/api/documents/mine'),

  info: (id: number) =>
    request<{ document: UploadedDocument }>(`/api/documents/${id}/info`),

  url: (id: number) => `${BASE}/api/documents/${id}`,

  delete: (id: number) =>
    request<{ message: string }>(`/api/documents/${id}`, { method: 'DELETE' }),
}

// ============================================================
// Admin API — admin-only endpoints under /api/admin.
// ============================================================

export interface AdminUserRow {
  user_id: number
  first_name: string
  last_name: string
  email: string
  user_type: UserType
  city?: string
  state?: string
  is_active: boolean
  created_at?: string | null
  last_login_at?: string | null
  employer_booking_count: number
  tradesperson_booking_count: number
}

export interface PlatformSettings {
  platform_fee_percentage: number
  updated_at?: string | null
}

export interface AdminSubscriptionPlan {
  plan_id: number
  plan_name: string
  description: string | null
  monthly_price: number
  job_limit: number
  is_active: boolean
}

export const adminApi = {
  listUsers: () =>
    request<{ users: AdminUserRow[] }>('/api/admin/users'),

  deleteUser: (user_id: number) =>
    request<{ message: string; user_id: number }>(
      `/api/admin/users/${user_id}`,
      { method: 'DELETE' },
    ),

  getSettings: () =>
    request<{ settings: PlatformSettings }>('/api/admin/settings'),

  updateSettings: (platform_fee_percentage: number) =>
    request<{ message: string; platform_fee_percentage: number }>(
      '/api/admin/settings',
      {
        method: 'PUT',
        body: JSON.stringify({ platform_fee_percentage }),
      },
    ),

  listPlans: () =>
    request<{ plans: AdminSubscriptionPlan[] }>('/api/admin/subscription-plans'),

  updatePlan: (
    plan_id: number,
    body: Partial<{ monthly_price: number; job_limit: number; is_active: boolean }>,
  ) =>
    request<{ message: string; plan: AdminSubscriptionPlan }>(
      `/api/admin/subscription-plans/${plan_id}`,
      { method: 'PUT', body: JSON.stringify(body) },
    ),
}

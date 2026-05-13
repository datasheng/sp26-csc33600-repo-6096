// ============================================================
// types/index.ts - mirrors freelancer_db schema v2 (Phase 1+2+3)
// ============================================================

export type UserType = 'Employer' | 'Tradesperson' | 'Junior' | 'Admin'

export interface User {
  user_id: number
  first_name: string
  last_name: string
  email: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  user_type: UserType
  is_active: boolean
  last_login_at?: string
  created_at: string
}

export interface Tradesperson {
  tradesperson_id: number
  user_id: number
  trade_category: string
  license_number?: string
  license_state?: string
  license_expiry?: string
  experience_year: number
  endorse_id?: number | null
  job_limit: number
  avg_rating: number
  is_verified: boolean
}

export interface Service {
  service_id: number
  tradesperson_id: number
  service_name: string
  description?: string
  hourly_rate?: number
  trade_type?: string
}

export type BookingStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'
export type PaymentMethod = 'card' | 'cash' | 'online'
export type PaymentStatus = 'pending' | 'paid' | 'failed'

export interface Booking {
  booking_id: number
  user_id: number
  tradesperson_id: number
  service_id: number
  application_id?: number | null
  scheduled_at: string
  status: BookingStatus
  city?: string
  address?: string
  quoted_price?: number
  created_at: string
}

export interface Payment {
  payment_id: number
  booking_id: number
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  paid_at?: string
  platform_fee_amount?: number | null
  platform_fee_percentage?: number | null
  tradesperson_payout?: number | null
}

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired'

export interface Subscription {
  subscription_id: number
  tradesperson_id: number
  plan_id: number
  plan_name: string
  price_at_purchase: number
  job_limit: number
  status: SubscriptionStatus
  start_date: string
  end_date?: string | null
}

export type ReviewRequestStatus = 'pending' | 'submitted'

export interface ReviewRequest {
  review_request_id: number
  booking_id: number
  employer_id: number
  tradesperson_id: number
  status: ReviewRequestStatus
  created_at: string
  submitted_at?: string
}

export interface Review {
  review_id: number
  booking_id: number
  reviewer_user_id: number
  tradesperson_id: number
  rating: number
  comment?: string
  created_at: string
}

export type JobPostingStatus  = 'open' | 'filled' | 'closed' | 'cancelled'
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn'

export interface JobPosting {
  job_posting_id: number
  employer_id: number
  title: string
  description?: string
  trade_type: string
  city?: string
  address?: string
  budget_min?: number | null
  budget_max?: number | null
  scheduled_at: string
  status: JobPostingStatus
  created_at?: string
  closed_at?: string
  employer_name?: string
  application_count?: number
  my_application?: {
    application_id: number
    status: ApplicationStatus
    proposed_price?: number | null
  } | null
}

export interface JobApplication {
  application_id: number
  job_posting_id: number
  tradesperson_id: number
  service_id?: number | null
  service_name?: string
  proposed_price?: number | null
  message?: string
  status: ApplicationStatus
  created_at?: string
  decided_at?: string
  tradesperson_name?: string
  trade_category?: string
  avg_rating?: number
  is_verified?: boolean
  posting_title?: string
  posting_status?: JobPostingStatus
  posting_city?: string
  posting_trade?: string
  scheduled_at?: string
  employer_name?: string
}

export type EndorsementStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'

export interface AttachedDocument {
  document_id: number
  original_filename: string
  mime_type: string
  file_size_bytes: number
}

export interface EndorsementRequest {
  endorsement_request_id: number
  junior_tradesperson_id: number
  supervisor_tradesperson_id: number
  message?: string
  status: EndorsementStatus
  decision_note?: string
  created_at?: string
  decided_at?: string
  junior_name?: string
  junior_email?: string
  junior_trade?: string
  junior_experience_year?: number
  supervisor_name?: string
  supervisor_email?: string
  documents: AttachedDocument[]
}

export interface UploadedDocument {
  document_id: number
  uploaded_by_user_id: number
  original_filename: string
  mime_type: string
  file_size_bytes: number
  related_entity_type: 'endorsement_request' | 'license_proof' | 'job_posting' | 'other'
  related_entity_id?: number | null
  created_at?: string
}

export interface RegisterPayload {
  first_name: string
  last_name: string
  email: string
  password: string
  user_type: UserType
  phone?: string
  city?: string
  state?: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface AuthResponse {
  message: string
  user?: User
  error?: string
}

export interface BookingWithDetails extends Booking {
  service?: Service
  tradesperson_user?: User
  tradesperson?: Tradesperson
  payment?: Payment
}

export interface TradespersonWithUser extends Tradesperson {
  user: User
  services?: Service[]
}

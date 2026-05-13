DROP DATABASE IF EXISTS freelancer_db;
CREATE DATABASE freelancer_db;
USE freelancer_db;

CREATE TABLE users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    first_name    VARCHAR(100)  NOT NULL,
    last_name     VARCHAR(100)  NOT NULL,
    email         VARCHAR(150)  UNIQUE NOT NULL,
    password_hash VARCHAR(255)  NOT NULL,
    phone         VARCHAR(20),
    address       VARCHAR(255),
    city          VARCHAR(100),
    state         VARCHAR(2),
    zip           VARCHAR(20),
    user_type     ENUM('Employer', 'Tradesperson', 'Junior', 'Admin') NOT NULL,
    is_active     BOOLEAN       DEFAULT TRUE,
    last_login_at TIMESTAMP     NULL,
    created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tradespeople (
    tradesperson_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT           NOT NULL UNIQUE,
    trade_category  VARCHAR(100)  NOT NULL,
    license_number  VARCHAR(100),
    license_state   VARCHAR(50),
    license_expiry  DATE,
    experience_year INT           NOT NULL,
    endorse_id      INT           NULL,
    job_limit       INT           DEFAULT 5,
    avg_rating      DECIMAL(3,2)  DEFAULT 0.00,
    is_verified     BOOLEAN       DEFAULT FALSE,

    FOREIGN KEY (user_id)    REFERENCES users(user_id)            ON DELETE CASCADE,
    FOREIGN KEY (endorse_id) REFERENCES tradespeople(tradesperson_id) ON DELETE SET NULL
);

CREATE TABLE services (
    service_id      INT AUTO_INCREMENT PRIMARY KEY,
    tradesperson_id INT           NOT NULL,
    service_name    VARCHAR(150)  NOT NULL,
    description     TEXT,
    hourly_rate     DECIMAL(10,2),
    trade_type      VARCHAR(100),

    FOREIGN KEY (tradesperson_id) REFERENCES tradespeople(tradesperson_id) ON DELETE CASCADE
);

CREATE TABLE job_postings (
    job_posting_id INT AUTO_INCREMENT PRIMARY KEY,
    employer_id    INT           NOT NULL,        -- users.user_id (Employer)
    title          VARCHAR(200)  NOT NULL,
    description    TEXT,
    trade_type     VARCHAR(100)  NOT NULL,        -- 'Plumbing', 'Electrical', ...
    city           VARCHAR(100),
    address        VARCHAR(255),
    budget_min     DECIMAL(10,2),
    budget_max     DECIMAL(10,2),
    scheduled_at   DATETIME      NOT NULL,        -- when the work should happen
    status         ENUM('open', 'filled', 'closed', 'cancelled') NOT NULL DEFAULT 'open',
    created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    closed_at      TIMESTAMP     NULL,

    FOREIGN KEY (employer_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CHECK (budget_max IS NULL OR budget_min IS NULL OR budget_max >= budget_min)
);

CREATE TABLE job_applications (
    application_id  INT AUTO_INCREMENT PRIMARY KEY,
    job_posting_id  INT           NOT NULL,
    tradesperson_id INT           NOT NULL,
    service_id      INT           NULL,           -- which of their services they're offering
    proposed_price  DECIMAL(10,2) NOT NULL,
    message         TEXT,
    status          ENUM('pending', 'accepted', 'rejected', 'withdrawn')
                    NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    decided_at      TIMESTAMP NULL,

    FOREIGN KEY (job_posting_id)  REFERENCES job_postings(job_posting_id)   ON DELETE CASCADE,
    FOREIGN KEY (tradesperson_id) REFERENCES tradespeople(tradesperson_id)  ON DELETE CASCADE,
    FOREIGN KEY (service_id)      REFERENCES services(service_id)           ON DELETE SET NULL,
    UNIQUE KEY uniq_application (job_posting_id, tradesperson_id)
);

CREATE TABLE bookings (
    booking_id      INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT           NOT NULL,        -- employer (the booker)
    tradesperson_id INT           NOT NULL,        -- assigned worker
    service_id      INT           NOT NULL,
    application_id  INT           NULL UNIQUE,     -- which application created this booking
    scheduled_at    DATETIME      NOT NULL,
    status          ENUM('pending', 'accepted', 'in_progress', 'completed', 'cancelled')
                    NOT NULL DEFAULT 'pending',
    city            VARCHAR(100),
    address         VARCHAR(255),
    quoted_price    DECIMAL(10,2),
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)         REFERENCES users(user_id)                ON DELETE CASCADE,
    FOREIGN KEY (tradesperson_id) REFERENCES tradespeople(tradesperson_id) ON DELETE CASCADE,
    FOREIGN KEY (service_id)      REFERENCES services(service_id)          ON DELETE CASCADE,
    FOREIGN KEY (application_id)  REFERENCES job_applications(application_id) ON DELETE SET NULL
);

CREATE TABLE payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT           NOT NULL,
    amount     DECIMAL(10,2) NOT NULL,
    method     ENUM('card', 'cash', 'online') NOT NULL,
    status     ENUM('pending', 'paid', 'failed') NOT NULL DEFAULT 'pending',
    paid_at    TIMESTAMP     NULL,

    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
);

CREATE TABLE review_requests (
    review_request_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id        INT       NOT NULL UNIQUE,
    employer_id       INT       NOT NULL,
    tradesperson_id   INT       NOT NULL,
    status            ENUM('pending', 'submitted') DEFAULT 'pending',
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at      TIMESTAMP NULL,

    FOREIGN KEY (booking_id)      REFERENCES bookings(booking_id)          ON DELETE CASCADE,
    FOREIGN KEY (employer_id)     REFERENCES users(user_id)                ON DELETE CASCADE,
    FOREIGN KEY (tradesperson_id) REFERENCES tradespeople(tradesperson_id) ON DELETE CASCADE
);

CREATE TABLE reviews (
    review_id        INT AUTO_INCREMENT PRIMARY KEY,
    booking_id       INT  NOT NULL UNIQUE,
    reviewer_user_id INT  NOT NULL,
    tradesperson_id  INT  NOT NULL,
    rating           INT  NOT NULL,
    comment          TEXT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (booking_id)       REFERENCES bookings(booking_id)          ON DELETE CASCADE,
    FOREIGN KEY (reviewer_user_id) REFERENCES users(user_id)                ON DELETE CASCADE,
    FOREIGN KEY (tradesperson_id)  REFERENCES tradespeople(tradesperson_id) ON DELETE CASCADE,
    CHECK (rating BETWEEN 1 AND 5)
);

CREATE TABLE revenue_streams (
    revenue_stream_id INT AUTO_INCREMENT PRIMARY KEY,
    stream_name       VARCHAR(100) NOT NULL,
    description       TEXT,
    is_active         BOOLEAN DEFAULT TRUE
);

CREATE TABLE platform_fees (
    platform_fee_id   INT AUTO_INCREMENT PRIMARY KEY,
    payment_id        INT           NOT NULL,
    revenue_stream_id INT           NOT NULL,
    fee_amount        DECIMAL(10,2) NOT NULL,
    fee_percentage    DECIMAL(5,2),
    created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (payment_id)        REFERENCES payments(payment_id)               ON DELETE CASCADE,
    FOREIGN KEY (revenue_stream_id) REFERENCES revenue_streams(revenue_stream_id) ON DELETE CASCADE
);

-- =============================================
-- PLATFORM SETTINGS  (single-row config table)
-- Holds knobs the admin can tune at runtime:
--   - platform fee percentage applied to every paid booking.
-- Locked to a single row by setting_id = 1.
-- =============================================
CREATE TABLE platform_settings (
    setting_id              INT          PRIMARY KEY DEFAULT 1,
    platform_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    updated_at              TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CHECK (setting_id = 1),
    CHECK (platform_fee_percentage >= 0 AND platform_fee_percentage <= 100)
);

-- =============================================
-- SUBSCRIPTION PLANS  (catalog, 3NF)
-- Plan name + price live here once. Each subscriber
-- references plan_id and snapshots the price at
-- purchase time into price_at_purchase so historic
-- invoices stay accurate even if the catalog changes.
-- =============================================
CREATE TABLE subscription_plans (
    plan_id       INT AUTO_INCREMENT PRIMARY KEY,
    plan_name     VARCHAR(100)  NOT NULL UNIQUE,   -- 'Free', 'Pro', 'Elite'
    description   TEXT,
    monthly_price DECIMAL(10,2) NOT NULL,
    job_limit     INT           NOT NULL,
    is_active     BOOLEAN       DEFAULT TRUE,
    created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subscriptions (
    subscription_id   INT AUTO_INCREMENT PRIMARY KEY,
    tradesperson_id   INT           NOT NULL,
    plan_id           INT           NOT NULL,
    price_at_purchase DECIMAL(10,2) NOT NULL,   -- snapshot of monthly_price at activation
    status            ENUM('active', 'cancelled', 'expired') DEFAULT 'active',
    start_date        DATE          NOT NULL,
    end_date          DATE          NULL,

    FOREIGN KEY (tradesperson_id) REFERENCES tradespeople(tradesperson_id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id)         REFERENCES subscription_plans(plan_id)
);

CREATE TABLE endorsement_requests (
    endorsement_request_id   INT AUTO_INCREMENT PRIMARY KEY,
    junior_tradesperson_id   INT NOT NULL,
    supervisor_tradesperson_id INT NOT NULL,
    message                  TEXT,
    status                   ENUM('pending', 'approved', 'rejected', 'withdrawn')
                             NOT NULL DEFAULT 'pending',
    decision_note            TEXT,
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    decided_at               TIMESTAMP NULL,

    FOREIGN KEY (junior_tradesperson_id)     REFERENCES tradespeople(tradesperson_id) ON DELETE CASCADE,
    FOREIGN KEY (supervisor_tradesperson_id) REFERENCES tradespeople(tradesperson_id) ON DELETE CASCADE,
    CHECK (junior_tradesperson_id <> supervisor_tradesperson_id)
);

ALTER TABLE endorsement_requests
    ADD COLUMN pending_marker INT
        GENERATED ALWAYS AS (IF(status = 'pending', 1, NULL)) STORED,
    ADD UNIQUE KEY uniq_pending_request (junior_tradesperson_id, supervisor_tradesperson_id, pending_marker);

CREATE TABLE documents (
    document_id         INT AUTO_INCREMENT PRIMARY KEY,
    uploaded_by_user_id INT          NOT NULL,
    original_filename   VARCHAR(255) NOT NULL,    -- as named by the user
    storage_filename    VARCHAR(255) NOT NULL UNIQUE,  -- name on disk (UUID-prefixed)
    mime_type           VARCHAR(100) NOT NULL,
    file_size_bytes     BIGINT       NOT NULL,
    related_entity_type ENUM('endorsement_request', 'license_proof', 'job_posting', 'other')
                        NOT NULL DEFAULT 'other',
    related_entity_id   INT          NULL,
    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (uploaded_by_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_docs_related (related_entity_type, related_entity_id),
    INDEX idx_docs_uploader (uploaded_by_user_id)
);

CREATE INDEX idx_bookings_user            ON bookings(user_id);
CREATE INDEX idx_bookings_tradesperson    ON bookings(tradesperson_id);
CREATE INDEX idx_bookings_status          ON bookings(status);
CREATE INDEX idx_services_trade           ON services(trade_type);
CREATE INDEX idx_users_email              ON users(email);
CREATE INDEX idx_review_requests_status   ON review_requests(status);
CREATE INDEX idx_platform_fees_payment    ON platform_fees(payment_id);
CREATE INDEX idx_platform_fees_revenue    ON platform_fees(revenue_stream_id);
CREATE INDEX idx_subscriptions_trade      ON subscriptions(tradesperson_id);
CREATE INDEX idx_subscriptions_plan       ON subscriptions(plan_id);
CREATE INDEX idx_job_postings_status      ON job_postings(status);
CREATE INDEX idx_job_postings_trade       ON job_postings(trade_type);
CREATE INDEX idx_job_postings_employer    ON job_postings(employer_id);
CREATE INDEX idx_job_apps_posting         ON job_applications(job_posting_id);
CREATE INDEX idx_job_apps_tradesperson    ON job_applications(tradesperson_id);
CREATE INDEX idx_job_apps_status          ON job_applications(status);
CREATE INDEX idx_endorse_reqs_supervisor  ON endorsement_requests(supervisor_tradesperson_id);
CREATE INDEX idx_endorse_reqs_junior      ON endorsement_requests(junior_tradesperson_id);
CREATE INDEX idx_endorse_reqs_status      ON endorsement_requests(status);

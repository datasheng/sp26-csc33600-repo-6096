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
DROP TRIGGER IF EXISTS prevent_junior_booking;
DROP TRIGGER IF EXISTS prevent_junior_booking_update;
DROP TRIGGER IF EXISTS create_review_request_after_completion;
DROP TRIGGER IF EXISTS mark_review_request_submitted;
DROP TRIGGER IF EXISTS update_avg_rating_after_review;
DROP TRIGGER IF EXISTS approve_endorsement_sets_endorse_id;
DROP TRIGGER IF EXISTS application_accept_creates_booking;
DROP TRIGGER IF EXISTS booking_complete_marks_posting_filled;
DROP TRIGGER IF EXISTS prevent_overlapping_bookings;
DROP TRIGGER IF EXISTS prevent_overlapping_bookings_update;
DELIMITER $$

CREATE TRIGGER prevent_junior_booking
BEFORE INSERT ON bookings
FOR EACH ROW
BEGIN
    DECLARE v_user_type VARCHAR(20);
    DECLARE v_endorse_id INT;

    SELECT u.user_type, t.endorse_id
      INTO v_user_type, v_endorse_id
      FROM tradespeople t
      JOIN users u ON u.user_id = t.user_id
     WHERE t.tradesperson_id = NEW.tradesperson_id;

    IF v_user_type = 'Junior' AND v_endorse_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Junior cannot take a job without an approved supervisor';
    END IF;
END$$

CREATE TRIGGER prevent_junior_booking_update
BEFORE UPDATE ON bookings
FOR EACH ROW
BEGIN
    DECLARE v_user_type VARCHAR(20);
    DECLARE v_endorse_id INT;

    IF NEW.tradesperson_id <> OLD.tradesperson_id THEN
        SELECT u.user_type, t.endorse_id
          INTO v_user_type, v_endorse_id
          FROM tradespeople t
          JOIN users u ON u.user_id = t.user_id
         WHERE t.tradesperson_id = NEW.tradesperson_id;

        IF v_user_type = 'Junior' AND v_endorse_id IS NULL THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cannot reassign a job to a Junior without an approved supervisor';
        END IF;
    END IF;
END$$

CREATE TRIGGER create_review_request_after_completion
AFTER UPDATE ON bookings
FOR EACH ROW
BEGIN
    IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
        INSERT IGNORE INTO review_requests
            (booking_id, employer_id, tradesperson_id, status)
        VALUES
            (NEW.booking_id, NEW.user_id, NEW.tradesperson_id, 'pending');
    END IF;
END$$

CREATE TRIGGER mark_review_request_submitted
AFTER INSERT ON reviews
FOR EACH ROW
BEGIN
    UPDATE review_requests
       SET status       = 'submitted',
           submitted_at = CURRENT_TIMESTAMP
     WHERE booking_id = NEW.booking_id;
END$$

CREATE TRIGGER update_avg_rating_after_review
AFTER INSERT ON reviews
FOR EACH ROW
BEGIN
    UPDATE tradespeople t
       SET avg_rating = (
           SELECT ROUND(AVG(r.rating), 2)
             FROM reviews r
            WHERE r.tradesperson_id = NEW.tradesperson_id
       )
     WHERE t.tradesperson_id = NEW.tradesperson_id;
END$$

CREATE TRIGGER approve_endorsement_sets_endorse_id
BEFORE UPDATE ON endorsement_requests
FOR EACH ROW
BEGIN
    DECLARE v_sup_user_type VARCHAR(20);

    IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
        SELECT u.user_type
          INTO v_sup_user_type
          FROM tradespeople t
          JOIN users u ON u.user_id = t.user_id
         WHERE t.tradesperson_id = NEW.supervisor_tradesperson_id;

        IF v_sup_user_type = 'Junior' THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'A Junior cannot endorse another Junior';
        END IF;

        SET NEW.decided_at = CURRENT_TIMESTAMP;

        UPDATE tradespeople
           SET endorse_id = NEW.supervisor_tradesperson_id
         WHERE tradesperson_id = NEW.junior_tradesperson_id;

    ELSEIF NEW.status IN ('rejected', 'withdrawn') AND OLD.status = 'pending' THEN
        SET NEW.decided_at = CURRENT_TIMESTAMP;
    END IF;
END$$

CREATE TRIGGER application_accept_creates_booking
AFTER UPDATE ON job_applications
FOR EACH ROW
BEGIN
    DECLARE v_employer_id   INT;
    DECLARE v_scheduled_at  DATETIME;
    DECLARE v_city          VARCHAR(100);
    DECLARE v_address       VARCHAR(255);
    DECLARE v_service_id    INT;
    DECLARE v_trade_type    VARCHAR(100);
    DECLARE v_fallback_svc  INT;

    IF NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN

        SELECT employer_id, scheduled_at, city, address, trade_type
          INTO v_employer_id, v_scheduled_at, v_city, v_address, v_trade_type
          FROM job_postings
         WHERE job_posting_id = NEW.job_posting_id;

        SET v_service_id = NEW.service_id;
        IF v_service_id IS NULL THEN
            SELECT service_id INTO v_fallback_svc
              FROM services
             WHERE tradesperson_id = NEW.tradesperson_id
               AND (trade_type = v_trade_type OR v_trade_type IS NULL)
             ORDER BY service_id
             LIMIT 1;
            SET v_service_id = v_fallback_svc;
        END IF;

        IF v_service_id IS NULL THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cannot accept: tradesperson has no service matching the posting';
        END IF;

        INSERT INTO bookings
            (user_id, tradesperson_id, service_id, application_id,
             scheduled_at, status, city, address, quoted_price)
        VALUES
            (v_employer_id, NEW.tradesperson_id, v_service_id, NEW.application_id,
             v_scheduled_at, 'accepted', v_city, v_address, NEW.proposed_price);

        UPDATE job_postings
           SET status    = 'filled',
               closed_at = CURRENT_TIMESTAMP
         WHERE job_posting_id = NEW.job_posting_id;

    END IF;
END$$

-- ─────────────────────────────────────────────────────────────
-- A tradesperson cannot accept two jobs at the same scheduled
-- time. "Cancelled" bookings don't occupy the slot.
-- Fires on INSERT and on UPDATE (when status or scheduled_at
-- moves a row back into a slot it didn't hold before).
-- ─────────────────────────────────────────────────────────────
CREATE TRIGGER prevent_overlapping_bookings
BEFORE INSERT ON bookings
FOR EACH ROW
BEGIN
    DECLARE v_clash INT;

    IF NEW.status <> 'cancelled' THEN
        SELECT COUNT(*) INTO v_clash
          FROM bookings
         WHERE tradesperson_id = NEW.tradesperson_id
           AND scheduled_at    = NEW.scheduled_at
           AND status <> 'cancelled';

        IF v_clash > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Tradesperson already has a booking at this time';
        END IF;
    END IF;
END$$

CREATE TRIGGER prevent_overlapping_bookings_update
BEFORE UPDATE ON bookings
FOR EACH ROW
BEGIN
    DECLARE v_clash INT;

    -- Only check when the new row would occupy a slot it didn't before:
    --   - the slot's tradesperson changed,
    --   - the scheduled_at changed,
    --   - or the row moved out of 'cancelled' back into an active state.
    IF NEW.status <> 'cancelled'
       AND (
            NEW.tradesperson_id <> OLD.tradesperson_id
         OR NEW.scheduled_at    <> OLD.scheduled_at
         OR OLD.status = 'cancelled'
       )
    THEN
        SELECT COUNT(*) INTO v_clash
          FROM bookings
         WHERE tradesperson_id = NEW.tradesperson_id
           AND scheduled_at    = NEW.scheduled_at
           AND booking_id     <> NEW.booking_id
           AND status <> 'cancelled';

        IF v_clash > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Tradesperson already has a booking at this time';
        END IF;
    END IF;
END$$

DELIMITER ;

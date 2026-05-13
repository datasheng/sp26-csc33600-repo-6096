DROP DATABASE IF EXISTS freelancer_db;
CREATE DATABASE freelancer_db;
USE freelancer_db;

-- =============================================
-- 1. USERS
-- =============================================
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(2),
    zip VARCHAR(20),
    user_type ENUM('Employer', 'Tradesperson', 'Junior') NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 2. TRADESPEOPLE
-- =============================================
CREATE TABLE tradespeople (
    tradesperson_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    trade_category VARCHAR(100) NOT NULL,
    license_number VARCHAR(100),
    license_state VARCHAR(50),
    license_expiry DATE,
    experience_year INT NOT NULL,
    endorse_id INT NULL,
    job_limit INT DEFAULT 5,
    avg_rating DECIMAL(3,2) DEFAULT 0.00,
    is_verified BOOLEAN DEFAULT FALSE,

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (endorse_id) REFERENCES tradespeople(tradesperson_id) ON DELETE SET NULL
);

-- =============================================
-- 3. SERVICES
-- =============================================
CREATE TABLE services (
    service_id INT AUTO_INCREMENT PRIMARY KEY,
    tradesperson_id INT NOT NULL,
    service_name VARCHAR(150) NOT NULL,
    description TEXT,
    hourly_rate DECIMAL(10,2),
    trade_type VARCHAR(100),

    FOREIGN KEY (tradesperson_id) REFERENCES tradespeople(tradesperson_id) ON DELETE CASCADE
);

-- =============================================
-- 4. BOOKINGS
-- =============================================
CREATE TABLE bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    tradesperson_id INT NOT NULL,
    service_id INT NOT NULL,
    scheduled_at DATETIME NOT NULL,
    status ENUM('pending', 'accepted', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    city VARCHAR(100),
    address VARCHAR(255),
    quoted_price DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (tradesperson_id) REFERENCES tradespeople(tradesperson_id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE CASCADE
);

-- =============================================
-- 5. PAYMENTS
-- =============================================
CREATE TABLE payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    method ENUM('card', 'cash', 'online') NOT NULL,
    status ENUM('pending', 'paid', 'failed') NOT NULL DEFAULT 'pending',
    paid_at TIMESTAMP NULL,

    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
);

-- =============================================
-- 6. REVIEW REQUESTS
-- =============================================
CREATE TABLE review_requests (
    review_request_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL UNIQUE,
    employer_id INT NOT NULL,
    tradesperson_id INT NOT NULL,
    status ENUM('pending', 'submitted') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP NULL,

    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (employer_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (tradesperson_id) REFERENCES tradespeople(tradesperson_id) ON DELETE CASCADE
);

-- =============================================
-- 7. REVIEWS
-- =============================================
CREATE TABLE reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL UNIQUE,
    reviewer_user_id INT NOT NULL,
    tradesperson_id INT NOT NULL,
    rating INT NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (tradesperson_id) REFERENCES tradespeople(tradesperson_id) ON DELETE CASCADE,
    CHECK (rating BETWEEN 1 AND 5)
);

-- =============================================
-- 8. REVENUE STREAMS
-- =============================================
CREATE TABLE revenue_streams (
    revenue_stream_id INT AUTO_INCREMENT PRIMARY KEY,
    stream_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- =============================================
-- 9. PLATFORM FEES
-- =============================================
CREATE TABLE platform_fees (
    platform_fee_id INT AUTO_INCREMENT PRIMARY KEY,
    payment_id INT NOT NULL,
    revenue_stream_id INT NOT NULL,
    fee_amount DECIMAL(10,2) NOT NULL,
    fee_percentage DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE CASCADE,
    FOREIGN KEY (revenue_stream_id) REFERENCES revenue_streams(revenue_stream_id) ON DELETE CASCADE
);

-- =============================================
-- 10. SUBSCRIPTIONS
-- =============================================
CREATE TABLE subscriptions (
    subscription_id INT AUTO_INCREMENT PRIMARY KEY,
    tradesperson_id INT NOT NULL,
    plan_name VARCHAR(100) NOT NULL,
    monthly_price DECIMAL(10,2) NOT NULL,
    status ENUM('active', 'cancelled', 'expired') DEFAULT 'active',
    start_date DATE NOT NULL,
    end_date DATE,

    FOREIGN KEY (tradesperson_id) REFERENCES tradespeople(tradesperson_id) ON DELETE CASCADE
);

-- =============================================
-- 11. INDEXES
-- =============================================
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_tradesperson ON bookings(tradesperson_id);
CREATE INDEX idx_services_trade ON services(trade_type);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_review_requests_status ON review_requests(status);
CREATE INDEX idx_platform_fees_payment ON platform_fees(payment_id);
CREATE INDEX idx_platform_fees_revenue_stream ON platform_fees(revenue_stream_id);
CREATE INDEX idx_subscriptions_tradesperson ON subscriptions(tradesperson_id);

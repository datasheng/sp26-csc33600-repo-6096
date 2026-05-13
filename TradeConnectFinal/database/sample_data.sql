-- =============================================
-- SAMPLE DATA FOR freelancer_db
-- =============================================

-- =============================================
-- USERS
-- =============================================
INSERT INTO users (first_name, last_name, email, password_hash, user_type, city, state)
VALUES 
('Alice', 'Smith', 'alice@email.com', 'hashed_pw_1', 'Employer', 'New York', 'NY'),
('Bob', 'Jones', 'bob@email.com', 'hashed_pw_2', 'Tradesperson', 'New York', 'NY'),
('Charlie', 'Brown', 'charlie@email.com', 'hashed_pw_3', 'Tradesperson', 'New York', 'NY'),
('David', 'Lee', 'david@email.com', 'hashed_pw_4', 'Junior', 'New York', 'NY'),
('Eva', 'Green', 'eva@email.com', 'hashed_pw_5', 'Employer', 'New York', 'NY');

-- =============================================
-- TRADESPEOPLE
-- Bob = main plumber
-- Charlie = main electrician
-- David = junior under Bob
-- =============================================
INSERT INTO tradespeople (user_id, trade_category, experience_year, endorse_id)
VALUES 
(2, 'Plumbing', 5, NULL),   -- Bob
(3, 'Electrical', 4, NULL), -- Charlie
(4, 'Plumbing', 1, 1);      -- David (junior under Bob)

-- =============================================
-- SERVICES
-- =============================================
INSERT INTO services (tradesperson_id, service_name, description, hourly_rate, trade_type)
VALUES 
(1, 'Pipe Repair', 'Fix leaking or broken pipes', 60.00, 'Plumbing'),
(1, 'Drain Cleaning', 'Unclog drains and pipes', 50.00, 'Plumbing'),
(2, 'Wiring', 'Electrical wiring installation', 70.00, 'Electrical');

-- =============================================
-- BOOKINGS
-- Alice books Bob (Plumbing)
-- Eva books Charlie (Electrical)
-- =============================================
INSERT INTO bookings (
    user_id,
    tradesperson_id,
    service_id,
    scheduled_at,
    status,
    city,
    address,
    quoted_price
)
VALUES 
(1, 1, 1, '2026-04-20 10:00:00', 'accepted', 'New York', '123 Main St', 120.00),
(5, 2, 3, '2026-04-21 14:00:00', 'accepted', 'New York', '456 Park Ave', 150.00);

-- =============================================
-- PAYMENTS
-- =============================================
INSERT INTO payments (booking_id, amount, method, status)
VALUES 
(1, 120.00, 'card', 'pending'),
(2, 150.00, 'cash', 'pending');

-- =============================================
-- COMPLETE ONE BOOKING (for testing reviews)
-- =============================================
UPDATE bookings
SET status = 'completed'
WHERE booking_id = 1;

-- =============================================
-- CREATE REVIEW REQUEST (simulate system)
-- =============================================
INSERT INTO review_requests (
    booking_id,
    employer_id,
    tradesperson_id,
    status
)
VALUES 
(1, 1, 1, 'pending');

-- =============================================
-- CREATE REVIEW (simulate employer submission)
-- =============================================
INSERT INTO reviews (
    booking_id,
    reviewer_user_id,
    tradesperson_id,
    rating,
    comment
)
VALUES 
(1, 1, 1, 5, 'Great service, very professional!');

-- =============================================
-- SAMPLE DATA for freelancer_db (schema v2)
-- Run AFTER schema.sql AND triggers.sql.
-- Designed so every new flow has at least one realistic row.
-- =============================================

-- ─────────────────────────────────────────────
-- USERS
--  1 Alice    Employer
--  2 Bob      Tradesperson (senior plumber)
--  3 Charlie  Tradesperson (senior electrician)
--  4 David    Junior (under Bob, will be approved)
--  5 Eva      Employer
--  6 Frank    Junior (pending request to Charlie — not yet approved)
--  7 Admin    Admin   (platform super user)
--  8 Grace    Employer  (Jersey City)
--  9 Henry    Employer  (Newark)
-- 10 Isabel   Employer  (Brooklyn)
-- 11 Jack     Tradesperson, senior plumber, Jersey City
-- 12 Karen    Tradesperson, senior electrician, Newark
-- 13 Liam     Tradesperson, senior carpenter, Brooklyn
-- 14 Mia      Junior (under Jack,  Jersey City)
-- 15 Noah     Junior (under Karen, Newark)
-- 16 Olivia   Junior (under Liam,  Brooklyn)
-- ─────────────────────────────────────────────
INSERT INTO users (first_name, last_name, email, password_hash, user_type, city, state)
VALUES
('Alice',   'Smith',     'alice@email.com',   'hashed_pw_1',  'Employer',     'New York',    'NY'),
('Bob',     'Jones',     'bob@email.com',     'hashed_pw_2',  'Tradesperson', 'New York',    'NY'),
('Charlie', 'Brown',     'charlie@email.com', 'hashed_pw_3',  'Tradesperson', 'New York',    'NY'),
('David',   'Lee',       'david@email.com',   'hashed_pw_4',  'Junior',       'New York',    'NY'),
('Eva',     'Green',     'eva@email.com',     'hashed_pw_5',  'Employer',     'New York',    'NY'),
('Frank',   'Reed',      'frank@email.com',   'hashed_pw_6',  'Junior',       'New York',    'NY'),

-- Admin super user
('Admin',   'Root',      'admin@tradeconnect.com', 'hashed_pw_admin', 'Admin', 'New York',   'NY'),

-- 3 new employers
('Grace',   'Hopper',    'grace@email.com',   'hashed_pw_8',  'Employer',     'Jersey City', 'NJ'),
('Henry',   'Ford',      'henry@email.com',   'hashed_pw_9',  'Employer',     'Newark',      'NJ'),
('Isabel',  'Martinez',  'isabel@email.com',  'hashed_pw_10', 'Employer',     'Brooklyn',    'NY'),

-- 3 new senior tradespeople
('Jack',    'Wilson',    'jack@email.com',    'hashed_pw_11', 'Tradesperson', 'Jersey City', 'NJ'),
('Karen',   'Davis',     'karen@email.com',   'hashed_pw_12', 'Tradesperson', 'Newark',      'NJ'),
('Liam',    'Nguyen',    'liam@email.com',    'hashed_pw_13', 'Tradesperson', 'Brooklyn',    'NY'),

-- 3 new juniors (will request endorsement from Jack, Karen, Liam respectively)
('Mia',     'Patel',     'mia@email.com',     'hashed_pw_14', 'Junior',       'Jersey City', 'NJ'),
('Noah',    'Garcia',    'noah@email.com',    'hashed_pw_15', 'Junior',       'Newark',      'NJ'),
('Olivia',  'Kim',       'olivia@email.com',  'hashed_pw_16', 'Junior',       'Brooklyn',    'NY');


-- ─────────────────────────────────────────────
-- TRADESPEOPLE
-- David and Frank start with endorse_id = NULL.
-- David will be approved further down via endorsement_requests
-- (which triggers Trigger 6 to set endorse_id automatically).
-- Frank stays pending so we have an example of a pending request.
--
-- The three new seniors (Jack, Karen, Liam) come in verified.
-- The three new juniors (Mia, Noah, Olivia) come in pending
-- with endorse_id = NULL; we approve them in bulk below.
-- ─────────────────────────────────────────────
INSERT INTO tradespeople (user_id, trade_category, experience_year, endorse_id, is_verified)
VALUES
(2,  'Plumbing',   5, NULL, TRUE),   -- Bob       (tradesperson_id = 1)
(3,  'Electrical', 4, NULL, TRUE),   -- Charlie   (tradesperson_id = 2)
(4,  'Plumbing',   1, NULL, FALSE),  -- David     (tradesperson_id = 3, will be approved by Bob)
(6,  'Electrical', 1, NULL, FALSE),  -- Frank     (tradesperson_id = 4, pending under Charlie)
(11, 'Plumbing',   6, NULL, TRUE),   -- Jack      (tradesperson_id = 5)
(12, 'Electrical', 5, NULL, TRUE),   -- Karen     (tradesperson_id = 6)
(13, 'Carpentry',  7, NULL, TRUE),   -- Liam      (tradesperson_id = 7)
(14, 'Plumbing',   1, NULL, FALSE),  -- Mia       (tradesperson_id = 8, will be approved by Jack)
(15, 'Electrical', 1, NULL, FALSE),  -- Noah      (tradesperson_id = 9, will be approved by Karen)
(16, 'Carpentry',  1, NULL, FALSE);  -- Olivia    (tradesperson_id = 10, will be approved by Liam)


-- ─────────────────────────────────────────────
-- SERVICES
-- ─────────────────────────────────────────────
INSERT INTO services (tradesperson_id, service_name, description, hourly_rate, trade_type)
VALUES
(1, 'Pipe Repair',     'Fix leaking or broken pipes',  60.00, 'Plumbing'),
(1, 'Drain Cleaning',  'Unclog drains and pipes',      50.00, 'Plumbing'),
(2, 'Wiring',          'Electrical wiring installation', 70.00, 'Electrical'),
(2, 'Outlet Install',  'Install new outlets',           55.00, 'Electrical'),
(3, 'Apprentice Plumbing Help', 'Assisting on plumbing jobs', 30.00, 'Plumbing'),

-- Services for the new senior tradespeople
(5, 'Water Heater Install',  'Install gas or electric water heaters',  90.00, 'Plumbing'),
(5, 'Pipe Repair',           'General pipe repair work',               65.00, 'Plumbing'),
(6, 'Panel Upgrade',         'Upgrade household electrical panels',   110.00, 'Electrical'),
(6, 'Outlet Install',         'Install new outlets',                   60.00, 'Electrical'),
(7, 'Deck Building',         'Build wooden decks and patios',          75.00, 'Carpentry'),
(7, 'Cabinet Installation',  'Install kitchen and bath cabinets',      70.00, 'Carpentry'),

-- Apprentice services for the new juniors
(8,  'Apprentice Plumbing Help',   'Assisting on plumbing jobs',   30.00, 'Plumbing'),
(9,  'Apprentice Electrical Help', 'Assisting on electrical jobs', 32.00, 'Electrical'),
(10, 'Apprentice Carpentry Help',  'Assisting on carpentry jobs',  30.00, 'Carpentry');


-- ─────────────────────────────────────────────
-- ENDORSEMENT REQUESTS
-- David → Bob       (approved — sets David.endorse_id = 1 via Trigger 6)
-- Frank → Charlie   (still pending — for testing the senior's inbox)
-- ─────────────────────────────────────────────
INSERT INTO endorsement_requests
    (junior_tradesperson_id, supervisor_tradesperson_id, message, status)
VALUES
(3,  1, 'I would like to apprentice under you for plumbing.',   'pending'),
(4,  2, 'Hi Charlie, I would like your endorsement to start taking electrical jobs.', 'pending'),
(8,  5, 'Hi Jack, please consider endorsing me for plumbing jobs.',    'pending'),
(9,  6, 'Hi Karen, please consider endorsing me for electrical jobs.', 'pending'),
(10, 7, 'Hi Liam, please consider endorsing me for carpentry jobs.',   'pending');

-- Approve David's request (Trigger 6 will set David's endorse_id = 1)
UPDATE endorsement_requests
   SET status        = 'approved',
       decision_note = 'Welcome aboard, David.'
 WHERE junior_tradesperson_id = 3
   AND supervisor_tradesperson_id = 1;

-- Approve the three new juniors so they can take jobs in their cities.
UPDATE endorsement_requests
   SET status        = 'approved',
       decision_note = 'Approved.'
 WHERE junior_tradesperson_id IN (8, 9, 10)
   AND status = 'pending';

-- Also verify David and the three new juniors now.
UPDATE tradespeople SET is_verified = TRUE WHERE tradesperson_id IN (3, 8, 9, 10);


-- ─────────────────────────────────────────────
-- JOB POSTINGS
-- ─────────────────────────────────────────────
INSERT INTO job_postings
    (employer_id, title, description, trade_type, city, address,
     budget_min, budget_max, scheduled_at, status)
VALUES
(1, 'Kitchen sink leak',
    'Sink under the kitchen counter has been dripping for two days. Looking for a plumber asap.',
    'Plumbing', 'New York', '123 Main St',
    80.00, 150.00, '2026-05-20 10:00:00', 'open'),

(5, 'Replace 6 outlets',
    'Need 6 old outlets swapped for tamper-resistant ones in a 2-bedroom apartment.',
    'Electrical', 'New York', '456 Park Ave',
    200.00, 400.00, '2026-05-22 14:00:00', 'open'),

(1, 'Bathroom drain unclog',
    'Bathroom sink draining very slowly.',
    'Plumbing', 'New York', '123 Main St',
    50.00, 120.00, '2026-05-18 09:00:00', 'open');


-- ─────────────────────────────────────────────
-- JOB APPLICATIONS
-- Posting 1 (Alice's kitchen leak):
--   - Bob applies, $120
--   - David (now-approved junior) applies, $90
-- Posting 2 (Eva's outlets):
--   - Charlie applies, $300  → we'll accept this further down
--   - Bob applies (wrong trade, but to show variety), $350
-- Posting 3 (Alice's bathroom drain):
--   - Bob applies, $80
-- ─────────────────────────────────────────────
INSERT INTO job_applications
    (job_posting_id, tradesperson_id, service_id, proposed_price, message, status)
VALUES
(1, 1, 1, 120.00, 'I can come by tomorrow morning.', 'pending'),
(1, 3, 5,  90.00, 'I am working under Bob; happy to help with this one.', 'pending'),

(2, 2, 3, 300.00, 'All 6 outlets, including tamper-resistant ones, parts included.', 'pending'),
(2, 1, 1, 350.00, 'I can recommend a colleague if needed.', 'pending'),

(3, 1, 2,  80.00, 'Drain cleaning is my specialty.', 'pending');


-- Accept Charlie's application on posting 2.
-- Trigger 7 will:
--   - create a row in bookings
--   - mark posting 2 as 'filled'
-- The cascading "reject the competing applications" step is done
-- here explicitly (the trigger can't modify its own table; the
-- backend's accept endpoint does this in the same transaction).
UPDATE job_applications
   SET status     = 'accepted',
       decided_at = CURRENT_TIMESTAMP
 WHERE job_posting_id = 2
   AND tradesperson_id = 2;

UPDATE job_applications
   SET status     = 'rejected',
       decided_at = CURRENT_TIMESTAMP
 WHERE job_posting_id = 2
   AND status = 'pending';


-- ─────────────────────────────────────────────
-- DIRECT BOOKING (the existing "Book now" flow still works)
-- Alice books Bob for pipe repair directly (no posting involved).
-- application_id stays NULL — that's how we tell direct bookings
-- apart from posting-driven ones.
-- ─────────────────────────────────────────────
INSERT INTO bookings
    (user_id, tradesperson_id, service_id, application_id,
     scheduled_at, status, city, address, quoted_price)
VALUES
(1, 1, 1, NULL, '2026-04-20 10:00:00', 'accepted', 'New York', '123 Main St', 120.00);


-- ─────────────────────────────────────────────
-- PAYMENTS for the existing bookings
-- ─────────────────────────────────────────────
INSERT INTO payments (booking_id, amount, method, status)
SELECT booking_id, quoted_price, 'card', 'pending' FROM bookings;


-- ─────────────────────────────────────────────
-- Mark the direct booking complete to test reviews end-to-end.
-- Trigger 3 will create a review_request.
-- ─────────────────────────────────────────────
UPDATE bookings
   SET status = 'completed'
 WHERE application_id IS NULL
 LIMIT 1;


-- ─────────────────────────────────────────────
-- A submitted review (will fire Trigger 4 + Trigger 5).
-- ─────────────────────────────────────────────
INSERT INTO reviews (booking_id, reviewer_user_id, tradesperson_id, rating, comment)
SELECT b.booking_id, b.user_id, b.tradesperson_id, 5, 'Great service, very professional!'
  FROM bookings b
 WHERE b.status = 'completed'
 LIMIT 1;


-- ─────────────────────────────────────────────
-- REVENUE STREAMS  (catalog)
-- ─────────────────────────────────────────────
INSERT INTO revenue_streams (stream_name, description, is_active) VALUES
('Service Fee',        '10% commission on each completed booking', TRUE),
('Featured Listing',   'Tradesperson paid to appear at the top of search', TRUE),
('Cancellation Fee',   'Charged to the cancelling party', TRUE),
('Subscription',       'Monthly subscription revenue', TRUE);


-- Mark the completed booking as paid, then create the 10% platform-fee
-- revenue row tied to the Service Fee revenue stream.
UPDATE payments p
JOIN bookings b ON b.booking_id = p.booking_id
   SET p.status = 'paid',
       p.paid_at = CURRENT_TIMESTAMP
 WHERE b.status = 'completed';

INSERT INTO platform_fees (payment_id, revenue_stream_id, fee_amount, fee_percentage)
SELECT p.payment_id, rs.revenue_stream_id, ROUND(p.amount * 0.10, 2), 10.00
  FROM payments p
  JOIN bookings b ON b.booking_id = p.booking_id
  JOIN revenue_streams rs ON rs.stream_name = 'Service Fee'
 WHERE b.status = 'completed'
 LIMIT 1;


-- ─────────────────────────────────────────────
-- SUBSCRIPTION PLANS — catalog seed.
-- ─────────────────────────────────────────────
INSERT INTO subscription_plans (plan_name, description, monthly_price, job_limit, is_active) VALUES
('Free',  'Starter plan: up to 5 active jobs.',    0.00,  5, TRUE),
('Pro',   'Pro plan: up to 20 active jobs.',      19.99, 20, TRUE),
('Elite', 'Elite plan: up to 50 active jobs.',    49.99, 50, TRUE);

-- ─────────────────────────────────────────────
-- SUBSCRIPTIONS — each subscriber FKs to the plan
-- and snapshots the price they paid at activation.
-- ─────────────────────────────────────────────
INSERT INTO subscriptions (tradesperson_id, plan_id, price_at_purchase, status, start_date)
SELECT 1, plan_id, monthly_price, 'active', '2026-01-15'
  FROM subscription_plans WHERE plan_name = 'Pro';

INSERT INTO subscriptions (tradesperson_id, plan_id, price_at_purchase, status, start_date)
SELECT 2, plan_id, monthly_price, 'active', '2026-02-01'
  FROM subscription_plans WHERE plan_name = 'Elite';


-- ─────────────────────────────────────────────
-- PLATFORM SETTINGS — single row, edited by the admin.
-- The platform service fee percentage is stored here so the
-- admin can change it at runtime without re-deploying.
-- ─────────────────────────────────────────────
INSERT INTO platform_settings (setting_id, platform_fee_percentage)
VALUES (1, 10.00);

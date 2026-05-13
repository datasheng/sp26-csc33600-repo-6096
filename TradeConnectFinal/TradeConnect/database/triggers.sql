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
DROP TRIGGER IF EXISTS prevent_out_of_city_booking;
DROP TRIGGER IF EXISTS prevent_out_of_city_booking_update;

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

-- ─────────────────────────────────────────────────────────────
-- A tradesperson cannot accept a job that is not in their city.
-- Compares the booking's city to the tradesperson's user.city.
-- If either side is NULL we don't block — geography unknown.
-- ─────────────────────────────────────────────────────────────
CREATE TRIGGER prevent_out_of_city_booking
BEFORE INSERT ON bookings
FOR EACH ROW
BEGIN
    DECLARE v_tp_city VARCHAR(100);

    IF NEW.city IS NOT NULL THEN
        SELECT u.city
          INTO v_tp_city
          FROM tradespeople t
          JOIN users u ON u.user_id = t.user_id
         WHERE t.tradesperson_id = NEW.tradesperson_id;

        IF v_tp_city IS NOT NULL AND v_tp_city <> NEW.city THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Tradesperson cannot accept a job outside their city';
        END IF;
    END IF;
END$$

CREATE TRIGGER prevent_out_of_city_booking_update
BEFORE UPDATE ON bookings
FOR EACH ROW
BEGIN
    DECLARE v_tp_city VARCHAR(100);

    IF NEW.city IS NOT NULL
       AND (NEW.tradesperson_id <> OLD.tradesperson_id
            OR IFNULL(NEW.city,'') <> IFNULL(OLD.city,''))
    THEN
        SELECT u.city
          INTO v_tp_city
          FROM tradespeople t
          JOIN users u ON u.user_id = t.user_id
         WHERE t.tradesperson_id = NEW.tradesperson_id;

        IF v_tp_city IS NOT NULL AND v_tp_city <> NEW.city THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Tradesperson cannot accept a job outside their city';
        END IF;
    END IF;
END$$

DELIMITER ;

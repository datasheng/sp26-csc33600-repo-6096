-- =============================================
-- TRIGGER 1
-- Prevent junior/apprentice from booking jobs alone
-- If endorse_id is NOT NULL → junior → block booking
-- =============================================
DELIMITER $$

CREATE TRIGGER prevent_junior_booking
BEFORE INSERT ON bookings
FOR EACH ROW
BEGIN
    DECLARE supervisor_id INT;

    SELECT endorse_id
    INTO supervisor_id
    FROM tradespeople
    WHERE tradesperson_id = NEW.tradesperson_id;

    IF supervisor_id IS NOT NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Junior/apprentice cannot book a job without a supervisor';
    END IF;
END$$

DELIMITER ;

-- =============================================
-- TRIGGER 2
-- Prevent updating booking to a junior tradesperson
-- =============================================
DELIMITER $$

CREATE TRIGGER prevent_junior_booking_update
BEFORE UPDATE ON bookings
FOR EACH ROW
BEGIN
    DECLARE supervisor_id INT;

    SELECT endorse_id
    INTO supervisor_id
    FROM tradespeople
    WHERE tradesperson_id = NEW.tradesperson_id;

    IF supervisor_id IS NOT NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Junior/apprentice cannot book a job without a supervisor';
    END IF;
END$$


-- =============================================
-- TRIGGER 3
-- Automatically create a review request when booking is completed
-- =============================================
CREATE TRIGGER create_review_request_after_completion
AFTER UPDATE ON bookings
FOR EACH ROW
BEGIN
    IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
        INSERT IGNORE INTO review_requests (
            booking_id,
            employer_id,
            tradesperson_id,
            status
        )
        VALUES (
            NEW.booking_id,
            NEW.user_id,
            NEW.tradesperson_id,
            'pending'
        );
    END IF;
END$$

-- =============================================
-- TRIGGER 4
-- When a review is inserted, mark request submitted
-- =============================================
CREATE TRIGGER mark_review_request_submitted
AFTER INSERT ON reviews
FOR EACH ROW
BEGIN
    UPDATE review_requests
    SET status = 'submitted',
        submitted_at = CURRENT_TIMESTAMP
    WHERE booking_id = NEW.booking_id;
END$$

-- =============================================
-- TRIGGER 5
-- Recalculate avg rating after a new review
-- =============================================
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

DELIMITER ;

INSERT INTO bookings (user_id, tradesperson_id, service_id, scheduled_at, status, city, address, quoted_price)
VALUES
-- Tradesperson 2 (Alice, NY) servicing NY employers
(3, 2, 3, '2026-01-15 10:00:00', 'completed', 'New York', '123 Main St', 250.00),
(7, 2, 4, '2026-01-22 14:00:00', 'completed', 'New York', '456 Oak Ave', 180.00),
(3, 2, 3, '2026-02-10 11:00:00', 'completed', 'New York', '321 Elm St', 200.00),
-- Tradesperson 5 (Henry, Newark) servicing Newark
(11, 5, 6, '2026-02-18 13:00:00', 'completed', 'Newark', '654 Maple Ave', 450.00),
(11, 5, 7, '2026-03-12 15:00:00', 'completed', 'Newark', '222 Second Ave', 380.00),
-- Tradesperson 6 (Isabel, Brooklyn) servicing Brooklyn
(12, 6, 8, '2026-03-05 10:00:00', 'completed', 'Brooklyn', '111 First St', 275.00),
(12, 6, 9, '2026-03-20 09:00:00', 'completed', 'Brooklyn', '333 Third St', 510.00),
-- Tradesperson 7 (Jack, Jersey City) servicing JC
(10, 7, 10, '2026-04-02 11:00:00', 'completed', 'Jersey City', '444 Fourth Ave', 320.00),
(10, 7, 11, '2026-04-15 14:00:00', 'completed', 'Jersey City', '555 Fifth St', 290.00),
-- More recent ones for trend visualization
(3, 2, 3, '2026-05-01 10:00:00', 'completed', 'New York', '666 Sixth St', 240.00),
(11, 5, 7, '2026-05-05 13:00:00', 'completed', 'Newark', '777 Seventh Ave', 360.00),
(12, 6, 8, '2026-05-08 09:00:00', 'completed', 'Brooklyn', '888 Eighth St', 480.00);

INSERT INTO payments (booking_id, amount, method, status, paid_at)
SELECT booking_id, quoted_price, 
  CASE booking_id % 3 WHEN 0 THEN 'card' WHEN 1 THEN 'online' ELSE 'cash' END,
  'paid', scheduled_at
FROM bookings
WHERE status = 'completed' AND booking_id NOT IN (SELECT booking_id FROM payments);

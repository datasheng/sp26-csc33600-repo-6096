"""
/api/bookings — the biggest blueprint.

Returns enriched data (service name, other-party name, payment status)
because that's what the UI cards display in one shot.

Permissions:
 - GET    /api/bookings              - any logged-in user, scoped to their role
 - GET    /api/bookings/<id>         - employer who booked OR tradesperson assigned
 - POST   /api/bookings              - Employer only
 - PATCH  /api/bookings/<id>/status  - Tradesperson assigned OR Employer (cancel only)
"""
from flask import Blueprint, request, jsonify
from routes._helpers import (
    get_db, login_required, current_user_id, current_user_type,
    get_tradesperson_id_for_user, iso,
)

bookings = Blueprint('bookings', __name__)

ALL_STATUSES = {'pending', 'accepted', 'in_progress', 'completed', 'cancelled'}


def _booking_with_details(row):
    """Shape the enriched JOIN row to what the frontend expects."""
    return {
        'booking_id':      row['booking_id'],
        'user_id':         row['user_id'],            # employer
        'tradesperson_id': row['tradesperson_id'],
        'service_id':      row['service_id'],
        'application_id':  row.get('application_id'), # NULL = direct booking
        'scheduled_at':    iso(row['scheduled_at']),
        'status':          row['status'],
        'city':            row.get('city'),
        'address':         row.get('address'),
        'quoted_price':    float(row['quoted_price']) if row.get('quoted_price') is not None else None,
        'created_at':      iso(row.get('created_at')),
        # joined display fields
        'service_name':    row.get('service_name'),
        'employer_name':   f"{row.get('employer_first','')} {row.get('employer_last','')}".strip(),
        'tradesperson_name': f"{row.get('tp_first','')} {row.get('tp_last','')}".strip(),
        'payment_status':  row.get('payment_status') or 'pending',
        'payment_amount':  float(row['payment_amount']) if row.get('payment_amount') is not None else None,
        'platform_fee_amount': float(row['platform_fee_amount']) if row.get('platform_fee_amount') is not None else None,
        'platform_fee_percentage': float(row['platform_fee_percentage']) if row.get('platform_fee_percentage') is not None else None,
        'tradesperson_payout': float(row['tradesperson_payout']) if row.get('tradesperson_payout') is not None else None,
        # Whether the employer has already submitted a review for this booking.
        # The UI hides the "Leave a review" button when this is true.
        'has_review':      bool(row.get('review_id')),
    }


# ────────────────────────────────────────────────────────────
# GET /api/bookings
#   - Employer  → bookings WHERE bookings.user_id = me
#   - Tradesperson/Junior → bookings WHERE bookings.tradesperson_id = my tp_id
#   - Optional ?status=pending  filter
# ────────────────────────────────────────────────────────────
@bookings.route('', methods=['GET'])
@bookings.route('/', methods=['GET'])
@login_required
def list_bookings():
    user_id   = current_user_id()
    user_type = current_user_type()
    status    = request.args.get('status')

    db = get_db()
    cursor = db.cursor(dictionary=True)

    base_sql = """
        SELECT b.*,
               s.service_name,
               eu.first_name AS employer_first, eu.last_name AS employer_last,
               tu.first_name AS tp_first,       tu.last_name AS tp_last,
               p.status AS payment_status,
               p.amount AS payment_amount,
               pf.fee_amount AS platform_fee_amount,
               pf.fee_percentage AS platform_fee_percentage,
               r.review_id,
               CASE
                   WHEN p.amount IS NOT NULL AND pf.fee_amount IS NOT NULL
                   THEN p.amount - pf.fee_amount
                   ELSE NULL
               END AS tradesperson_payout
        FROM bookings b
        JOIN services s   ON s.service_id = b.service_id
        JOIN users    eu  ON eu.user_id   = b.user_id
        JOIN tradespeople t ON t.tradesperson_id = b.tradesperson_id
        JOIN users    tu  ON tu.user_id   = t.user_id
        LEFT JOIN payments p ON p.booking_id = b.booking_id
        LEFT JOIN platform_fees pf ON pf.payment_id = p.payment_id
        LEFT JOIN reviews r ON r.booking_id = b.booking_id
    """

    if user_type == 'Employer':
        sql = base_sql + " WHERE b.user_id = %s"
        params = [user_id]
    elif user_type in ('Tradesperson', 'Junior'):
        tp_id = get_tradesperson_id_for_user(cursor, user_id)
        if not tp_id:
            cursor.close(); db.close()
            return jsonify({'bookings': []}), 200
        sql = base_sql + " WHERE b.tradesperson_id = %s"
        params = [tp_id]
    else:
        cursor.close(); db.close()
        return jsonify({'bookings': []}), 200

    if status and status in ALL_STATUSES:
        sql += " AND b.status = %s"
        params.append(status)

    sql += " ORDER BY b.scheduled_at DESC"

    cursor.execute(sql, params)
    rows = cursor.fetchall()
    cursor.close(); db.close()

    return jsonify({'bookings': [_booking_with_details(r) for r in rows]}), 200


# ────────────────────────────────────────────────────────────
# GET /api/bookings/<id>
# ────────────────────────────────────────────────────────────
@bookings.route('/<int:booking_id>', methods=['GET'])
@login_required
def get_one(booking_id):
    user_id   = current_user_id()
    user_type = current_user_type()

    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT b.*,
                  s.service_name,
                  eu.first_name AS employer_first, eu.last_name AS employer_last,
                  tu.first_name AS tp_first,       tu.last_name AS tp_last,
                  p.status AS payment_status,
                  p.amount AS payment_amount,
                  pf.fee_amount AS platform_fee_amount,
                  pf.fee_percentage AS platform_fee_percentage,
                  r.review_id,
                  CASE
                      WHEN p.amount IS NOT NULL AND pf.fee_amount IS NOT NULL
                      THEN p.amount - pf.fee_amount
                      ELSE NULL
                  END AS tradesperson_payout
           FROM bookings b
           JOIN services s   ON s.service_id = b.service_id
           JOIN users    eu  ON eu.user_id   = b.user_id
           JOIN tradespeople t ON t.tradesperson_id = b.tradesperson_id
           JOIN users    tu  ON tu.user_id   = t.user_id
           LEFT JOIN payments p ON p.booking_id = b.booking_id
           LEFT JOIN platform_fees pf ON pf.payment_id = p.payment_id
           LEFT JOIN reviews r ON r.booking_id = b.booking_id
           WHERE b.booking_id = %s""",
        (booking_id,),
    )
    row = cursor.fetchone()

    if not row:
        cursor.close(); db.close()
        return jsonify({'error': 'Booking not found'}), 404

    # Authorize
    is_employer_owner    = row['user_id'] == user_id
    tp_id = get_tradesperson_id_for_user(cursor, user_id)
    is_assigned_tp = tp_id is not None and row['tradesperson_id'] == tp_id

    cursor.close(); db.close()

    if not (is_employer_owner or is_assigned_tp):
        return jsonify({'error': 'Forbidden'}), 403

    return jsonify({'booking': _booking_with_details(row)}), 200


# ────────────────────────────────────────────────────────────
# POST /api/bookings — Employer creates
# Body: { tradesperson_id, service_id, scheduled_at, address, city }
# ────────────────────────────────────────────────────────────
@bookings.route('', methods=['POST'])
@bookings.route('/', methods=['POST'])
@login_required
def create():
    if current_user_type() != 'Employer':
        return jsonify({'error': 'Only employers can create bookings'}), 403

    data = request.get_json(force=True)
    tp_id        = data.get('tradesperson_id')
    service_id   = data.get('service_id')
    scheduled_at = data.get('scheduled_at')   # 'YYYY-MM-DD HH:MM:SS' or ISO
    address      = data.get('address', '')
    city         = data.get('city', '')
    quoted_price = data.get('quoted_price')

    if not (tp_id and service_id and scheduled_at):
        return jsonify({'error': 'tradesperson_id, service_id, scheduled_at are required'}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True)

    # Verify the service belongs to this tradesperson
    cursor.execute(
        "SELECT hourly_rate FROM services WHERE service_id = %s AND tradesperson_id = %s",
        (service_id, tp_id),
    )
    svc = cursor.fetchone()
    if not svc:
        cursor.close(); db.close()
        return jsonify({'error': 'Service does not belong to that tradesperson'}), 400

    # If quoted_price not provided, default to hourly_rate
    if quoted_price is None:
        quoted_price = svc.get('hourly_rate')

    try:
        cursor.execute(
            """INSERT INTO bookings
               (user_id, tradesperson_id, service_id, scheduled_at, status,
                city, address, quoted_price)
               VALUES (%s, %s, %s, %s, 'pending', %s, %s, %s)""",
            (current_user_id(), tp_id, service_id, scheduled_at,
             city, address, quoted_price),
        )
        db.commit()
        new_id = cursor.lastrowid
    except Exception as e:
        # Trigger 1 may raise: Junior cannot take a job without an approved supervisor
        cursor.close(); db.close()
        return jsonify({'error': str(e)}), 400

    cursor.close(); db.close()
    return jsonify({'message': 'Booking created', 'booking_id': new_id}), 201


# ────────────────────────────────────────────────────────────
# PATCH /api/bookings/<id>/status
# Body: { status: 'accepted' | 'in_progress' | 'completed' | 'cancelled' }
# ────────────────────────────────────────────────────────────
@bookings.route('/<int:booking_id>/status', methods=['PATCH'])
@login_required
def update_status(booking_id):
    data   = request.get_json(force=True)
    status = data.get('status')

    if status not in ALL_STATUSES:
        return jsonify({'error': f'status must be one of {sorted(ALL_STATUSES)}'}), 400

    user_id   = current_user_id()
    user_type = current_user_type()

    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        "SELECT user_id, tradesperson_id, status FROM bookings WHERE booking_id = %s",
        (booking_id,),
    )
    row = cursor.fetchone()
    if not row:
        cursor.close(); db.close()
        return jsonify({'error': 'Booking not found'}), 404

    # Authorize:
    # - Employer who owns the booking can cancel it
    # - Tradesperson assigned can move accepted/in_progress/completed
    if user_type == 'Employer':
        if row['user_id'] != user_id:
            cursor.close(); db.close()
            return jsonify({'error': 'Forbidden'}), 403
        if status != 'cancelled':
            cursor.close(); db.close()
            return jsonify({'error': 'Employers can only cancel'}), 403
    elif user_type in ('Tradesperson', 'Junior'):
        tp_id = get_tradesperson_id_for_user(cursor, user_id)
        if tp_id != row['tradesperson_id']:
            cursor.close(); db.close()
            return jsonify({'error': 'Forbidden'}), 403
        if status not in ('accepted', 'in_progress', 'completed', 'cancelled'):
            cursor.close(); db.close()
            return jsonify({'error': 'Invalid transition'}), 400
    else:
        cursor.close(); db.close()
        return jsonify({'error': 'Forbidden'}), 403

    try:
        cursor.execute(
            "UPDATE bookings SET status = %s WHERE booking_id = %s",
            (status, booking_id),
        )
        db.commit()
    except Exception as e:
        # Trigger 2 may raise on certain updates
        cursor.close(); db.close()
        return jsonify({'error': str(e)}), 400

    cursor.close(); db.close()
    # NOTE: Trigger 3 will auto-create a review_request when status -> 'completed'.
    return jsonify({'message': f'Booking moved to {status}'}), 200

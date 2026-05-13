"""
/api/payments — record a payment for a booking, fetch payment + platform-fee details.

Revenue model: TradeConnect earns a fixed platform service fee percentage
from each paid booking. The backend calculates the fee so the frontend cannot
manipulate business revenue rules.
"""
from decimal import Decimal, ROUND_HALF_UP
from flask import Blueprint, request, jsonify
from routes._helpers import (
    get_db, login_required, current_user_id, current_user_type, iso,
)

payments = Blueprint('payments', __name__)

METHODS = {'card', 'cash', 'online'}
DEFAULT_PLATFORM_FEE_PERCENTAGE = Decimal('10.00')
SERVICE_FEE_STREAM_NAME = 'Service Fee'


def _money(value):
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def _get_platform_fee_percentage(cursor):
    """Read the current platform service fee percentage from platform_settings.
    Falls back to the default if the row is missing (older DBs).
    """
    cursor.execute(
        "SELECT platform_fee_percentage FROM platform_settings WHERE setting_id = 1"
    )
    row = cursor.fetchone()
    if not row:
        return DEFAULT_PLATFORM_FEE_PERCENTAGE
    # Cursor may be dict or tuple style
    val = row['platform_fee_percentage'] if isinstance(row, dict) else row[0]
    return Decimal(str(val))


def _serialize(p):
    amount = _money(p['amount'])
    fee_amount = p.get('fee_amount')
    fee_percentage = p.get('fee_percentage')
    return {
        'payment_id': p['payment_id'],
        'booking_id': p['booking_id'],
        'amount': float(amount),
        'method': p['method'],
        'status': p['status'],
        'paid_at': iso(p.get('paid_at')),
        'platform_fee_amount': float(fee_amount) if fee_amount is not None else None,
        'platform_fee_percentage': float(fee_percentage) if fee_percentage is not None else None,
        'tradesperson_payout': float(amount - _money(fee_amount)) if fee_amount is not None else None,
    }


def _get_or_create_service_fee_stream(cursor):
    cursor.execute(
        "SELECT revenue_stream_id FROM revenue_streams WHERE stream_name = %s LIMIT 1",
        (SERVICE_FEE_STREAM_NAME,),
    )
    row = cursor.fetchone()
    if row:
        return row['revenue_stream_id']

    cursor.execute(
        """INSERT INTO revenue_streams (stream_name, description, is_active)
           VALUES (%s, %s, TRUE)""",
        (SERVICE_FEE_STREAM_NAME, '10% commission on each completed booking'),
    )
    return cursor.lastrowid


def _upsert_platform_fee(cursor, payment_id, amount):
    stream_id = _get_or_create_service_fee_stream(cursor)
    pct = _get_platform_fee_percentage(cursor)
    fee_amount = (amount * (pct / Decimal('100'))).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )

    cursor.execute(
        "SELECT platform_fee_id FROM platform_fees WHERE payment_id = %s",
        (payment_id,),
    )
    existing = cursor.fetchone()
    if existing:
        cursor.execute(
            """UPDATE platform_fees
                  SET revenue_stream_id=%s, fee_amount=%s, fee_percentage=%s
                WHERE payment_id=%s""",
            (stream_id, fee_amount, pct, payment_id),
        )
    else:
        cursor.execute(
            """INSERT INTO platform_fees
                  (payment_id, revenue_stream_id, fee_amount, fee_percentage)
                VALUES (%s, %s, %s, %s)""",
            (payment_id, stream_id, fee_amount, pct),
        )

    return fee_amount


@payments.route('/booking/<int:booking_id>', methods=['GET'])
@login_required
def get_for_booking(booking_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT p.*, pf.fee_amount, pf.fee_percentage
             FROM payments p
             LEFT JOIN platform_fees pf ON pf.payment_id = p.payment_id
            WHERE p.booking_id = %s""",
        (booking_id,),
    )
    row = cursor.fetchone()
    cursor.close(); db.close()

    if not row:
        return jsonify({'payment': None}), 200
    return jsonify({'payment': _serialize(row)}), 200


# POST /api/payments — Employer pays
# Body: { booking_id, amount, method }
@payments.route('', methods=['POST'])
@payments.route('/', methods=['POST'])
@login_required
def create():
    if current_user_type() != 'Employer':
        return jsonify({'error': 'Only employers can record payments'}), 403

    data = request.get_json(force=True)
    booking_id = data.get('booking_id')
    method = data.get('method')

    try:
        amount = _money(data.get('amount'))
    except Exception:
        return jsonify({'error': 'amount must be a valid number'}), 400

    if not booking_id or amount <= 0 or method not in METHODS:
        return jsonify({'error': 'booking_id, positive amount, and valid method required'}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute(
            "SELECT user_id, status FROM bookings WHERE booking_id = %s",
            (booking_id,),
        )
        row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Booking not found'}), 404
        if row['user_id'] != current_user_id():
            return jsonify({'error': 'Forbidden'}), 403
        if row['status'] != 'completed':
            return jsonify({'error': 'Booking must be completed before payment'}), 400

        cursor.execute("SELECT payment_id FROM payments WHERE booking_id = %s", (booking_id,))
        existing = cursor.fetchone()

        if existing:
            payment_id = existing['payment_id']
            cursor.execute(
                """UPDATE payments
                      SET amount=%s, method=%s, status='paid', paid_at=CURRENT_TIMESTAMP
                    WHERE payment_id=%s""",
                (amount, method, payment_id),
            )
        else:
            cursor.execute(
                """INSERT INTO payments (booking_id, amount, method, status, paid_at)
                   VALUES (%s, %s, %s, 'paid', CURRENT_TIMESTAMP)""",
                (booking_id, amount, method),
            )
            payment_id = cursor.lastrowid

        fee_amount = _upsert_platform_fee(cursor, payment_id, amount)
        db.commit()
    except Exception as e:
        db.rollback()
        cursor.close(); db.close()
        return jsonify({'error': str(e)}), 400

    cursor.close(); db.close()
    return jsonify({
        'message': 'Payment recorded',
        'payment_id': payment_id,
        'platform_fee_amount': float(fee_amount),
        'tradesperson_payout': float(amount - fee_amount),
    }), 201

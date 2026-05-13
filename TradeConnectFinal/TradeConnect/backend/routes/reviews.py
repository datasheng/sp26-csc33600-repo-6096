"""
/api/reviews — list, pending requests, submit.

Triggers 3, 4, 5 in the database handle auto-creation of review_requests
on booking completion, marking them submitted, and recalculating avg_rating.
The route just inserts into reviews and lets the DB do the rest.
"""
from flask import Blueprint, request, jsonify
from routes._helpers import (
    get_db, login_required, current_user_id, current_user_type,
    get_tradesperson_id_for_user, iso,
)

reviews = Blueprint('reviews', __name__)


def _serialize_review(r):
    return {
        'review_id':        r['review_id'],
        'booking_id':       r['booking_id'],
        'reviewer_user_id': r['reviewer_user_id'],
        'tradesperson_id':  r['tradesperson_id'],
        'rating':           r['rating'],
        'comment':          r.get('comment'),
        'created_at':       iso(r.get('created_at')),
        'tradesperson_name': f"{r.get('tp_first','')} {r.get('tp_last','')}".strip() or None,
        'reviewer_name':    f"{r.get('rev_first','')} {r.get('rev_last','')}".strip() or None,
    }


def _serialize_request(rr):
    return {
        'review_request_id': rr['review_request_id'],
        'booking_id':        rr['booking_id'],
        'employer_id':       rr['employer_id'],
        'tradesperson_id':   rr['tradesperson_id'],
        'status':            rr['status'],
        'created_at':        iso(rr.get('created_at')),
        'submitted_at':      iso(rr.get('submitted_at')),
        # joined display
        'tradesperson_name': f"{rr.get('tp_first','')} {rr.get('tp_last','')}".strip() or None,
        'service_name':      rr.get('service_name'),
    }


# ────────────────────────────────────────────────────────────
# GET /api/reviews/tradesperson/<id>
# Public — anyone can read a tradesperson's review history.
# ────────────────────────────────────────────────────────────
@reviews.route('/tradesperson/<int:tp_id>', methods=['GET'])
def for_tradesperson(tp_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT r.*,
                  ru.first_name AS rev_first, ru.last_name AS rev_last,
                  tu.first_name AS tp_first,  tu.last_name AS tp_last
           FROM reviews r
           JOIN users ru ON ru.user_id = r.reviewer_user_id
           JOIN tradespeople t ON t.tradesperson_id = r.tradesperson_id
           JOIN users tu ON tu.user_id = t.user_id
           WHERE r.tradesperson_id = %s
           ORDER BY r.created_at DESC""",
        (tp_id,),
    )
    rows = cursor.fetchall()
    cursor.close(); db.close()
    return jsonify({'reviews': [_serialize_review(r) for r in rows]}), 200


# ────────────────────────────────────────────────────────────
# GET /api/reviews/requests — pending review requests for current employer
# ────────────────────────────────────────────────────────────
@reviews.route('/requests', methods=['GET'])
@login_required
def my_requests():
    if current_user_type() != 'Employer':
        return jsonify({'requests': []}), 200

    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT rr.*,
                  s.service_name,
                  tu.first_name AS tp_first, tu.last_name AS tp_last
           FROM review_requests rr
           JOIN bookings b ON b.booking_id = rr.booking_id
           JOIN services s ON s.service_id = b.service_id
           JOIN tradespeople t ON t.tradesperson_id = rr.tradesperson_id
           JOIN users tu ON tu.user_id = t.user_id
           WHERE rr.employer_id = %s AND rr.status = 'pending'
           ORDER BY rr.created_at DESC""",
        (current_user_id(),),
    )
    rows = cursor.fetchall()
    cursor.close(); db.close()
    return jsonify({'requests': [_serialize_request(r) for r in rows]}), 200


# ────────────────────────────────────────────────────────────
# GET /api/reviews/submitted — already-written reviews by current employer
# Used by Reviews page "Submitted" tab.
# ────────────────────────────────────────────────────────────
@reviews.route('/submitted', methods=['GET'])
@login_required
def my_submitted():
    if current_user_type() != 'Employer':
        return jsonify({'reviews': []}), 200

    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT r.*,
                  ru.first_name AS rev_first, ru.last_name AS rev_last,
                  tu.first_name AS tp_first,  tu.last_name AS tp_last
           FROM reviews r
           JOIN users ru ON ru.user_id = r.reviewer_user_id
           JOIN tradespeople t ON t.tradesperson_id = r.tradesperson_id
           JOIN users tu ON tu.user_id = t.user_id
           WHERE r.reviewer_user_id = %s
           ORDER BY r.created_at DESC""",
        (current_user_id(),),
    )
    rows = cursor.fetchall()
    cursor.close(); db.close()
    return jsonify({'reviews': [_serialize_review(r) for r in rows]}), 200


# ────────────────────────────────────────────────────────────
# POST /api/reviews — submit a review
# Body: { booking_id, tradesperson_id, rating, comment? }
# Trigger 4 will mark the matching review_request as 'submitted'.
# Trigger 5 will recompute tradespeople.avg_rating.
# ────────────────────────────────────────────────────────────
@reviews.route('', methods=['POST'])
@reviews.route('/', methods=['POST'])
@login_required
def submit():
    if current_user_type() != 'Employer':
        return jsonify({'error': 'Only employers can submit reviews'}), 403

    data = request.get_json(force=True)
    booking_id      = data.get('booking_id')
    tradesperson_id = data.get('tradesperson_id')
    rating          = data.get('rating')
    comment         = data.get('comment')

    if not booking_id or not tradesperson_id or rating is None:
        return jsonify({'error': 'booking_id, tradesperson_id, and rating required'}), 400

    try:
        rating = int(rating)
    except (TypeError, ValueError):
        return jsonify({'error': 'rating must be an integer 1–5'}), 400
    if rating < 1 or rating > 5:
        return jsonify({'error': 'rating must be 1–5'}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True)

    # Make sure this employer owns the booking and it's completed
    cursor.execute(
        "SELECT user_id, status, tradesperson_id FROM bookings WHERE booking_id = %s",
        (booking_id,),
    )
    row = cursor.fetchone()
    if not row:
        cursor.close(); db.close()
        return jsonify({'error': 'Booking not found'}), 404
    if row['user_id'] != current_user_id():
        cursor.close(); db.close()
        return jsonify({'error': 'Forbidden'}), 403
    if row['status'] != 'completed':
        cursor.close(); db.close()
        return jsonify({'error': 'Can only review completed bookings'}), 400
    if row['tradesperson_id'] != tradesperson_id:
        cursor.close(); db.close()
        return jsonify({'error': 'Tradesperson mismatch for this booking'}), 400

    try:
        cursor.execute(
            """INSERT INTO reviews
               (booking_id, reviewer_user_id, tradesperson_id, rating, comment)
               VALUES (%s, %s, %s, %s, %s)""",
            (booking_id, current_user_id(), tradesperson_id, rating, comment),
        )
        db.commit()
    except Exception as e:
        # UNIQUE on booking_id catches duplicate submissions
        cursor.close(); db.close()
        return jsonify({'error': str(e)}), 400

    cursor.close(); db.close()
    return jsonify({'message': 'Review submitted'}), 201

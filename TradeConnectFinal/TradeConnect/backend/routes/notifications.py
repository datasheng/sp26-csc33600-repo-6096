"""
/api/notifications — derived from existing database events.

The schema has no `notifications` table, so we synthesize a feed from:
  - booking events (status changes use `created_at` as a proxy for receipt)
  - pending review_requests for employers
  - completed payments for employers

Read state is stored in the Flask session as a set of notification keys.
This keeps the schema unchanged. If persistence across sessions is needed
later, add a `notification_reads (user_id, key)` table — the keys are
already namespaced for that.
"""
from datetime import datetime, timezone
from flask import Blueprint, jsonify, session
from routes._helpers import (
    get_db, login_required, current_user_id, current_user_type,
    get_tradesperson_id_for_user, iso,
)

notifications = Blueprint('notifications', __name__)


def _read_keys():
    return set(session.get('notif_read', []))


def _save_read_keys(keys):
    session['notif_read'] = list(keys)


def _humanize(dt):
    """'2 hrs ago' / '1 day ago' style relative time."""
    if not dt:
        return ''
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - dt
    secs = int(delta.total_seconds())
    if secs < 60:        return 'just now'
    if secs < 3600:      return f'{secs // 60} min ago'
    if secs < 86400:     return f'{secs // 3600} hr{"s" if secs // 3600 != 1 else ""} ago'
    days = secs // 86400
    return f'{days} day{"s" if days != 1 else ""} ago'


@notifications.route('', methods=['GET'])
@notifications.route('/', methods=['GET'])
@login_required
def list_all():
    user_id   = current_user_id()
    user_type = current_user_type()
    read_keys = _read_keys()

    db = get_db()
    cursor = db.cursor(dictionary=True)

    items = []  # list of dicts: {id, key, message, created_at, read}

    if user_type == 'Employer':
        # 1) bookings where the employer is the user — status changes
        cursor.execute(
            """SELECT b.booking_id, b.status, b.created_at,
                      s.service_name,
                      tu.first_name AS tp_first, tu.last_name AS tp_last
               FROM bookings b
               JOIN services s ON s.service_id = b.service_id
               JOIN tradespeople t ON t.tradesperson_id = b.tradesperson_id
               JOIN users tu ON tu.user_id = t.user_id
               WHERE b.user_id = %s
               ORDER BY b.created_at DESC LIMIT 30""",
            (user_id,),
        )
        for r in cursor.fetchall():
            tp_name = f"{r['tp_first']} {r['tp_last']}"
            msg_map = {
                'pending':     f"Your booking for {r['service_name']} with {tp_name} is awaiting confirmation.",
                'accepted':    f"{tp_name} accepted your booking for {r['service_name']}.",
                'in_progress': f"{tp_name} started work on your {r['service_name']} booking.",
                'completed':   f"{tp_name} completed your {r['service_name']} job. Leave a review!",
                'cancelled':   f"Your booking for {r['service_name']} was cancelled.",
            }
            key = f"booking:{r['booking_id']}:{r['status']}"
            items.append({
                'id':         r['booking_id'] * 10,
                'key':        key,
                'message':    msg_map.get(r['status'], 'Booking updated.'),
                'created_at': iso(r['created_at']),
                'time':       _humanize(r['created_at']),
                'read':       key in read_keys,
            })

        # 2) Pending review requests
        cursor.execute(
            """SELECT rr.review_request_id, rr.created_at, s.service_name,
                      tu.first_name AS tp_first, tu.last_name AS tp_last
               FROM review_requests rr
               JOIN bookings b ON b.booking_id = rr.booking_id
               JOIN services s ON s.service_id = b.service_id
               JOIN tradespeople t ON t.tradesperson_id = rr.tradesperson_id
               JOIN users tu ON tu.user_id = t.user_id
               WHERE rr.employer_id = %s AND rr.status = 'pending'
               ORDER BY rr.created_at DESC LIMIT 10""",
            (user_id,),
        )
        for r in cursor.fetchall():
            tp_name = f"{r['tp_first']} {r['tp_last']}"
            key = f"review_req:{r['review_request_id']}"
            items.append({
                'id':         r['review_request_id'] * 100 + 1,
                'key':        key,
                'message':    f"{tp_name} completed your {r['service_name']} job — leave a review!",
                'created_at': iso(r['created_at']),
                'time':       _humanize(r['created_at']),
                'read':       key in read_keys,
            })

        # 3) Recent payments (paid)
        cursor.execute(
            """SELECT p.payment_id, p.amount, p.paid_at, s.service_name
               FROM payments p
               JOIN bookings b ON b.booking_id = p.booking_id
               JOIN services s ON s.service_id = b.service_id
               WHERE b.user_id = %s AND p.status = 'paid'
               ORDER BY p.paid_at DESC LIMIT 10""",
            (user_id,),
        )
        for r in cursor.fetchall():
            key = f"payment:{r['payment_id']}"
            items.append({
                'id':         r['payment_id'] * 100 + 2,
                'key':        key,
                'message':    f"Payment of ${float(r['amount']):.2f} for {r['service_name']} processed successfully.",
                'created_at': iso(r['paid_at']),
                'time':       _humanize(r['paid_at']),
                'read':       key in read_keys,
            })

    elif user_type in ('Tradesperson', 'Junior'):
        tp_id = get_tradesperson_id_for_user(cursor, user_id)
        if tp_id:
            # Bookings assigned to this tradesperson
            cursor.execute(
                """SELECT b.booking_id, b.status, b.created_at,
                          s.service_name,
                          eu.first_name AS emp_first, eu.last_name AS emp_last
                   FROM bookings b
                   JOIN services s ON s.service_id = b.service_id
                   JOIN users eu ON eu.user_id = b.user_id
                   WHERE b.tradesperson_id = %s
                   ORDER BY b.created_at DESC LIMIT 30""",
                (tp_id,),
            )
            for r in cursor.fetchall():
                emp_name = f"{r['emp_first']} {r['emp_last']}"
                msg_map = {
                    'pending':     f"New booking request from {emp_name} for {r['service_name']}.",
                    'accepted':    f"You accepted {emp_name}'s {r['service_name']} booking.",
                    'in_progress': f"You started {emp_name}'s {r['service_name']} job.",
                    'completed':   f"{emp_name}'s {r['service_name']} job is marked complete.",
                    'cancelled':   f"{emp_name}'s {r['service_name']} booking was cancelled.",
                }
                key = f"booking:{r['booking_id']}:{r['status']}"
                items.append({
                    'id':         r['booking_id'] * 10,
                    'key':        key,
                    'message':    msg_map.get(r['status'], 'Booking updated.'),
                    'created_at': iso(r['created_at']),
                    'time':       _humanize(r['created_at']),
                    'read':       key in read_keys,
                })

            # New reviews received
            cursor.execute(
                """SELECT r.review_id, r.rating, r.created_at,
                          ru.first_name AS rev_first, ru.last_name AS rev_last
                   FROM reviews r
                   JOIN users ru ON ru.user_id = r.reviewer_user_id
                   WHERE r.tradesperson_id = %s
                   ORDER BY r.created_at DESC LIMIT 10""",
                (tp_id,),
            )
            for r in cursor.fetchall():
                rev_name = f"{r['rev_first']} {r['rev_last']}"
                key = f"review:{r['review_id']}"
                items.append({
                    'id':         r['review_id'] * 100 + 3,
                    'key':        key,
                    'message':    f"{rev_name} left you a {r['rating']}-star review.",
                    'created_at': iso(r['created_at']),
                    'time':       _humanize(r['created_at']),
                    'read':       key in read_keys,
                })

    cursor.close(); db.close()

    # Sort newest-first
    items.sort(key=lambda x: x['created_at'] or '', reverse=True)
    return jsonify({
        'notifications': items,
        'unread_count': sum(1 for i in items if not i['read']),
    }), 200


# PATCH /api/notifications/<id>/read
# We can't look up by numeric id alone (notifications are derived) so the
# frontend should also send the key. We accept either ?key=... or fall back
# to using the id pattern.
@notifications.route('/<int:nid>/read', methods=['PATCH'])
@login_required
def mark_read(nid):
    from flask import request as _req
    key = _req.args.get('key') or _req.get_json(silent=True, force=False) or {}
    if isinstance(key, dict):
        key = key.get('key')
    if not key:
        return jsonify({'error': 'notification key required as ?key= or {"key": ...}'}), 400

    keys = _read_keys()
    keys.add(key)
    _save_read_keys(keys)
    return jsonify({'message': 'marked read'}), 200


# PATCH /api/notifications/read-all  — convenience for "Mark all as read"
@notifications.route('/read-all', methods=['PATCH'])
@login_required
def mark_all_read():
    user_id   = current_user_id()
    user_type = current_user_type()

    # Re-derive every key currently visible and mark them all read
    db = get_db()
    cursor = db.cursor(dictionary=True)
    keys = _read_keys()

    if user_type == 'Employer':
        cursor.execute(
            "SELECT booking_id, status FROM bookings WHERE user_id=%s",
            (user_id,),
        )
        for r in cursor.fetchall():
            keys.add(f"booking:{r['booking_id']}:{r['status']}")

        cursor.execute(
            "SELECT review_request_id FROM review_requests WHERE employer_id=%s",
            (user_id,),
        )
        for r in cursor.fetchall():
            keys.add(f"review_req:{r['review_request_id']}")

        cursor.execute(
            """SELECT p.payment_id FROM payments p
               JOIN bookings b ON b.booking_id = p.booking_id
               WHERE b.user_id = %s""",
            (user_id,),
        )
        for r in cursor.fetchall():
            keys.add(f"payment:{r['payment_id']}")

    elif user_type in ('Tradesperson', 'Junior'):
        tp_id = get_tradesperson_id_for_user(cursor, user_id)
        if tp_id:
            cursor.execute(
                "SELECT booking_id, status FROM bookings WHERE tradesperson_id=%s",
                (tp_id,),
            )
            for r in cursor.fetchall():
                keys.add(f"booking:{r['booking_id']}:{r['status']}")

            cursor.execute(
                "SELECT review_id FROM reviews WHERE tradesperson_id=%s",
                (tp_id,),
            )
            for r in cursor.fetchall():
                keys.add(f"review:{r['review_id']}")

    cursor.close(); db.close()
    _save_read_keys(keys)
    return jsonify({'message': 'all marked read'}), 200

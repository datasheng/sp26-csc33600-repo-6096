"""
/api/job_applications — tradespeople bid on postings; employers decide.

Routes:
  POST   /api/job_applications                 apply to a posting (TP/Junior)
  GET    /api/job_applications/mine            current TP/Junior's applications
  POST   /api/job_applications/<id>/withdraw   applicant withdraws
  POST   /api/job_applications/<id>/decide     employer accepts or rejects
                                                 body: { decision: 'accept' | 'reject' }

Acceptance flow (the important one):
  1. UPDATE this row → status='accepted'.
     Trigger 7 fires: creates a row in bookings, marks posting 'filled'.
  2. UPDATE all other pending applications on the same posting
     → status='rejected'.
  3. Commit. (Or rollback the whole thing if any step fails — including
     when Trigger 7 itself signals a refusal, e.g. "tradesperson has no
     service matching the posting" or "Junior cannot take a job without
     an approved supervisor".)
"""
from flask import Blueprint, request, jsonify
from routes._helpers import (
    get_db, login_required, current_user_id, current_user_type,
    get_tradesperson_id_for_user, iso,
)

job_applications = Blueprint('job_applications', __name__)


def _shape_application(a):
    return {
        'application_id':    a['application_id'],
        'job_posting_id':    a['job_posting_id'],
        'tradesperson_id':   a['tradesperson_id'],
        'service_id':        a.get('service_id'),
        'service_name':      a.get('service_name'),
        'proposed_price':    float(a['proposed_price']) if a.get('proposed_price') is not None else None,
        'message':           a.get('message'),
        'status':            a['status'],
        'created_at':        iso(a.get('created_at')),
        'decided_at':        iso(a.get('decided_at')),
        # joined display
        'posting_title':     a.get('posting_title'),
        'posting_status':    a.get('posting_status'),
        'posting_city':      a.get('posting_city'),
        'posting_trade':     a.get('posting_trade'),
        'scheduled_at':      iso(a.get('scheduled_at')),
        'employer_name':     f"{a.get('emp_first','')} {a.get('emp_last','')}".strip() or None,
    }


# ────────────────────────────────────────────────────────────
# POST /api/job_applications  — TP/Junior applies to a posting
# Body: { job_posting_id, proposed_price, service_id?, message? }
# ────────────────────────────────────────────────────────────
@job_applications.route('', methods=['POST'])
@job_applications.route('/', methods=['POST'])
@login_required
def apply_to_posting():
    if current_user_type() not in ('Tradesperson', 'Junior'):
        return jsonify({'error': 'Only tradespeople can apply'}), 403

    data = request.get_json(force=True)
    job_posting_id = data.get('job_posting_id')
    proposed_price = data.get('proposed_price')
    service_id     = data.get('service_id')          # optional
    message        = (data.get('message') or '').strip() or None

    if job_posting_id is None or proposed_price is None:
        return jsonify({'error': 'job_posting_id and proposed_price are required'}), 400

    try:
        proposed_price = float(proposed_price)
        if proposed_price < 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({'error': 'proposed_price must be a non-negative number'}), 400

    user_id = current_user_id()
    db = get_db()
    cursor = db.cursor(dictionary=True)

    tp_id = get_tradesperson_id_for_user(cursor, user_id)
    if not tp_id:
        cursor.close(); db.close()
        return jsonify({'error': 'No trade profile found — set one up first'}), 400

    # Gate: Junior must have an approved supervisor
    cursor.execute(
        """SELECT t.trade_category, t.endorse_id, u.user_type
             FROM tradespeople t JOIN users u ON u.user_id = t.user_id
            WHERE t.tradesperson_id = %s""",
        (tp_id,),
    )
    me = cursor.fetchone()
    if me['user_type'] == 'Junior' and not me['endorse_id']:
        cursor.close(); db.close()
        return jsonify({'error': 'Juniors must have an approved supervisor before applying'}), 403

    # Posting must exist, be open, and match the tradesperson's trade
    cursor.execute(
        "SELECT status, trade_type FROM job_postings WHERE job_posting_id = %s",
        (job_posting_id,),
    )
    p = cursor.fetchone()
    if not p:
        cursor.close(); db.close()
        return jsonify({'error': 'Posting not found'}), 404
    if p['status'] != 'open':
        cursor.close(); db.close()
        return jsonify({'error': f'Posting is {p["status"]}; cannot apply'}), 400
    if p['trade_type'] != me['trade_category']:
        cursor.close(); db.close()
        return jsonify({
            'error': f'This posting is for {p["trade_type"]}; your trade is {me["trade_category"]}'
        }), 400

    # service_id (if given) must belong to this tradesperson AND have a
    # matching trade_type. We don't *require* one here — Trigger 7 will
    # resolve it at accept time — but if given, validate it.
    if service_id is not None:
        cursor.execute(
            """SELECT trade_type FROM services
                WHERE service_id = %s AND tradesperson_id = %s""",
            (service_id, tp_id),
        )
        s = cursor.fetchone()
        if not s:
            cursor.close(); db.close()
            return jsonify({'error': 'service_id does not belong to you'}), 400

    try:
        cursor.execute(
            """INSERT INTO job_applications
                  (job_posting_id, tradesperson_id, service_id,
                   proposed_price, message, status)
               VALUES (%s, %s, %s, %s, %s, 'pending')""",
            (job_posting_id, tp_id, service_id, proposed_price, message),
        )
        db.commit()
        new_id = cursor.lastrowid
    except Exception as e:
        db.rollback()
        cursor.close(); db.close()
        # UNIQUE(job_posting_id, tradesperson_id) catches duplicate applies
        msg = str(e)
        if 'uniq_application' in msg or 'Duplicate' in msg:
            return jsonify({'error': 'You have already applied to this posting'}), 400
        return jsonify({'error': msg}), 400

    cursor.close(); db.close()
    return jsonify({'message': 'Application submitted', 'application_id': new_id}), 201


# ────────────────────────────────────────────────────────────
# GET /api/job_applications/mine
# Returns the current tradesperson's applications across all postings.
# ?status=pending|accepted|rejected|withdrawn (optional)
# ────────────────────────────────────────────────────────────
@job_applications.route('/mine', methods=['GET'])
@login_required
def my_applications():
    if current_user_type() not in ('Tradesperson', 'Junior'):
        return jsonify({'applications': []}), 200

    status_q = request.args.get('status')

    db = get_db()
    cursor = db.cursor(dictionary=True)
    tp_id = get_tradesperson_id_for_user(cursor, current_user_id())
    if not tp_id:
        cursor.close(); db.close()
        return jsonify({'applications': []}), 200

    sql = """
        SELECT a.*,
               s.service_name,
               jp.title        AS posting_title,
               jp.status       AS posting_status,
               jp.city         AS posting_city,
               jp.trade_type   AS posting_trade,
               jp.scheduled_at,
               eu.first_name   AS emp_first,
               eu.last_name    AS emp_last
          FROM job_applications a
          JOIN job_postings jp ON jp.job_posting_id = a.job_posting_id
          JOIN users eu        ON eu.user_id = jp.employer_id
          LEFT JOIN services s ON s.service_id = a.service_id
         WHERE a.tradesperson_id = %s
    """
    params = [tp_id]
    if status_q in ('pending', 'accepted', 'rejected', 'withdrawn'):
        sql += " AND a.status = %s"
        params.append(status_q)
    sql += " ORDER BY a.created_at DESC"

    cursor.execute(sql, params)
    rows = cursor.fetchall()
    cursor.close(); db.close()
    return jsonify({'applications': [_shape_application(a) for a in rows]}), 200


# ────────────────────────────────────────────────────────────
# POST /api/job_applications/<id>/withdraw
# Applicant withdraws their own pending application.
# ────────────────────────────────────────────────────────────
@job_applications.route('/<int:application_id>/withdraw', methods=['POST'])
@login_required
def withdraw(application_id):
    if current_user_type() not in ('Tradesperson', 'Junior'):
        return jsonify({'error': 'Forbidden'}), 403

    db = get_db()
    cursor = db.cursor(dictionary=True)
    tp_id = get_tradesperson_id_for_user(cursor, current_user_id())

    cursor.execute(
        "SELECT tradesperson_id, status FROM job_applications WHERE application_id = %s",
        (application_id,),
    )
    a = cursor.fetchone()
    if not a:
        cursor.close(); db.close()
        return jsonify({'error': 'Application not found'}), 404
    if a['tradesperson_id'] != tp_id:
        cursor.close(); db.close()
        return jsonify({'error': 'Forbidden'}), 403
    if a['status'] != 'pending':
        cursor.close(); db.close()
        return jsonify({'error': f'Cannot withdraw — application is {a["status"]!r}'}), 400

    cursor.execute(
        "UPDATE job_applications SET status='withdrawn', decided_at=CURRENT_TIMESTAMP WHERE application_id=%s",
        (application_id,),
    )
    db.commit()
    cursor.close(); db.close()
    return jsonify({'message': 'Application withdrawn'}), 200


# ────────────────────────────────────────────────────────────
# POST /api/job_applications/<id>/decide
# Body: { decision: 'accept' | 'reject' }
# Employer-only. Accept fires Trigger 7 (creates booking, closes posting).
# Then this route rejects every OTHER pending app on the same posting.
# All of that runs in one transaction.
# ────────────────────────────────────────────────────────────
@job_applications.route('/<int:application_id>/decide', methods=['POST'])
@login_required
def decide(application_id):
    if current_user_type() != 'Employer':
        return jsonify({'error': 'Only employers can decide applications'}), 403

    data = request.get_json(force=True)
    decision = (data.get('decision') or '').strip().lower()
    if decision not in ('accept', 'reject'):
        return jsonify({'error': "decision must be 'accept' or 'reject'"}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True)

    # Look up the application + verify the current user owns the posting
    cursor.execute(
        """SELECT a.application_id, a.status, a.job_posting_id,
                  jp.employer_id, jp.status AS posting_status
             FROM job_applications a
             JOIN job_postings jp ON jp.job_posting_id = a.job_posting_id
            WHERE a.application_id = %s""",
        (application_id,),
    )
    row = cursor.fetchone()
    if not row:
        cursor.close(); db.close()
        return jsonify({'error': 'Application not found'}), 404
    if row['employer_id'] != current_user_id():
        cursor.close(); db.close()
        return jsonify({'error': 'Forbidden'}), 403
    if row['status'] != 'pending':
        cursor.close(); db.close()
        return jsonify({'error': f'Application is already {row["status"]!r}'}), 400
    if row['posting_status'] != 'open':
        cursor.close(); db.close()
        return jsonify({'error': f'Posting is {row["posting_status"]!r}; cannot decide'}), 400

    if decision == 'reject':
        try:
            cursor.execute(
                """UPDATE job_applications
                      SET status='rejected', decided_at=CURRENT_TIMESTAMP
                    WHERE application_id=%s""",
                (application_id,),
            )
            db.commit()
        except Exception as e:
            db.rollback()
            cursor.close(); db.close()
            return jsonify({'error': str(e)}), 400
        cursor.close(); db.close()
        return jsonify({'message': 'Application rejected'}), 200

    # decision == 'accept'  → the important one
    try:
        # Step 1: accept this application. Trigger 7 will:
        #   - create a row in bookings (which itself runs Trigger 1)
        #   - mark posting 'filled'
        # If any of those fail (e.g. Junior with no supervisor, or no
        # matching service), the UPDATE raises and nothing has committed.
        cursor.execute(
            """UPDATE job_applications
                  SET status='accepted', decided_at=CURRENT_TIMESTAMP
                WHERE application_id=%s""",
            (application_id,),
        )

        # Step 2: cascade-reject the competitors. Cannot live in the
        # trigger (MySQL forbids self-table updates from a trigger), so
        # it happens here in the same uncommitted transaction.
        cursor.execute(
            """UPDATE job_applications
                  SET status='rejected', decided_at=CURRENT_TIMESTAMP
                WHERE job_posting_id = %s
                  AND application_id <> %s
                  AND status = 'pending'""",
            (row['job_posting_id'], application_id),
        )

        db.commit()
    except Exception as e:
        db.rollback()
        cursor.close(); db.close()
        return jsonify({'error': str(e)}), 400

    # Look up the booking that Trigger 7 just created, so we can
    # return the new booking_id to the frontend
    cursor.execute(
        "SELECT booking_id FROM bookings WHERE application_id = %s",
        (application_id,),
    )
    b = cursor.fetchone()
    cursor.close(); db.close()
    return jsonify({
        'message':    'Application accepted',
        'booking_id': b['booking_id'] if b else None,
    }), 200

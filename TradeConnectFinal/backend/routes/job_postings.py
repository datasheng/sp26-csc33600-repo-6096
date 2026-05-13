"""
/api/job_postings — employer creates a job; tradespeople browse and apply.

Routes:
  GET    /api/job_postings                  list (role-aware)
                                              employer → my own postings
                                              tradesperson/junior → open postings
                                                                    matching their trade
  GET    /api/job_postings/<id>             single posting + applications (if owner)
  POST   /api/job_postings                  create (Employer only)
  PATCH  /api/job_postings/<id>             update (Employer only, while open)
  POST   /api/job_postings/<id>/close       close without filling (Employer)
  POST   /api/job_postings/<id>/cancel      cancel (Employer)

Browse semantics:
  - Tradespeople/Juniors only see status='open' postings whose trade_type
    matches their tradespeople.trade_category. Optional ?q= matches title,
    description, or city.
  - Juniors must have an approved supervisor (endorse_id IS NOT NULL) to see
    any postings — applications they can't fulfil would never accept anyway.
"""
from flask import Blueprint, request, jsonify
from routes._helpers import (
    get_db, login_required, current_user_id, current_user_type,
    get_tradesperson_id_for_user, iso,
)

job_postings = Blueprint('job_postings', __name__)

POSTING_STATUSES = {'open', 'filled', 'closed', 'cancelled'}


def _shape_posting(row, app_count=None, my_application=None):
    return {
        'job_posting_id': row['job_posting_id'],
        'employer_id':    row['employer_id'],
        'title':          row['title'],
        'description':    row.get('description'),
        'trade_type':     row['trade_type'],
        'city':           row.get('city'),
        'address':        row.get('address'),
        'budget_min':     float(row['budget_min']) if row.get('budget_min') is not None else None,
        'budget_max':     float(row['budget_max']) if row.get('budget_max') is not None else None,
        'scheduled_at':   iso(row['scheduled_at']),
        'status':         row['status'],
        'created_at':     iso(row.get('created_at')),
        'closed_at':      iso(row.get('closed_at')),
        # joined display
        'employer_name':  f"{row.get('emp_first','')} {row.get('emp_last','')}".strip() or None,
        'application_count': app_count,
        # tradesperson-side hint: their own application on this posting, if any
        'my_application': my_application,
    }


# ────────────────────────────────────────────────────────────
# GET /api/job_postings
# ────────────────────────────────────────────────────────────
@job_postings.route('', methods=['GET'])
@job_postings.route('/', methods=['GET'])
@login_required
def list_postings():
    user_id   = current_user_id()
    user_type = current_user_type()
    q         = (request.args.get('q') or '').strip()
    status_q  = request.args.get('status')

    db = get_db()
    cursor = db.cursor(dictionary=True)

    if user_type == 'Employer':
        # Employer sees their own postings (all statuses by default).
        sql = """
            SELECT jp.*,
                   eu.first_name AS emp_first, eu.last_name AS emp_last,
                   (SELECT COUNT(*) FROM job_applications a
                     WHERE a.job_posting_id = jp.job_posting_id) AS app_count
              FROM job_postings jp
              JOIN users eu ON eu.user_id = jp.employer_id
             WHERE jp.employer_id = %s
        """
        params = [user_id]
        if status_q in POSTING_STATUSES:
            sql += " AND jp.status = %s"
            params.append(status_q)
        sql += " ORDER BY jp.created_at DESC"

        cursor.execute(sql, params)
        rows = cursor.fetchall()
        cursor.close(); db.close()
        return jsonify({
            'postings': [_shape_posting(r, app_count=r.get('app_count')) for r in rows]
        }), 200

    elif user_type in ('Tradesperson', 'Junior'):
        tp_id = get_tradesperson_id_for_user(cursor, user_id)
        if not tp_id:
            cursor.close(); db.close()
            return jsonify({'postings': []}), 200

        # Pull this TP's trade_category + endorse_id (for the Junior gate)
        cursor.execute(
            "SELECT trade_category, endorse_id FROM tradespeople WHERE tradesperson_id = %s",
            (tp_id,),
        )
        me = cursor.fetchone()
        # Juniors with no approved supervisor cannot see (or apply to) jobs
        if user_type == 'Junior' and not me.get('endorse_id'):
            cursor.close(); db.close()
            return jsonify({'postings': [], 'gated': 'no_supervisor'}), 200

        sql = """
            SELECT jp.*,
                   eu.first_name AS emp_first, eu.last_name AS emp_last,
                   (SELECT COUNT(*) FROM job_applications a
                     WHERE a.job_posting_id = jp.job_posting_id) AS app_count,
                   ma.application_id AS my_app_id,
                   ma.status         AS my_app_status,
                   ma.proposed_price AS my_app_price
              FROM job_postings jp
              JOIN users eu ON eu.user_id = jp.employer_id
              LEFT JOIN job_applications ma
                     ON ma.job_posting_id  = jp.job_posting_id
                    AND ma.tradesperson_id = %s
             WHERE jp.status = 'open'
               AND jp.trade_type = %s
        """
        params = [tp_id, me['trade_category']]
        if q:
            sql += """ AND (jp.title LIKE %s
                          OR jp.description LIKE %s
                          OR jp.city LIKE %s)"""
            like = f"%{q}%"
            params.extend([like, like, like])
        sql += " ORDER BY jp.created_at DESC"

        cursor.execute(sql, params)
        rows = cursor.fetchall()
        cursor.close(); db.close()

        out = []
        for r in rows:
            my_app = None
            if r.get('my_app_id'):
                my_app = {
                    'application_id': r['my_app_id'],
                    'status':         r['my_app_status'],
                    'proposed_price': float(r['my_app_price']) if r['my_app_price'] is not None else None,
                }
            out.append(_shape_posting(r, app_count=r.get('app_count'), my_application=my_app))
        return jsonify({'postings': out}), 200

    cursor.close(); db.close()
    return jsonify({'postings': []}), 200


# ────────────────────────────────────────────────────────────
# GET /api/job_postings/<id>
# Employer who owns it sees the posting + every application.
# Tradesperson sees the posting + their own application (if any).
# ────────────────────────────────────────────────────────────
@job_postings.route('/<int:posting_id>', methods=['GET'])
@login_required
def get_posting(posting_id):
    user_id   = current_user_id()
    user_type = current_user_type()

    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute(
        """SELECT jp.*,
                  eu.first_name AS emp_first, eu.last_name AS emp_last
             FROM job_postings jp
             JOIN users eu ON eu.user_id = jp.employer_id
            WHERE jp.job_posting_id = %s""",
        (posting_id,),
    )
    row = cursor.fetchone()
    if not row:
        cursor.close(); db.close()
        return jsonify({'error': 'Posting not found'}), 404

    is_owner = (user_type == 'Employer' and row['employer_id'] == user_id)

    if is_owner:
        # All applications, with applicant info
        cursor.execute(
            """SELECT a.*,
                      tu.first_name AS tp_first, tu.last_name AS tp_last,
                      t.trade_category, t.avg_rating, t.is_verified,
                      s.service_name
                 FROM job_applications a
                 JOIN tradespeople t ON t.tradesperson_id = a.tradesperson_id
                 JOIN users tu       ON tu.user_id = t.user_id
                 LEFT JOIN services s ON s.service_id = a.service_id
                WHERE a.job_posting_id = %s
                ORDER BY a.created_at DESC""",
            (posting_id,),
        )
        apps = cursor.fetchall()
        applications = [{
            'application_id':   a['application_id'],
            'job_posting_id':   a['job_posting_id'],
            'tradesperson_id':  a['tradesperson_id'],
            'service_id':       a.get('service_id'),
            'service_name':     a.get('service_name'),
            'proposed_price':   float(a['proposed_price']) if a['proposed_price'] is not None else None,
            'message':          a.get('message'),
            'status':           a['status'],
            'created_at':       iso(a.get('created_at')),
            'decided_at':       iso(a.get('decided_at')),
            'tradesperson_name': f"{a.get('tp_first','')} {a.get('tp_last','')}".strip() or None,
            'trade_category':   a.get('trade_category'),
            'avg_rating':       float(a['avg_rating']) if a.get('avg_rating') is not None else 0.0,
            'is_verified':      bool(a.get('is_verified')),
        } for a in apps]
        cursor.close(); db.close()
        return jsonify({
            'posting': _shape_posting(row, app_count=len(applications)),
            'applications': applications,
        }), 200

    # Non-owner view: include their own application if any
    my_app = None
    if user_type in ('Tradesperson', 'Junior'):
        tp_id = get_tradesperson_id_for_user(cursor, user_id)
        if tp_id:
            cursor.execute(
                """SELECT application_id, status, proposed_price
                     FROM job_applications
                    WHERE job_posting_id = %s AND tradesperson_id = %s""",
                (posting_id, tp_id),
            )
            a = cursor.fetchone()
            if a:
                my_app = {
                    'application_id': a['application_id'],
                    'status':         a['status'],
                    'proposed_price': float(a['proposed_price']) if a['proposed_price'] is not None else None,
                }
    cursor.close(); db.close()
    return jsonify({
        'posting': _shape_posting(row, my_application=my_app),
    }), 200


# ────────────────────────────────────────────────────────────
# POST /api/job_postings — Employer creates
# ────────────────────────────────────────────────────────────
@job_postings.route('', methods=['POST'])
@job_postings.route('/', methods=['POST'])
@login_required
def create_posting():
    if current_user_type() != 'Employer':
        return jsonify({'error': 'Only employers can post jobs'}), 403

    data = request.get_json(force=True)
    title        = (data.get('title') or '').strip()
    description  = data.get('description') or ''
    trade_type   = (data.get('trade_type') or '').strip()
    city         = data.get('city') or ''
    address      = data.get('address') or ''
    budget_min   = data.get('budget_min')
    budget_max   = data.get('budget_max')
    scheduled_at = data.get('scheduled_at')

    if not title or not trade_type or not scheduled_at:
        return jsonify({'error': 'title, trade_type, scheduled_at are required'}), 400

    if (budget_min is not None and budget_max is not None
            and float(budget_max) < float(budget_min)):
        return jsonify({'error': 'budget_max must be >= budget_min'}), 400

    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        """INSERT INTO job_postings
              (employer_id, title, description, trade_type, city, address,
               budget_min, budget_max, scheduled_at, status)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'open')""",
        (current_user_id(), title, description, trade_type, city, address,
         budget_min, budget_max, scheduled_at),
    )
    db.commit()
    new_id = cursor.lastrowid
    cursor.close(); db.close()
    return jsonify({'message': 'Posting created', 'job_posting_id': new_id}), 201


# ────────────────────────────────────────────────────────────
# PATCH /api/job_postings/<id> — Employer edits an OPEN posting
# Editable fields: title, description, city, address, budget_min,
#                  budget_max, scheduled_at
# ────────────────────────────────────────────────────────────
@job_postings.route('/<int:posting_id>', methods=['PATCH'])
@login_required
def update_posting(posting_id):
    if current_user_type() != 'Employer':
        return jsonify({'error': 'Forbidden'}), 403

    data = request.get_json(force=True)
    editable = ['title', 'description', 'city', 'address',
                'budget_min', 'budget_max', 'scheduled_at']
    updates = {f: data.get(f) for f in editable if f in data}
    if not updates:
        return jsonify({'error': 'No editable fields provided'}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute(
        "SELECT employer_id, status FROM job_postings WHERE job_posting_id = %s",
        (posting_id,),
    )
    row = cursor.fetchone()
    if not row:
        cursor.close(); db.close()
        return jsonify({'error': 'Posting not found'}), 404
    if row['employer_id'] != current_user_id():
        cursor.close(); db.close()
        return jsonify({'error': 'Forbidden'}), 403
    if row['status'] != 'open':
        cursor.close(); db.close()
        return jsonify({'error': f'Cannot edit a posting in status {row["status"]!r}'}), 400

    set_clause = ', '.join(f"{k} = %s" for k in updates.keys())
    params = list(updates.values()) + [posting_id]
    cursor.execute(f"UPDATE job_postings SET {set_clause} WHERE job_posting_id = %s", params)
    db.commit()
    cursor.close(); db.close()
    return jsonify({'message': 'Posting updated'}), 200


# ────────────────────────────────────────────────────────────
# POST /api/job_postings/<id>/close   — close without filling
# POST /api/job_postings/<id>/cancel  — cancel
# (Both only by the owner, both only from status='open'.)
# ────────────────────────────────────────────────────────────
def _transition_posting(posting_id, new_status):
    if current_user_type() != 'Employer':
        return jsonify({'error': 'Forbidden'}), 403

    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        "SELECT employer_id, status FROM job_postings WHERE job_posting_id = %s",
        (posting_id,),
    )
    row = cursor.fetchone()
    if not row:
        cursor.close(); db.close()
        return jsonify({'error': 'Posting not found'}), 404
    if row['employer_id'] != current_user_id():
        cursor.close(); db.close()
        return jsonify({'error': 'Forbidden'}), 403
    if row['status'] != 'open':
        cursor.close(); db.close()
        return jsonify({'error': f'Posting is already {row["status"]!r}'}), 400

    try:
        cursor.execute(
            "UPDATE job_postings SET status=%s, closed_at=CURRENT_TIMESTAMP WHERE job_posting_id=%s",
            (new_status, posting_id),
        )
        # Also reject every still-pending application on this posting
        cursor.execute(
            """UPDATE job_applications
                  SET status='rejected', decided_at=CURRENT_TIMESTAMP
                WHERE job_posting_id=%s AND status='pending'""",
            (posting_id,),
        )
        db.commit()
    except Exception as e:
        db.rollback()
        cursor.close(); db.close()
        return jsonify({'error': str(e)}), 400

    cursor.close(); db.close()
    return jsonify({'message': f'Posting {new_status}'}), 200


@job_postings.route('/<int:posting_id>/close', methods=['POST'])
@login_required
def close_posting(posting_id):
    return _transition_posting(posting_id, 'closed')


@job_postings.route('/<int:posting_id>/cancel', methods=['POST'])
@login_required
def cancel_posting(posting_id):
    return _transition_posting(posting_id, 'cancelled')

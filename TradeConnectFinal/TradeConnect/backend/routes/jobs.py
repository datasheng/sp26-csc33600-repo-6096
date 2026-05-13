"""
/api/jobs — convenience views for tradespeople's job-hunting UI.

This is now a thin wrapper around /api/job_postings + /api/job_applications,
shaped specifically for the existing tradesperson/junior "Browse Jobs" page
so we don't have to rewrite those pages in two places.

  GET /api/jobs/available   list of open postings the current TP can apply to,
                            shaped flat for the UI cards. ?q= search filter.
  GET /api/jobs/cap         job-cap progress (Junior pages).
                            jobs_taken now counts pending applications +
                            active bookings (so applying eats a slot too).

The old POST /api/jobs/<id>/apply endpoint is GONE. Use
POST /api/job_applications instead.
"""
from flask import Blueprint, request, jsonify
from routes._helpers import (
    get_db, login_required, current_user_id, current_user_type,
    get_tradesperson_id_for_user, iso,
)

jobs = Blueprint('jobs', __name__)


def _shape_posting_for_list(row):
    """Flat shape matching the AvailableJob type the frontend expects."""
    my_app = None
    if row.get('my_app_id'):
        my_app = {
            'application_id': row['my_app_id'],
            'status':         row['my_app_status'],
            'proposed_price': float(row['my_app_price']) if row.get('my_app_price') is not None else None,
        }
    return {
        'id':             row['job_posting_id'],          # for React keys
        'job_posting_id': row['job_posting_id'],
        'title':          row['title'],
        'description':    row.get('description'),
        'trade':          row['trade_type'],
        'city':           row.get('city') or '',
        'address':        row.get('address') or '',
        'budget_min':     float(row['budget_min']) if row.get('budget_min') is not None else None,
        'budget_max':     float(row['budget_max']) if row.get('budget_max') is not None else None,
        'employer':       f"{row.get('emp_first','')} {row.get('emp_last','')}".strip(),
        'employer_id':    row['employer_id'],
        'scheduled_at':   iso(row.get('scheduled_at')),
        'created_at':     iso(row.get('created_at')),
        'my_application': my_app,
    }


# ────────────────────────────────────────────────────────────
# GET /api/jobs/available  — open postings the current TP can apply to
# ────────────────────────────────────────────────────────────
@jobs.route('/available', methods=['GET'])
@login_required
def available():
    if current_user_type() not in ('Tradesperson', 'Junior'):
        return jsonify({'jobs': []}), 200

    user_id = current_user_id()
    q       = (request.args.get('q') or '').strip()

    db = get_db()
    cursor = db.cursor(dictionary=True)

    tp_id = get_tradesperson_id_for_user(cursor, user_id)
    if not tp_id:
        cursor.close(); db.close()
        return jsonify({'jobs': []}), 200

    cursor.execute(
        "SELECT trade_category, endorse_id FROM tradespeople WHERE tradesperson_id = %s",
        (tp_id,),
    )
    me = cursor.fetchone()

    # Juniors with no approved supervisor can't see jobs
    if current_user_type() == 'Junior' and not me.get('endorse_id'):
        cursor.close(); db.close()
        return jsonify({'jobs': [], 'gated': 'no_supervisor'}), 200

    sql = """
        SELECT jp.*,
               eu.first_name AS emp_first, eu.last_name AS emp_last,
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

    return jsonify({'jobs': [_shape_posting_for_list(r) for r in rows]}), 200


# ────────────────────────────────────────────────────────────
# GET /api/jobs/cap   — Junior page job-cap progress bar
# Returns { job_limit, jobs_taken, remaining }.
# jobs_taken now counts:
#   - pending applications (you've committed to wanting this job)
#   - active bookings (pending/accepted/in_progress)
# This way, mass-applying doesn't dodge the cap.
# ────────────────────────────────────────────────────────────
@jobs.route('/cap', methods=['GET'])
@login_required
def cap():
    if current_user_type() not in ('Tradesperson', 'Junior'):
        return jsonify({'error': 'Not applicable'}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True)
    tp_id = get_tradesperson_id_for_user(cursor, current_user_id())
    if not tp_id:
        cursor.close(); db.close()
        return jsonify({'job_limit': 0, 'jobs_taken': 0, 'remaining': 0}), 200

    cursor.execute(
        "SELECT job_limit FROM tradespeople WHERE tradesperson_id = %s",
        (tp_id,),
    )
    job_limit = cursor.fetchone()['job_limit']

    # Active bookings
    cursor.execute(
        """SELECT COUNT(*) AS n FROM bookings
            WHERE tradesperson_id=%s
              AND status IN ('pending','accepted','in_progress')""",
        (tp_id,),
    )
    active_bookings = cursor.fetchone()['n']

    # Pending applications (not yet decided)
    cursor.execute(
        "SELECT COUNT(*) AS n FROM job_applications WHERE tradesperson_id=%s AND status='pending'",
        (tp_id,),
    )
    pending_apps = cursor.fetchone()['n']

    taken = active_bookings + pending_apps
    cursor.close(); db.close()

    return jsonify({
        'job_limit':         job_limit,
        'jobs_taken':        taken,
        'active_bookings':   active_bookings,
        'pending_applications': pending_apps,
        'remaining':         max(0, job_limit - taken),
    }), 200

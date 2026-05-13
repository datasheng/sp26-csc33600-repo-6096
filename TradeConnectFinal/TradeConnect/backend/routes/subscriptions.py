"""
/api/subscriptions — tradesperson subscription revenue.

Plan catalog lives in the `subscription_plans` table (3NF). Each subscription
references plan_id and snapshots the monthly price at activation time into
`price_at_purchase` so historical records stay accurate if the catalog changes.
"""
from flask import Blueprint, request, jsonify
from routes._helpers import (
    get_db, login_required, current_user_id, current_user_type,
    get_tradesperson_id_for_user, iso,
)

subscriptions = Blueprint('subscriptions', __name__)


def _serialize(row):
    return {
        'subscription_id':   row['subscription_id'],
        'tradesperson_id':   row['tradesperson_id'],
        'plan_id':           row['plan_id'],
        'plan_name':         row.get('plan_name'),
        'price_at_purchase': float(row['price_at_purchase']),
        'job_limit':         row.get('job_limit'),
        'status':            row['status'],
        'start_date':        iso(row.get('start_date')),
        'end_date':          iso(row.get('end_date')),
    }


def _get_free_plan(cursor):
    cursor.execute(
        "SELECT plan_id, job_limit FROM subscription_plans WHERE plan_name='Free' LIMIT 1"
    )
    return cursor.fetchone()


@subscriptions.route('/plans', methods=['GET'])
@login_required
def list_plans():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT plan_id, plan_name, description, monthly_price, job_limit, is_active
             FROM subscription_plans
            WHERE is_active = TRUE
            ORDER BY monthly_price ASC"""
    )
    rows = cursor.fetchall()
    cursor.close(); db.close()

    return jsonify({
        'plans': [
            {
                'plan_id':       r['plan_id'],
                'plan_name':     r['plan_name'],
                'description':   r['description'],
                'monthly_price': float(r['monthly_price']),
                'job_limit':     r['job_limit'],
            }
            for r in rows
        ]
    }), 200


@subscriptions.route('/me', methods=['GET'])
@login_required
def get_mine():
    if current_user_type() not in ('Tradesperson', 'Junior'):
        return jsonify({'error': 'Only tradespeople have subscriptions'}), 403

    db = get_db()
    cursor = db.cursor(dictionary=True)
    tp_id = get_tradesperson_id_for_user(cursor, current_user_id())
    if not tp_id:
        cursor.close(); db.close()
        return jsonify({'subscription': None}), 200

    cursor.execute(
        """SELECT s.*, p.plan_name, p.job_limit
             FROM subscriptions s
             JOIN subscription_plans p ON p.plan_id = s.plan_id
            WHERE s.tradesperson_id = %s AND s.status = 'active'
            ORDER BY s.start_date DESC, s.subscription_id DESC
            LIMIT 1""",
        (tp_id,),
    )
    row = cursor.fetchone()
    cursor.close(); db.close()

    return jsonify({'subscription': _serialize(row) if row else None}), 200


@subscriptions.route('', methods=['POST'])
@subscriptions.route('/', methods=['POST'])
@login_required
def activate():
    if current_user_type() not in ('Tradesperson', 'Junior'):
        return jsonify({'error': 'Only tradespeople can subscribe'}), 403

    data = request.get_json(force=True)
    plan_name = data.get('plan_name', 'Pro')
    if plan_name == 'Free':
        return jsonify({'error': 'Choose Pro or Elite'}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute(
            """SELECT plan_id, plan_name, monthly_price, job_limit
                 FROM subscription_plans
                WHERE plan_name = %s AND is_active = TRUE
                LIMIT 1""",
            (plan_name,),
        )
        plan = cursor.fetchone()
        if not plan:
            cursor.close(); db.close()
            return jsonify({'error': f'Unknown plan: {plan_name}'}), 400

        tp_id = get_tradesperson_id_for_user(cursor, current_user_id())
        if not tp_id:
            cursor.close(); db.close()
            return jsonify({'error': 'Trade profile not found'}), 404

        # Cancel any existing active subscription first.
        cursor.execute(
            """UPDATE subscriptions
                  SET status='cancelled', end_date=CURRENT_DATE
                WHERE tradesperson_id=%s AND status='active'""",
            (tp_id,),
        )
        # Snapshot the price at purchase time so historical invoices stay accurate
        # even if the catalog price changes later.
        cursor.execute(
            """INSERT INTO subscriptions
                  (tradesperson_id, plan_id, price_at_purchase, status, start_date)
                VALUES (%s, %s, %s, 'active', CURRENT_DATE)""",
            (tp_id, plan['plan_id'], plan['monthly_price']),
        )
        subscription_id = cursor.lastrowid

        cursor.execute(
            "UPDATE tradespeople SET job_limit=%s WHERE tradesperson_id=%s",
            (plan['job_limit'], tp_id),
        )
        db.commit()
    except Exception as e:
        db.rollback()
        cursor.close(); db.close()
        return jsonify({'error': str(e)}), 400

    cursor.close(); db.close()
    return jsonify({
        'message': f"{plan['plan_name']} subscription activated",
        'subscription_id': subscription_id,
        'plan_id': plan['plan_id'],
        'job_limit': plan['job_limit'],
    }), 201


@subscriptions.route('/me/cancel', methods=['PATCH'])
@login_required
def cancel_mine():
    if current_user_type() not in ('Tradesperson', 'Junior'):
        return jsonify({'error': 'Only tradespeople can cancel subscriptions'}), 403

    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        tp_id = get_tradesperson_id_for_user(cursor, current_user_id())
        if not tp_id:
            cursor.close(); db.close()
            return jsonify({'error': 'Trade profile not found'}), 404

        cursor.execute(
            """UPDATE subscriptions
                  SET status='cancelled', end_date=CURRENT_DATE
                WHERE tradesperson_id=%s AND status='active'""",
            (tp_id,),
        )

        free = _get_free_plan(cursor)
        free_job_limit = free['job_limit'] if free else 5
        cursor.execute(
            "UPDATE tradespeople SET job_limit=%s WHERE tradesperson_id=%s",
            (free_job_limit, tp_id),
        )
        db.commit()
    except Exception as e:
        db.rollback()
        cursor.close(); db.close()
        return jsonify({'error': str(e)}), 400

    cursor.close(); db.close()
    return jsonify({'message': 'Subscription cancelled', 'job_limit': free_job_limit}), 200

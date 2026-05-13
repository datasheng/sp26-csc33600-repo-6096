"""
/api/admin — admin-only endpoints.

Routes:
  GET   /api/admin/users                   list users with quick stats
  DELETE /api/admin/users/<int:user_id>    remove a user

  GET   /api/admin/settings                read platform settings (fee %)
  PUT   /api/admin/settings                update platform_fee_percentage

  GET   /api/admin/subscription-plans      list all subscription plans
  PUT   /api/admin/subscription-plans/<id> update a plan's monthly_price
                                            (and optionally job_limit / is_active)

Every endpoint here is gated to Admin via the local _admin_required helper.
"""
from decimal import Decimal, InvalidOperation
from functools import wraps
from flask import Blueprint, request, jsonify, session
from routes._helpers import get_db, current_user_id, current_user_type, iso

admin = Blueprint('admin', __name__)


# ────────────────────────────────────────────────────────────
# Local admin-only guard. Sits on top of the standard
# session check so we get a single, consistent 403 message.
# ────────────────────────────────────────────────────────────
def _admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get('user_id'):
            return jsonify({'error': 'Authentication required'}), 401
        if current_user_type() != 'Admin':
            return jsonify({'error': 'Admin privileges required'}), 403
        return fn(*args, **kwargs)
    return wrapper


# ────────────────────────────────────────────────────────────
# GET /api/admin/users
# Returns every user with the totals an admin would want at a
# glance: bookings (as employer), tradesperson bookings, and
# active subscription (if any).
# ────────────────────────────────────────────────────────────
@admin.route('/users', methods=['GET'])
@_admin_required
def list_users():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT u.user_id, u.first_name, u.last_name, u.email, u.user_type,
                  u.city, u.state, u.is_active, u.created_at, u.last_login_at,
                  (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.user_id)
                      AS employer_booking_count,
                  (SELECT COUNT(*) FROM bookings b
                     JOIN tradespeople t ON t.tradesperson_id = b.tradesperson_id
                    WHERE t.user_id = u.user_id)
                      AS tradesperson_booking_count
             FROM users u
            ORDER BY u.user_id ASC"""
    )
    rows = cursor.fetchall()
    cursor.close(); db.close()

    return jsonify({
        'users': [
            {
                'user_id':    r['user_id'],
                'first_name': r['first_name'],
                'last_name':  r['last_name'],
                'email':      r['email'],
                'user_type':  r['user_type'],
                'city':       r.get('city'),
                'state':      r.get('state'),
                'is_active':  bool(r.get('is_active', True)),
                'created_at': iso(r.get('created_at')),
                'last_login_at': iso(r.get('last_login_at')),
                'employer_booking_count':     int(r.get('employer_booking_count') or 0),
                'tradesperson_booking_count': int(r.get('tradesperson_booking_count') or 0),
            }
            for r in rows
        ]
    }), 200


# ────────────────────────────────────────────────────────────
# DELETE /api/admin/users/<id>
# Removes a user. Admins can't delete themselves; that would lock
# them out of their own panel.
# ────────────────────────────────────────────────────────────
@admin.route('/users/<int:user_id>', methods=['DELETE'])
@_admin_required
def delete_user(user_id):
    if user_id == current_user_id():
        return jsonify({'error': 'You cannot delete your own admin account'}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute(
        "SELECT user_id, user_type FROM users WHERE user_id = %s",
        (user_id,),
    )
    row = cursor.fetchone()
    if not row:
        cursor.close(); db.close()
        return jsonify({'error': 'User not found'}), 404

    try:
        # ON DELETE CASCADE on the FKs takes care of tradespeople,
        # bookings, applications, etc.
        cursor.execute("DELETE FROM users WHERE user_id = %s", (user_id,))
        db.commit()
    except Exception as e:
        db.rollback()
        cursor.close(); db.close()
        return jsonify({'error': str(e)}), 400

    cursor.close(); db.close()
    return jsonify({'message': 'User deleted', 'user_id': user_id}), 200


# ────────────────────────────────────────────────────────────
# GET /api/admin/settings
# Read the single row of platform settings (fee %).
# ────────────────────────────────────────────────────────────
@admin.route('/settings', methods=['GET'])
@_admin_required
def get_settings():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT setting_id, platform_fee_percentage, updated_at
             FROM platform_settings WHERE setting_id = 1"""
    )
    row = cursor.fetchone()
    cursor.close(); db.close()

    if not row:
        # Self-heal if the seed row is missing
        db = get_db(); cursor = db.cursor(dictionary=True)
        cursor.execute(
            "INSERT INTO platform_settings (setting_id, platform_fee_percentage) VALUES (1, 10.00)"
        )
        db.commit()
        cursor.execute(
            "SELECT setting_id, platform_fee_percentage, updated_at FROM platform_settings WHERE setting_id = 1"
        )
        row = cursor.fetchone()
        cursor.close(); db.close()

    return jsonify({
        'settings': {
            'platform_fee_percentage': float(row['platform_fee_percentage']),
            'updated_at':              iso(row.get('updated_at')),
        }
    }), 200


# ────────────────────────────────────────────────────────────
# PUT /api/admin/settings
# Body: { platform_fee_percentage: number 0..100 }
# ────────────────────────────────────────────────────────────
@admin.route('/settings', methods=['PUT'])
@_admin_required
def update_settings():
    data = request.get_json(force=True) or {}
    raw = data.get('platform_fee_percentage')

    try:
        pct = Decimal(str(raw))
    except (InvalidOperation, TypeError):
        return jsonify({'error': 'platform_fee_percentage must be a number'}), 400

    if pct < 0 or pct > 100:
        return jsonify({'error': 'platform_fee_percentage must be between 0 and 100'}), 400

    db = get_db()
    cursor = db.cursor()
    try:
        # Upsert into the single-row settings table.
        cursor.execute(
            """INSERT INTO platform_settings (setting_id, platform_fee_percentage)
                    VALUES (1, %s)
               ON DUPLICATE KEY UPDATE platform_fee_percentage = VALUES(platform_fee_percentage)""",
            (pct,),
        )
        db.commit()
    except Exception as e:
        db.rollback()
        cursor.close(); db.close()
        return jsonify({'error': str(e)}), 400

    cursor.close(); db.close()
    return jsonify({
        'message': 'Platform settings updated',
        'platform_fee_percentage': float(pct),
    }), 200


# ────────────────────────────────────────────────────────────
# GET /api/admin/subscription-plans
# Lists every plan in the catalog (including inactive ones), so
# the admin can edit prices in one place.
# ────────────────────────────────────────────────────────────
@admin.route('/subscription-plans', methods=['GET'])
@_admin_required
def list_plans():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT plan_id, plan_name, description, monthly_price, job_limit, is_active
             FROM subscription_plans
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
                'is_active':     bool(r['is_active']),
            }
            for r in rows
        ]
    }), 200


# ────────────────────────────────────────────────────────────
# PUT /api/admin/subscription-plans/<id>
# Body: { monthly_price?: number, job_limit?: int, is_active?: bool }
#
# Only fields present in the body are updated. Existing
# subscribers keep their old price_at_purchase snapshot.
# ────────────────────────────────────────────────────────────
@admin.route('/subscription-plans/<int:plan_id>', methods=['PUT'])
@_admin_required
def update_plan(plan_id):
    data = request.get_json(force=True) or {}

    updates = []
    params  = []

    if 'monthly_price' in data:
        try:
            price = Decimal(str(data['monthly_price']))
        except (InvalidOperation, TypeError):
            return jsonify({'error': 'monthly_price must be a number'}), 400
        if price < 0:
            return jsonify({'error': 'monthly_price must be >= 0'}), 400
        updates.append('monthly_price = %s')
        params.append(price)

    if 'job_limit' in data:
        try:
            jl = int(data['job_limit'])
        except (TypeError, ValueError):
            return jsonify({'error': 'job_limit must be an integer'}), 400
        if jl < 0:
            return jsonify({'error': 'job_limit must be >= 0'}), 400
        updates.append('job_limit = %s')
        params.append(jl)

    if 'is_active' in data:
        updates.append('is_active = %s')
        params.append(bool(data['is_active']))

    if not updates:
        return jsonify({'error': 'No updatable fields provided'}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute("SELECT plan_id FROM subscription_plans WHERE plan_id = %s", (plan_id,))
    if not cursor.fetchone():
        cursor.close(); db.close()
        return jsonify({'error': 'Plan not found'}), 404

    params.append(plan_id)
    try:
        cursor.execute(
            f"UPDATE subscription_plans SET {', '.join(updates)} WHERE plan_id = %s",
            params,
        )
        db.commit()
    except Exception as e:
        db.rollback()
        cursor.close(); db.close()
        return jsonify({'error': str(e)}), 400

    cursor.execute(
        """SELECT plan_id, plan_name, description, monthly_price, job_limit, is_active
             FROM subscription_plans WHERE plan_id = %s""",
        (plan_id,),
    )
    row = cursor.fetchone()
    cursor.close(); db.close()

    return jsonify({
        'message': 'Plan updated',
        'plan': {
            'plan_id':       row['plan_id'],
            'plan_name':     row['plan_name'],
            'description':   row['description'],
            'monthly_price': float(row['monthly_price']),
            'job_limit':     row['job_limit'],
            'is_active':     bool(row['is_active']),
        },
    }), 200

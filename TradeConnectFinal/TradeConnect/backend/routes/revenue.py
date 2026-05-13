"""
/api/revenue — simple revenue summary for the business model.
"""
from flask import Blueprint, jsonify
from routes._helpers import get_db, login_required, current_user_type

revenue = Blueprint('revenue', __name__)


@revenue.route('/summary', methods=['GET'])
@login_required
def summary():
    # Only Admin users may view the platform-wide revenue summary.
    if current_user_type() != 'Admin':
        return jsonify({'error': 'Only admins can view the revenue summary'}), 403

    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute(
        "SELECT COALESCE(SUM(amount), 0) AS total_payment_volume FROM payments WHERE status='paid'"
    )
    total_payment_volume = cursor.fetchone()['total_payment_volume']

    cursor.execute("SELECT COALESCE(SUM(fee_amount), 0) AS total_platform_fees FROM platform_fees")
    total_platform_fees = cursor.fetchone()['total_platform_fees']

    cursor.execute(
        """SELECT COUNT(*) AS active_subscriptions,
                  COALESCE(SUM(price_at_purchase), 0) AS monthly_subscription_revenue
             FROM subscriptions
            WHERE status='active'"""
    )
    subs = cursor.fetchone()

    cursor.execute(
        """SELECT rs.stream_name,
                  COALESCE(SUM(pf.fee_amount), 0) AS revenue
             FROM revenue_streams rs
             LEFT JOIN platform_fees pf ON pf.revenue_stream_id = rs.revenue_stream_id
            GROUP BY rs.revenue_stream_id, rs.stream_name
            ORDER BY rs.stream_name"""
    )
    streams = cursor.fetchall()

    cursor.close(); db.close()

    total_estimated_revenue = total_platform_fees + subs['monthly_subscription_revenue']
    return jsonify({
        'total_payment_volume': float(total_payment_volume),
        'total_platform_fees': float(total_platform_fees),
        'active_subscriptions': int(subs['active_subscriptions']),
        'monthly_subscription_revenue': float(subs['monthly_subscription_revenue']),
        'total_estimated_revenue': float(total_estimated_revenue),
        'streams': [
            {'stream_name': r['stream_name'], 'revenue': float(r['revenue'])}
            for r in streams
        ],
    }), 200

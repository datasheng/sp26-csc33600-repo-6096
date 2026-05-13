"""
/api/services
"""
from flask import Blueprint, request, jsonify
from routes._helpers import (
    get_db, login_required, current_user_id, current_user_type,
    get_tradesperson_id_for_user,
)

services = Blueprint('services', __name__)


def _serialize(s):
    return {
        'service_id':      s['service_id'],
        'tradesperson_id': s['tradesperson_id'],
        'service_name':    s['service_name'],
        'description':     s.get('description'),
        'hourly_rate':     float(s['hourly_rate']) if s.get('hourly_rate') is not None else None,
        'trade_type':      s.get('trade_type'),
    }


# GET /api/services?trade_type=Plumbing&city=NYC
@services.route('', methods=['GET'])
@services.route('/', methods=['GET'])
def search():
    trade_type = request.args.get('trade_type')
    city       = request.args.get('city')

    sql = """
        SELECT s.* FROM services s
        JOIN tradespeople t ON t.tradesperson_id = s.tradesperson_id
        JOIN users u ON u.user_id = t.user_id
        WHERE u.is_active = TRUE
    """
    params = []
    if trade_type and trade_type.lower() != 'all':
        sql += " AND s.trade_type = %s"
        params.append(trade_type)
    if city:
        sql += " AND u.city LIKE %s"
        params.append(f"%{city}%")

    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(sql, params)
    rows = cursor.fetchall()
    cursor.close(); db.close()

    return jsonify({'services': [_serialize(r) for r in rows]}), 200


# GET /api/services/tradesperson/<id>
@services.route('/tradesperson/<int:tp_id>', methods=['GET'])
def for_tradesperson(tp_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM services WHERE tradesperson_id = %s ORDER BY service_name",
        (tp_id,),
    )
    rows = cursor.fetchall()
    cursor.close(); db.close()
    return jsonify({'services': [_serialize(r) for r in rows]}), 200


# POST /api/services — create a service for the logged-in tradesperson
@services.route('', methods=['POST'])
@services.route('/', methods=['POST'])
@login_required
def create():
    if current_user_type() not in ('Tradesperson', 'Junior'):
        return jsonify({'error': 'Only tradespeople can create services'}), 403

    data = request.get_json(force=True)
    service_name = data.get('service_name')
    description  = data.get('description')
    hourly_rate  = data.get('hourly_rate')
    trade_type   = data.get('trade_type')

    if not service_name:
        return jsonify({'error': 'service_name is required'}), 400

    db = get_db()
    cursor = db.cursor()
    tp_id = get_tradesperson_id_for_user(cursor, current_user_id())
    if not tp_id:
        cursor.close(); db.close()
        return jsonify({'error': 'No trade profile found — set one up first'}), 400

    cursor.execute(
        """INSERT INTO services
           (tradesperson_id, service_name, description, hourly_rate, trade_type)
           VALUES (%s, %s, %s, %s, %s)""",
        (tp_id, service_name, description, hourly_rate, trade_type),
    )
    db.commit()
    new_id = cursor.lastrowid
    cursor.close(); db.close()

    return jsonify({'message': 'Service created', 'service_id': new_id}), 201

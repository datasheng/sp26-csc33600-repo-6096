from flask import Blueprint, request, jsonify, session
from routes._helpers import get_db

auth = Blueprint('auth', __name__)



# ────────────────────────────────────────────────────────────
# POST /api/auth/register
# ────────────────────────────────────────────────────────────
@auth.route('/register', methods=['POST'])
def register():
    data = request.get_json(force=True)

    first_name = data.get('first_name')
    last_name  = data.get('last_name')
    email      = data.get('email')
    password   = data.get('password')
    user_type  = data.get('user_type')   # 'Employer' | 'Tradesperson' | 'Junior'
    phone      = data.get('phone', '')
    city       = data.get('city', '')
    state      = data.get('state', '')

    if not first_name or not last_name or not email or not password or not user_type:
        return jsonify({'error': 'All fields required'}), 400

    if user_type not in ('Employer', 'Tradesperson', 'Junior'):
        return jsonify({'error': 'Invalid user type'}), 400
    # Admin accounts cannot be self-created via /register. They are seeded
    # in sample_data.sql or created by another admin from the admin panel.

    db = get_db()
    cursor = db.cursor()

    cursor.execute("SELECT user_id FROM users WHERE email = %s", (email,))
    if cursor.fetchone():
        cursor.close(); db.close()
        return jsonify({'error': 'Email already registered'}), 400

    cursor.execute(
        """INSERT INTO users
           (first_name, last_name, email, password_hash, user_type, phone, city, state)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
        (first_name, last_name, email, password, user_type, phone, city, state),
    )
    db.commit()
    new_user_id = cursor.lastrowid

    # Auto-create tradespeople row for Tradesperson/Junior so later inserts have FK
    if user_type in ('Tradesperson', 'Junior'):
        cursor.execute(
            """INSERT INTO tradespeople (user_id, trade_category, experience_year)
               VALUES (%s, %s, %s)""",
            (new_user_id, 'Unassigned', 0),
        )
        db.commit()

    session['user_id']   = new_user_id
    session['user_type'] = user_type

    cursor.close(); db.close()

    return jsonify({
        'message': 'User registered successfully',
        'user_id': new_user_id,
        'first_name': first_name,
        'last_name': last_name,
        'email': email,
        'user_type': user_type,
        'city': city,
        'state': state,
    }), 201


# ────────────────────────────────────────────────────────────
# POST /api/auth/login
# ────────────────────────────────────────────────────────────
@auth.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email    = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Email and password required'}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT user_id, first_name, last_name, email, user_type,
                  phone, address, city, state, zip, is_active, created_at
           FROM users
           WHERE email = %s AND password_hash = %s AND is_active = TRUE""",
        (email, password),
    )
    user = cursor.fetchone()

    if user:
        cursor.execute(
            "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = %s",
            (user['user_id'],),
        )
        db.commit()

        session['user_id']   = user['user_id']
        session['user_type'] = user['user_type']

        cursor.close(); db.close()
        return jsonify({'message': 'Login successful', **_serialize_user(user)}), 200

    cursor.close(); db.close()
    return jsonify({'error': 'Invalid email or password'}), 401


# ────────────────────────────────────────────────────────────
# POST /api/auth/logout
# ────────────────────────────────────────────────────────────
@auth.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200


# ────────────────────────────────────────────────────────────
# GET /api/auth/me  — used by frontend to rehydrate session
# ────────────────────────────────────────────────────────────
@auth.route('/me', methods=['GET'])
def me():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401

    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT user_id, first_name, last_name, email, user_type,
                  phone, address, city, state, zip, is_active, created_at
           FROM users WHERE user_id = %s""",
        (user_id,),
    )
    user = cursor.fetchone()
    cursor.close(); db.close()

    if not user:
        session.clear()
        return jsonify({'error': 'User not found'}), 404

    return jsonify({'user': _serialize_user(user)}), 200


def _serialize_user(row):
    """Convert DB row → JSON-friendly dict matching frontend User type."""
    return {
        'user_id':    row['user_id'],
        'first_name': row['first_name'],
        'last_name':  row['last_name'],
        'email':      row['email'],
        'user_type':  row['user_type'],
        'phone':      row.get('phone'),
        'address':    row.get('address'),
        'city':       row.get('city'),
        'state':      row.get('state'),
        'zip':        row.get('zip'),
        'is_active':  bool(row.get('is_active', True)),
        'created_at': row['created_at'].isoformat() if row.get('created_at') else '',
    }

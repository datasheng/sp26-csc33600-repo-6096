"""
/api/users — profile updates for the logged-in user.
"""
from flask import Blueprint, request, jsonify
from routes._helpers import (
    get_db, login_required, current_user_id, iso,
)

users = Blueprint('users', __name__)


# PUT /api/users/profile  — update editable fields on own user row
@users.route('/profile', methods=['PUT'])
@login_required
def update_profile():
    data = request.get_json(force=True)

    # Whitelist of fields the user is allowed to update
    fields = ['first_name', 'last_name', 'phone', 'address', 'city', 'state', 'zip']
    updates = {f: data.get(f) for f in fields if f in data}

    if not updates:
        return jsonify({'error': 'No updatable fields provided'}), 400

    set_clause = ', '.join(f"{k} = %s" for k in updates.keys())
    params = list(updates.values()) + [current_user_id()]

    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(f"UPDATE users SET {set_clause} WHERE user_id = %s", params)
    db.commit()

    # Return updated user
    cursor.execute(
        """SELECT user_id, first_name, last_name, email, user_type,
                  phone, address, city, state, zip, is_active, created_at
           FROM users WHERE user_id = %s""",
        (current_user_id(),),
    )
    row = cursor.fetchone()
    cursor.close(); db.close()

    return jsonify({
        'message': 'Profile updated',
        'user': {
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
            'created_at': iso(row.get('created_at')) or '',
        },
    }), 200

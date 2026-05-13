"""
Shared helpers used by every route blueprint.
"""
from functools import wraps
from flask import session, jsonify
from db import get_db


def login_required(fn):
    """Decorator: 401 if no user_id in session."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get('user_id'):
            return jsonify({'error': 'Authentication required'}), 401
        return fn(*args, **kwargs)
    return wrapper


def role_required(*allowed):
    """Decorator: 403 if session user_type is not in `allowed`."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not session.get('user_id'):
                return jsonify({'error': 'Authentication required'}), 401
            if session.get('user_type') not in allowed:
                return jsonify({'error': 'Forbidden for this user type'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def current_user_id():
    return session.get('user_id')


def current_user_type():
    return session.get('user_type')


def get_tradesperson_id_for_user(cursor, user_id):
    """Look up tradesperson_id for a given user_id, or None."""
    cursor.execute(
        "SELECT tradesperson_id FROM tradespeople WHERE user_id = %s",
        (user_id,),
    )
    row = cursor.fetchone()
    if not row:
        return None
    # Handle both dict and tuple cursor styles
    return row['tradesperson_id'] if isinstance(row, dict) else row[0]


def iso(dt):
    """Format datetime/date for JSON. Returns None if input is None."""
    return dt.isoformat() if dt else None

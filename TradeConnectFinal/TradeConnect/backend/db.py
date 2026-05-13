"""Small database helper layer for the Flask API.

Routes should import get_db from here instead of redefining connection logic.
"""
from contextlib import contextmanager
import mysql.connector
from config import Config


def get_db(dictionary: bool = False):
    """Return a new MySQL connection.

    Flask opens/closes per request in this project, so pooling is unnecessary for
    a class demo. Keep this single source of truth to avoid duplicate config.
    """
    return mysql.connector.connect(
        host=Config.DB_HOST,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        database=Config.DB_NAME,
    )


@contextmanager
def db_cursor(dictionary: bool = True, commit: bool = False):
    """Yield (connection, cursor) and always close both.

    Set commit=True for write transactions. On errors, the transaction rolls back
    before the exception is re-raised to the route handler.
    """
    db = get_db()
    cursor = db.cursor(dictionary=dictionary)
    try:
        yield db, cursor
        if commit:
            db.commit()
    except Exception:
        if commit:
            db.rollback()
        raise
    finally:
        cursor.close()
        db.close()

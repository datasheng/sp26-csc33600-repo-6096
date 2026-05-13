"""
/api/documents — upload / download / list / delete files.

Security model:
  - Files live on disk in backend/uploads/<storage_filename>.
  - storage_filename is a UUID4 + original-extension. The original filename
    is preserved in DB only (never used to read/write disk).
  - All disk operations use the resolved absolute path and verify it's still
    inside UPLOAD_DIR (prevents path traversal even if storage_filename
    were ever tampered with).
  - Upload accepts only specific mime types AND validates by magic bytes,
    not by extension.
  - Download is gated by:
      * the uploader, always
      * the supervisor on the related endorsement_request, if any
  - Delete only by the uploader, and only while the related entity is in a
    "still editable" state (endorsement_request status = 'pending').

Public API:
  POST   /api/documents/upload                multipart file upload
  GET    /api/documents/<id>                  download (auth-gated)
  GET    /api/documents/<id>/info             metadata only (no file body)
  GET    /api/documents/mine                  list current user's uploads
  DELETE /api/documents/<id>                  uploader deletes (if allowed)

Linking docs to entities:
  - Upload alone leaves related_entity_type='other', related_entity_id=NULL.
  - When /api/endorsement_requests creates a request and the body includes
    document_ids, that route stamps those docs with the new request_id and
    type='endorsement_request'.
"""
import os
import uuid
from pathlib import Path
from flask import Blueprint, request, jsonify, send_file, abort
from werkzeug.utils import secure_filename

from routes._helpers import (
    get_db, login_required, current_user_id, current_user_type,
    get_tradesperson_id_for_user, iso,
)

documents = Blueprint('documents', __name__)

# ── Storage config ──────────────────────────────────────────
# Resolved absolute path to backend/uploads/. We use Path.resolve() so
# every later path comparison is on the canonical absolute form.
UPLOAD_DIR = (Path(__file__).resolve().parent.parent / 'uploads').resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# Allowed mime types and their magic-byte signatures.
# Verified against the file's actual content, not its extension.
ALLOWED_MIME_TYPES = {'application/pdf', 'image/jpeg', 'image/png'}

MAGIC_BYTES = {
    'application/pdf': [b'%PDF-'],
    'image/jpeg':      [b'\xff\xd8\xff'],
    'image/png':       [b'\x89PNG\r\n\x1a\n'],
}

EXTENSION_FOR_MIME = {
    'application/pdf': '.pdf',
    'image/jpeg':      '.jpg',
    'image/png':       '.png',
}


def _sniff_mime(data_head: bytes) -> str | None:
    """Return the mime type if the head bytes match a known signature."""
    for mime, sigs in MAGIC_BYTES.items():
        for sig in sigs:
            if data_head.startswith(sig):
                return mime
    return None


def _safe_path(storage_filename: str) -> Path:
    """
    Resolve a storage_filename to an absolute path *inside UPLOAD_DIR*.
    Raises ValueError if the resolved path escapes UPLOAD_DIR.
    """
    # Defence-in-depth: reject anything that looks like a path
    if '/' in storage_filename or '\\' in storage_filename or '..' in storage_filename:
        raise ValueError('invalid storage filename')
    candidate = (UPLOAD_DIR / storage_filename).resolve()
    # Must still be inside UPLOAD_DIR after resolve()
    if UPLOAD_DIR not in candidate.parents and candidate != UPLOAD_DIR:
        raise ValueError('path traversal detected')
    return candidate


def _serialize(d):
    return {
        'document_id':         d['document_id'],
        'uploaded_by_user_id': d['uploaded_by_user_id'],
        'original_filename':   d['original_filename'],
        'mime_type':           d['mime_type'],
        'file_size_bytes':     d['file_size_bytes'],
        'related_entity_type': d['related_entity_type'],
        'related_entity_id':   d.get('related_entity_id'),
        'created_at':          iso(d.get('created_at')),
    }


def _user_can_read(cursor, doc, user_id, user_type) -> bool:
    """
    Authorization for downloading/viewing a document.

    Allowed:
      - the uploader, always
      - the supervisor on the related endorsement_request, if any
    """
    if doc['uploaded_by_user_id'] == user_id:
        return True

    if (doc['related_entity_type'] == 'endorsement_request'
            and doc.get('related_entity_id') is not None
            and user_type in ('Tradesperson', 'Junior')):
        sup_tp_id = get_tradesperson_id_for_user(cursor, user_id)
        if sup_tp_id is None:
            return False
        cursor.execute(
            """SELECT supervisor_tradesperson_id
                 FROM endorsement_requests
                WHERE endorsement_request_id = %s""",
            (doc['related_entity_id'],),
        )
        row = cursor.fetchone()
        if row and row['supervisor_tradesperson_id'] == sup_tp_id:
            return True

    return False


# ────────────────────────────────────────────────────────────
# POST /api/documents/upload
# Multipart form: file=<the file>
# ────────────────────────────────────────────────────────────
@documents.route('/upload', methods=['POST'])
@login_required
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file in request (multipart field "file" expected)'}), 400

    upload = request.files['file']
    if not upload or not upload.filename:
        return jsonify({'error': 'Empty upload'}), 400

    # Read enough bytes to sniff the magic header BEFORE allowing the
    # rest of the file to be processed. We then read the full body
    # under a size cap.
    head = upload.stream.read(16)
    detected_mime = _sniff_mime(head)
    if detected_mime not in ALLOWED_MIME_TYPES:
        return jsonify({'error': 'Unsupported file type (only PDF, JPG, PNG)'}), 400

    # Now read the rest, enforcing the size cap.
    body = upload.stream.read(MAX_FILE_SIZE + 1)
    full = head + body
    if len(full) > MAX_FILE_SIZE:
        return jsonify({'error': f'File too large (max {MAX_FILE_SIZE // (1024*1024)} MB)'}), 400

    # Pick a storage filename: UUID4 + canonical extension. The original
    # filename never touches the disk path.
    storage_filename = f'{uuid.uuid4().hex}{EXTENSION_FOR_MIME[detected_mime]}'
    safe_original = secure_filename(upload.filename) or f'upload{EXTENSION_FOR_MIME[detected_mime]}'

    try:
        dest = _safe_path(storage_filename)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    # Write atomically: write to a temp file in the same directory then rename.
    tmp = dest.with_suffix(dest.suffix + '.tmp')
    try:
        with open(tmp, 'wb') as f:
            f.write(full)
        os.replace(tmp, dest)
    except Exception as e:
        # Best-effort cleanup
        try: tmp.unlink()
        except FileNotFoundError: pass
        return jsonify({'error': f'Failed to save file: {e}'}), 500

    # Record metadata
    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute(
            """INSERT INTO documents
                  (uploaded_by_user_id, original_filename, storage_filename,
                   mime_type, file_size_bytes, related_entity_type, related_entity_id)
               VALUES (%s, %s, %s, %s, %s, 'other', NULL)""",
            (current_user_id(), safe_original, storage_filename,
             detected_mime, len(full)),
        )
        db.commit()
        new_id = cursor.lastrowid
    except Exception as e:
        # Roll back the file on disk if the DB row failed
        try: dest.unlink()
        except FileNotFoundError: pass
        cursor.close(); db.close()
        return jsonify({'error': f'Database insert failed: {e}'}), 500

    cursor.close(); db.close()
    return jsonify({
        'message':           'Uploaded',
        'document_id':       new_id,
        'original_filename': safe_original,
        'mime_type':         detected_mime,
        'file_size_bytes':   len(full),
    }), 201


# ────────────────────────────────────────────────────────────
# GET /api/documents/<id>/info  — metadata only
# ────────────────────────────────────────────────────────────
@documents.route('/<int:doc_id>/info', methods=['GET'])
@login_required
def get_info(doc_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM documents WHERE document_id = %s", (doc_id,))
    doc = cursor.fetchone()
    if not doc:
        cursor.close(); db.close()
        return jsonify({'error': 'Document not found'}), 404

    if not _user_can_read(cursor, doc, current_user_id(), current_user_type()):
        cursor.close(); db.close()
        return jsonify({'error': 'Forbidden'}), 403

    cursor.close(); db.close()
    return jsonify({'document': _serialize(doc)}), 200


# ────────────────────────────────────────────────────────────
# GET /api/documents/<id>  — actual file download
# ────────────────────────────────────────────────────────────
@documents.route('/<int:doc_id>', methods=['GET'])
@login_required
def download(doc_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM documents WHERE document_id = %s", (doc_id,))
    doc = cursor.fetchone()
    if not doc:
        cursor.close(); db.close()
        return jsonify({'error': 'Document not found'}), 404

    if not _user_can_read(cursor, doc, current_user_id(), current_user_type()):
        cursor.close(); db.close()
        return jsonify({'error': 'Forbidden'}), 403

    cursor.close(); db.close()

    try:
        path = _safe_path(doc['storage_filename'])
    except ValueError:
        return jsonify({'error': 'Invalid stored file reference'}), 500

    if not path.exists():
        return jsonify({'error': 'File missing on disk'}), 410

    # send_file handles Content-Length, ETag, byte ranges, etc.
    return send_file(
        path,
        mimetype=doc['mime_type'],
        as_attachment=False,                              # inline display
        download_name=doc['original_filename'],
    )


# ────────────────────────────────────────────────────────────
# GET /api/documents/mine  — current user's uploads
# ────────────────────────────────────────────────────────────
@documents.route('/mine', methods=['GET'])
@login_required
def my_documents():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """SELECT * FROM documents
            WHERE uploaded_by_user_id = %s
            ORDER BY created_at DESC""",
        (current_user_id(),),
    )
    rows = cursor.fetchall()
    cursor.close(); db.close()
    return jsonify({'documents': [_serialize(d) for d in rows]}), 200


# ────────────────────────────────────────────────────────────
# DELETE /api/documents/<id>
# Uploader can delete UNLINKED documents (related_entity_type='other')
# or those attached to a still-pending endorsement_request.
# Once a request is approved/rejected, the documents are kept for record.
# ────────────────────────────────────────────────────────────
@documents.route('/<int:doc_id>', methods=['DELETE'])
@login_required
def delete(doc_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM documents WHERE document_id = %s", (doc_id,))
    doc = cursor.fetchone()
    if not doc:
        cursor.close(); db.close()
        return jsonify({'error': 'Document not found'}), 404

    if doc['uploaded_by_user_id'] != current_user_id():
        cursor.close(); db.close()
        return jsonify({'error': 'Forbidden'}), 403

    # If linked to an endorsement_request, only allow delete while pending
    if doc['related_entity_type'] == 'endorsement_request' and doc.get('related_entity_id'):
        cursor.execute(
            "SELECT status FROM endorsement_requests WHERE endorsement_request_id = %s",
            (doc['related_entity_id'],),
        )
        er = cursor.fetchone()
        if er and er['status'] != 'pending':
            cursor.close(); db.close()
            return jsonify({
                'error': f"Cannot delete: linked endorsement request is already {er['status']!r}",
            }), 400

    # Delete the DB row first, then the file. If the file delete fails,
    # we lose the on-disk file later via a cleanup job (TODO) — but the
    # DB is the source of truth.
    try:
        cursor.execute("DELETE FROM documents WHERE document_id = %s", (doc_id,))
        db.commit()
    except Exception as e:
        cursor.close(); db.close()
        return jsonify({'error': f'Database delete failed: {e}'}), 500

    cursor.close(); db.close()

    try:
        path = _safe_path(doc['storage_filename'])
        if path.exists():
            path.unlink()
    except (ValueError, OSError):
        # File-system cleanup failure is non-fatal — DB row already gone
        pass

    return jsonify({'message': 'Document deleted'}), 200

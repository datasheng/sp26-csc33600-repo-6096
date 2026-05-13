"""
/api/endorsement_requests — junior asks senior for endorsement; senior decides.

The DB does the heavy lifting:
  - Trigger 6 sets tradespeople.endorse_id when status flips to 'approved'.
  - A unique-pending generated column prevents duplicate pending requests
    from the same junior to the same supervisor.

Routes:
  POST   /api/endorsement_requests                       junior creates
                                                          body: { supervisor_email,
                                                                  message?,
                                                                  document_ids? }
  GET    /api/endorsement_requests/mine                  junior's own requests
  GET    /api/endorsement_requests/incoming              senior's inbox
  POST   /api/endorsement_requests/<id>/decide           senior approves or rejects
                                                          body: { decision, note? }
  POST   /api/endorsement_requests/<id>/withdraw         junior withdraws (if pending)

The old POST /api/tradespeople/endorse route is DELETED — see
tradespeople.py.
"""
from flask import Blueprint, request, jsonify
from routes._helpers import (
    get_db, login_required, current_user_id, current_user_type,
    get_tradesperson_id_for_user, iso,
)

endorsement_requests = Blueprint('endorsement_requests', __name__)


def _shape(r):
    return {
        'endorsement_request_id':     r['endorsement_request_id'],
        'junior_tradesperson_id':     r['junior_tradesperson_id'],
        'supervisor_tradesperson_id': r['supervisor_tradesperson_id'],
        'message':                    r.get('message'),
        'status':                     r['status'],
        'decision_note':              r.get('decision_note'),
        'created_at':                 iso(r.get('created_at')),
        'decided_at':                 iso(r.get('decided_at')),
        # joined display
        'junior_name':     f"{r.get('jr_first','')} {r.get('jr_last','')}".strip() or None,
        'junior_email':    r.get('jr_email'),
        'junior_trade':    r.get('jr_trade'),
        'junior_experience_year': r.get('jr_experience'),
        'supervisor_name': f"{r.get('sup_first','')} {r.get('sup_last','')}".strip() or None,
        'supervisor_email': r.get('sup_email'),
        'documents':       r.get('documents', []),
    }


def _load_documents_for_request(cursor, request_id):
    cursor.execute(
        """SELECT document_id, original_filename, mime_type, file_size_bytes
             FROM documents
            WHERE related_entity_type = 'endorsement_request'
              AND related_entity_id   = %s
            ORDER BY created_at""",
        (request_id,),
    )
    return [{
        'document_id':       d['document_id'],
        'original_filename': d['original_filename'],
        'mime_type':         d['mime_type'],
        'file_size_bytes':   d['file_size_bytes'],
    } for d in cursor.fetchall()]


# ────────────────────────────────────────────────────────────
# POST /api/endorsement_requests
# Body: {
#   supervisor_email: string,            (required)
#   message?:         string,
#   document_ids?:    number[]           (must be uploaded by the same user
#                                         AND currently unlinked or already
#                                         linked to this same request)
# }
# ────────────────────────────────────────────────────────────
@endorsement_requests.route('', methods=['POST'])
@endorsement_requests.route('/', methods=['POST'])
@login_required
def create_request():
    if current_user_type() != 'Junior':
        return jsonify({'error': 'Only Juniors can request endorsement'}), 403

    data = request.get_json(force=True)
    supervisor_email = (data.get('supervisor_email') or '').strip().lower()
    message          = (data.get('message') or '').strip() or None
    document_ids     = data.get('document_ids') or []

    if not supervisor_email:
        return jsonify({'error': 'supervisor_email is required'}), 400
    if not isinstance(document_ids, list) or not all(isinstance(d, int) for d in document_ids):
        return jsonify({'error': 'document_ids must be a list of integers'}), 400

    user_id = current_user_id()
    db = get_db()
    cursor = db.cursor(dictionary=True)

    # Look up junior's own tradesperson_id
    jr_tp_id = get_tradesperson_id_for_user(cursor, user_id)
    if not jr_tp_id:
        cursor.close(); db.close()
        return jsonify({'error': 'No trade profile found — set one up first'}), 400

    # Look up supervisor by email. Must be a Tradesperson (not Junior, not Employer).
    cursor.execute(
        """SELECT t.tradesperson_id, u.user_type
             FROM users u JOIN tradespeople t ON t.user_id = u.user_id
            WHERE LOWER(u.email) = %s""",
        (supervisor_email,),
    )
    sup = cursor.fetchone()
    if not sup:
        cursor.close(); db.close()
        return jsonify({'error': 'No tradesperson found with that email'}), 404
    if sup['user_type'] != 'Tradesperson':
        cursor.close(); db.close()
        return jsonify({'error': 'Supervisor must be a senior Tradesperson'}), 400
    sup_tp_id = sup['tradesperson_id']

    if sup_tp_id == jr_tp_id:
        cursor.close(); db.close()
        return jsonify({'error': 'Cannot endorse yourself'}), 400

    # Validate the documents: every ID must exist, belong to the current user,
    # and be either unlinked or already linked to nothing (we don't reuse docs
    # across requests).
    if document_ids:
        # Build a parameterized IN clause safely
        in_clause = ', '.join(['%s'] * len(document_ids))
        cursor.execute(
            f"""SELECT document_id, uploaded_by_user_id,
                       related_entity_type, related_entity_id
                  FROM documents
                 WHERE document_id IN ({in_clause})""",
            document_ids,
        )
        docs = cursor.fetchall()
        if len(docs) != len(set(document_ids)):
            cursor.close(); db.close()
            return jsonify({'error': 'One or more document_ids do not exist'}), 400
        for d in docs:
            if d['uploaded_by_user_id'] != user_id:
                cursor.close(); db.close()
                return jsonify({'error': 'You do not own all of those documents'}), 403
            if d['related_entity_type'] != 'other' or d['related_entity_id'] is not None:
                cursor.close(); db.close()
                return jsonify({
                    'error': f'Document {d["document_id"]} is already linked to another record',
                }), 400

    # Create the request, then link the docs. Both in one transaction.
    try:
        cursor.execute(
            """INSERT INTO endorsement_requests
                  (junior_tradesperson_id, supervisor_tradesperson_id, message, status)
               VALUES (%s, %s, %s, 'pending')""",
            (jr_tp_id, sup_tp_id, message),
        )
        new_id = cursor.lastrowid

        if document_ids:
            in_clause = ', '.join(['%s'] * len(document_ids))
            params = ['endorsement_request', new_id] + list(document_ids)
            cursor.execute(
                f"""UPDATE documents
                       SET related_entity_type = %s,
                           related_entity_id   = %s
                     WHERE document_id IN ({in_clause})""",
                params,
            )

        db.commit()
    except Exception as e:
        db.rollback()
        cursor.close(); db.close()
        msg = str(e)
        # Unique pending-marker collision
        if 'uniq_pending_request' in msg or 'Duplicate' in msg:
            return jsonify({
                'error': 'You already have a pending request to this supervisor',
            }), 400
        return jsonify({'error': msg}), 400

    cursor.close(); db.close()
    return jsonify({
        'message': 'Endorsement request created',
        'endorsement_request_id': new_id,
    }), 201


# ────────────────────────────────────────────────────────────
# GET /api/endorsement_requests/mine
# Junior's own outgoing requests, all statuses.
# ────────────────────────────────────────────────────────────
@endorsement_requests.route('/mine', methods=['GET'])
@login_required
def my_requests():
    if current_user_type() != 'Junior':
        return jsonify({'requests': []}), 200

    db = get_db()
    cursor = db.cursor(dictionary=True)
    jr_tp_id = get_tradesperson_id_for_user(cursor, current_user_id())
    if not jr_tp_id:
        cursor.close(); db.close()
        return jsonify({'requests': []}), 200

    cursor.execute(
        """SELECT er.*,
                  jru.first_name AS jr_first, jru.last_name AS jr_last,
                  jru.email      AS jr_email,
                  jrt.trade_category    AS jr_trade,
                  jrt.experience_year   AS jr_experience,
                  supu.first_name AS sup_first, supu.last_name AS sup_last,
                  supu.email      AS sup_email
             FROM endorsement_requests er
             JOIN tradespeople jrt ON jrt.tradesperson_id = er.junior_tradesperson_id
             JOIN users jru        ON jru.user_id = jrt.user_id
             JOIN tradespeople supt ON supt.tradesperson_id = er.supervisor_tradesperson_id
             JOIN users supu       ON supu.user_id = supt.user_id
            WHERE er.junior_tradesperson_id = %s
            ORDER BY er.created_at DESC""",
        (jr_tp_id,),
    )
    rows = cursor.fetchall()
    for r in rows:
        r['documents'] = _load_documents_for_request(cursor, r['endorsement_request_id'])
    cursor.close(); db.close()
    return jsonify({'requests': [_shape(r) for r in rows]}), 200


# ────────────────────────────────────────────────────────────
# GET /api/endorsement_requests/incoming
# Senior's inbox: pending requests from juniors who want them as supervisor.
# Optional ?status=pending|approved|rejected|withdrawn
# ────────────────────────────────────────────────────────────
@endorsement_requests.route('/incoming', methods=['GET'])
@login_required
def incoming():
    if current_user_type() != 'Tradesperson':
        return jsonify({'requests': []}), 200

    status_q = request.args.get('status', 'pending')

    db = get_db()
    cursor = db.cursor(dictionary=True)
    sup_tp_id = get_tradesperson_id_for_user(cursor, current_user_id())
    if not sup_tp_id:
        cursor.close(); db.close()
        return jsonify({'requests': []}), 200

    sql = """
        SELECT er.*,
               jru.first_name AS jr_first, jru.last_name AS jr_last,
               jru.email      AS jr_email,
               jrt.trade_category    AS jr_trade,
               jrt.experience_year   AS jr_experience,
               supu.first_name AS sup_first, supu.last_name AS sup_last,
               supu.email      AS sup_email
          FROM endorsement_requests er
          JOIN tradespeople jrt ON jrt.tradesperson_id = er.junior_tradesperson_id
          JOIN users jru        ON jru.user_id = jrt.user_id
          JOIN tradespeople supt ON supt.tradesperson_id = er.supervisor_tradesperson_id
          JOIN users supu       ON supu.user_id = supt.user_id
         WHERE er.supervisor_tradesperson_id = %s
    """
    params = [sup_tp_id]
    if status_q in ('pending', 'approved', 'rejected', 'withdrawn'):
        sql += " AND er.status = %s"
        params.append(status_q)
    sql += " ORDER BY er.created_at DESC"

    cursor.execute(sql, params)
    rows = cursor.fetchall()
    for r in rows:
        r['documents'] = _load_documents_for_request(cursor, r['endorsement_request_id'])
    cursor.close(); db.close()
    return jsonify({'requests': [_shape(r) for r in rows]}), 200


# ────────────────────────────────────────────────────────────
# POST /api/endorsement_requests/<id>/decide
# Body: { decision: 'approve' | 'reject', note?: string }
# Only the supervisor named on the request can decide.
# Trigger 6 sets tradespeople.endorse_id when approving.
# ────────────────────────────────────────────────────────────
@endorsement_requests.route('/<int:request_id>/decide', methods=['POST'])
@login_required
def decide(request_id):
    if current_user_type() != 'Tradesperson':
        return jsonify({'error': 'Only senior tradespeople can decide endorsements'}), 403

    data = request.get_json(force=True)
    decision = (data.get('decision') or '').strip().lower()
    note     = (data.get('note') or '').strip() or None
    if decision not in ('approve', 'reject'):
        return jsonify({'error': "decision must be 'approve' or 'reject'"}), 400

    new_status = 'approved' if decision == 'approve' else 'rejected'

    db = get_db()
    cursor = db.cursor(dictionary=True)
    sup_tp_id = get_tradesperson_id_for_user(cursor, current_user_id())
    if not sup_tp_id:
        cursor.close(); db.close()
        return jsonify({'error': 'No trade profile'}), 400

    cursor.execute(
        """SELECT supervisor_tradesperson_id, status
             FROM endorsement_requests
            WHERE endorsement_request_id = %s""",
        (request_id,),
    )
    row = cursor.fetchone()
    if not row:
        cursor.close(); db.close()
        return jsonify({'error': 'Request not found'}), 404
    if row['supervisor_tradesperson_id'] != sup_tp_id:
        cursor.close(); db.close()
        return jsonify({'error': 'Forbidden'}), 403
    if row['status'] != 'pending':
        cursor.close(); db.close()
        return jsonify({'error': f'Already {row["status"]!r}'}), 400

    try:
        cursor.execute(
            """UPDATE endorsement_requests
                  SET status = %s, decision_note = %s
                WHERE endorsement_request_id = %s""",
            (new_status, note, request_id),
        )
        # On rejection, release the documents so the junior can re-use them
        # on a future request. On approval, keep them linked as part of the
        # audit trail.
        if new_status == 'rejected':
            cursor.execute(
                """UPDATE documents
                      SET related_entity_type = 'other', related_entity_id = NULL
                    WHERE related_entity_type = 'endorsement_request'
                      AND related_entity_id   = %s""",
                (request_id,),
            )
        db.commit()
    except Exception as e:
        db.rollback()
        cursor.close(); db.close()
        return jsonify({'error': str(e)}), 400

    cursor.close(); db.close()
    return jsonify({'message': f'Request {new_status}'}), 200


# ────────────────────────────────────────────────────────────
# POST /api/endorsement_requests/<id>/withdraw
# Junior withdraws their own pending request.
# ────────────────────────────────────────────────────────────
@endorsement_requests.route('/<int:request_id>/withdraw', methods=['POST'])
@login_required
def withdraw(request_id):
    if current_user_type() != 'Junior':
        return jsonify({'error': 'Forbidden'}), 403

    db = get_db()
    cursor = db.cursor(dictionary=True)
    jr_tp_id = get_tradesperson_id_for_user(cursor, current_user_id())

    cursor.execute(
        """SELECT junior_tradesperson_id, status
             FROM endorsement_requests
            WHERE endorsement_request_id = %s""",
        (request_id,),
    )
    row = cursor.fetchone()
    if not row:
        cursor.close(); db.close()
        return jsonify({'error': 'Request not found'}), 404
    if row['junior_tradesperson_id'] != jr_tp_id:
        cursor.close(); db.close()
        return jsonify({'error': 'Forbidden'}), 403
    if row['status'] != 'pending':
        cursor.close(); db.close()
        return jsonify({'error': f'Cannot withdraw — already {row["status"]!r}'}), 400

    cursor.execute(
        "UPDATE endorsement_requests SET status='withdrawn' WHERE endorsement_request_id=%s",
        (request_id,),
    )
    # Release the attached documents back to the unlinked pool so the
    # junior can re-use them on a new request.
    cursor.execute(
        """UPDATE documents
              SET related_entity_type = 'other', related_entity_id = NULL
            WHERE related_entity_type = 'endorsement_request'
              AND related_entity_id   = %s""",
        (request_id,),
    )
    db.commit()
    cursor.close(); db.close()
    return jsonify({'message': 'Request withdrawn'}), 200

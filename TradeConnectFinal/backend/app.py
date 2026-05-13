from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os

load_dotenv()


def create_app():
    app = Flask(__name__)
    app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-key')
    app.config.update(
        SESSION_COOKIE_SAMESITE='None',
        SESSION_COOKIE_SECURE=True,
        SESSION_COOKIE_HTTPONLY=True,
        MAX_CONTENT_LENGTH=15 * 1024 * 1024,
    )

    CORS(
        app,
        origins=[os.getenv('FRONTEND_URL', 'http://localhost:3000')],
        supports_credentials=True,
        allow_headers=['Content-Type', 'Authorization'],
        methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    )

    from routes.auth import auth
    from routes.users import users
    from routes.tradespeople import tradespeople
    from routes.services import services
    from routes.bookings import bookings
    from routes.payments import payments
    from routes.reviews import reviews
    from routes.notifications import notifications
    from routes.jobs import jobs
    from routes.job_postings import job_postings
    from routes.job_applications import job_applications
    from routes.endorsement_requests import endorsement_requests
    from routes.documents import documents
    from routes.subscriptions import subscriptions
    from routes.revenue import revenue
    from routes.admin import admin

    blueprints = [
        (auth, '/api/auth'),
        (users, '/api/users'),
        (tradespeople, '/api/tradespeople'),
        (services, '/api/services'),
        (bookings, '/api/bookings'),
        (payments, '/api/payments'),
        (reviews, '/api/reviews'),
        (notifications, '/api/notifications'),
        (jobs, '/api/jobs'),
        (job_postings, '/api/job_postings'),
        (job_applications, '/api/job_applications'),
        (endorsement_requests, '/api/endorsement_requests'),
        (documents, '/api/documents'),
        (subscriptions, '/api/subscriptions'),
        (revenue, '/api/revenue'),
        (admin, '/api/admin'),
    ]
    for blueprint, prefix in blueprints:
        app.register_blueprint(blueprint, url_prefix=prefix)

    @app.get('/')
    def home():
        return jsonify({'message': 'TradeConnect API is running'})

    @app.get('/api/health')
    def health():
        return jsonify({'status': 'ok'})

    return app


app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=os.getenv('FLASK_DEBUG', '0') == '1', port=5001)
		

"""Firebase Admin SDK initialization — loaded once at startup."""
import os
import logging

logger = logging.getLogger(__name__)

firebase_initialized = False

try:
    import firebase_admin
    from firebase_admin import credentials, auth, storage, messaging

    def _build_credentials() -> "credentials.Certificate":
        key = os.environ.get("FIREBASE_PRIVATE_KEY", "")
        key = key.replace("\\\\n", "\n").replace("\\n", "\n").strip()
        if key.startswith('"') and key.endswith('"'):
            key = key[1:-1]

        cert = {
            "type": "service_account",
            "project_id": os.environ.get("FIREBASE_PROJECT_ID", ""),
            "private_key": key,
            "client_email": os.environ.get("FIREBASE_CLIENT_EMAIL", ""),
            "token_uri": "https://oauth2.googleapis.com/token",
        }
        return credentials.Certificate(cert)

    def init_firebase():
        global firebase_initialized
        if firebase_initialized or len(firebase_admin._apps) > 0:
            firebase_initialized = True
            return
        try:
            cred = _build_credentials()
            bucket_name = os.environ.get("FIREBASE_STORAGE_BUCKET", "")
            firebase_admin.initialize_app(cred, {"storageBucket": bucket_name})
            firebase_initialized = True
            logger.info("Firebase Admin SDK initialized")
        except Exception as exc:
            logger.warning("Firebase Admin SDK NOT initialized: %s", exc)

    def get_auth():
        return auth

    def get_bucket():
        return storage.bucket()

    def get_messaging():
        return messaging

except ImportError as exc:
    logger.warning("firebase_admin package not available: %s", exc)

    def init_firebase():
        logger.warning("Firebase unavailable — firebase_admin not installed")

    def get_auth():
        raise RuntimeError("Firebase not initialized")

    def get_bucket():
        raise RuntimeError("Firebase not initialized")

    def get_messaging():
        raise RuntimeError("Firebase not initialized")


def is_initialized() -> bool:
    return firebase_initialized

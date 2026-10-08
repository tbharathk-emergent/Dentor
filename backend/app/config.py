import os

MONGO_URL = os.getenv("MONGO_URL", "mongodb://127.0.0.1:27017")
DB_NAME = os.getenv("DB_NAME", "dentor")
JWT_SECRET = os.getenv("JWT_SECRET", "dentor-dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "720"))

ADMIN_EMAIL = "admin@dentor.in"
ADMIN_DEFAULT_PASSWORD = "Dentor@2026"

# Platform owner account, above all clinics. Override the password outside local development.
SUPER_ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "superadmin@dentor.in")
SUPER_ADMIN_DEFAULT_PASSWORD = os.getenv("SUPER_ADMIN_PASSWORD", "SuperAdmin@2026")

from pathlib import Path
from datetime import timedelta
from decouple import config
import os
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config('SECRET_KEY', default='django-insecure-fallback-dev-key-change-in-prod')
DEBUG = config('DEBUG', default=True, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1,*').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'apps.auth_app',
    'apps.users',
    'apps.uploads',
    'apps.outputs',
    'apps.cleanup',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.auth_app.middleware.TenantMiddleware',
]

ROOT_URLCONF = 'camate.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'camate.wsgi.application'
ASGI_APPLICATION = 'camate.asgi.application'

DATABASE_ROUTERS = ['services.db_router.CADatabaseRouter']

# ── Database ──────────────────────────────────────────────────────────────────
# Supports both SQLite (local dev) and PostgreSQL (production)
_master_db_url = config('MASTER_DB_URL', default=f'sqlite:///{BASE_DIR}/camate_master.db')
DATABASES = {
    'default': dj_database_url.config(default=_master_db_url)
}

# ── REST Framework ────────────────────────────────────────────────────────────
# We handle JWT auth manually via get_current_user_payload() in each view.
# DRF's JWTAuthentication is disabled because it tries to look up user_id in
# Django's auth_user table (integer PK) but our users use UUID PKs → crash.
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [],   # No DRF auth — we decode JWT manually
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',  # Per-view permissions handle access control
    ],
}

# ── JWT ───────────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=config('JWT_ACCESS_TOKEN_EXPIRE_MINUTES', cast=int, default=60)),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=config('JWT_REFRESH_TOKEN_EXPIRE_DAYS', cast=int, default=7)),
    'SIGNING_KEY': config('JWT_SECRET', default='camate-jwt-dev-secret-change-in-production'),
    'AUTH_HEADER_TYPES': ('Bearer',),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:3000,http://localhost:5173'
).split(',')
CORS_ALLOW_CREDENTIALS = True

# ── Celery / Redis ────────────────────────────────────────────────────────────
CELERY_BROKER_URL = config('REDIS_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = config('REDIS_URL', default='redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Asia/Kolkata'
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes

from celery.schedules import crontab
CELERY_BEAT_SCHEDULE = {
    'cleanup-expired-uploads': {
        'task': 'apps.cleanup.tasks.cleanup_expired_uploads',
        'schedule': crontab(hour=2, minute=0),
    },
}

# ── Internationalisation ──────────────────────────────────────────────────────
LANGUAGE_CODE = 'en-in'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
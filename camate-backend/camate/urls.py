from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.auth_app.urls')),
    path('api/users/', include('apps.users.urls')),
    path('api/uploads/', include('apps.uploads.urls')),
    path('api/outputs/', include('apps.outputs.urls')),
]

# Serve local_storage files as /media/ in development
if settings.DEBUG:
    from django.views.static import serve
    from services.r2 import STORAGE_ROOT
    urlpatterns += [
        path('media/<path:path>', serve, {'document_root': STORAGE_ROOT}),
    ]

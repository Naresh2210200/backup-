from rest_framework import views, status, permissions
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Upload
from .serializers import (
    UploadPresignSerializer, UploadConfirmSerializer,
    UploadListSerializer, MapSheetSerializer
)
from apps.users.models import Customer
from services.r2 import get_upload_presigned_url, STORAGE_ROOT
from apps.auth_app.middleware import get_current_user_payload
import os


class IsCustomer(permissions.BasePermission):
    def has_permission(self, request, view):
        payload = get_current_user_payload(request)
        return payload and payload.get('role') == 'customer'


class IsCA(permissions.BasePermission):
    def has_permission(self, request, view):
        payload = get_current_user_payload(request)
        return payload and payload.get('role') == 'ca'


class PresignUploadView(views.APIView):
    permission_classes = [IsCustomer]

    def post(self, request):
        payload = get_current_user_payload(request)
        serializer = UploadPresignSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            result = get_upload_presigned_url(
                ca_code=payload['ca_code'],
                customer_id=payload['user_id'],
                financial_year=data['financial_year'],
                month=data['month'],
                file_name=data['file_name']
            )
            return Response(result, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LocalUploadView(views.APIView):
    """
    Receives the actual file bytes in local dev mode (replaces direct R2 PUT).
    Frontend detects local_mode=True from presign response and POSTs here instead.
    """
    permission_classes = [IsCustomer]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        storage_key = request.query_params.get('key')
        if not storage_key:
            return Response({"error": "Missing storage key"}, status=status.HTTP_400_BAD_REQUEST)

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        # Save to local_storage/
        dest = STORAGE_ROOT / storage_key
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, 'wb') as f:
            for chunk in file_obj.chunks():
                f.write(chunk)

        return Response({"storage_key": storage_key, "saved": True}, status=status.HTTP_200_OK)


class ConfirmUploadView(views.APIView):
    permission_classes = [IsCustomer]

    def post(self, request):
        payload = get_current_user_payload(request)
        serializer = UploadConfirmSerializer(data=request.data)
        if serializer.is_valid():
            upload = serializer.save(
                customer_id=payload['user_id'],
                customer_name=payload['full_name'],
                status='Pending'
            )
            return Response({
                "upload_id": upload.id,
                "file_name": upload.file_name,
                "status": upload.status,
                "expires_at": upload.expires_at
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MyUploadsView(views.APIView):
    permission_classes = [IsCustomer]

    def get(self, request):
        payload = get_current_user_payload(request)
        fy = request.query_params.get('financial_year')
        month = request.query_params.get('month')

        queryset = Upload.objects.filter(customer_id=payload['user_id'])
        if fy:    queryset = queryset.filter(financial_year=fy)
        if month: queryset = queryset.filter(month=month)

        serializer = UploadListSerializer(queryset.order_by('-uploaded_at'), many=True)
        return Response(serializer.data)


class CACustomerUploadsView(views.APIView):
    permission_classes = [IsCA]

    def get(self, request, customer_id):
        fy = request.query_params.get('financial_year')
        month = request.query_params.get('month')

        customer = Customer.objects.filter(id=customer_id).first()
        if not customer:
            return Response({"error": "Customer not found in your firm."}, status=status.HTTP_404_NOT_FOUND)

        queryset = Upload.objects.filter(customer_id=customer_id)
        if fy:    queryset = queryset.filter(financial_year=fy)
        if month: queryset = queryset.filter(month=month)

        serializer = UploadListSerializer(queryset.order_by('-uploaded_at'), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class MapSheetView(views.APIView):
    permission_classes = [IsCA]

    def patch(self, request, upload_id):
        serializer = MapSheetSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        upload = Upload.objects.filter(id=upload_id).first()
        if not upload:
            return Response({"error": "Upload not found."}, status=status.HTTP_404_NOT_FOUND)

        upload.gstr_sheet = serializer.validated_data['gstr_sheet']
        upload.status = 'Received'
        upload.save()

        return Response({
            "upload_id": upload.id,
            "gstr_sheet": upload.gstr_sheet,
            "updated": True
        }, status=status.HTTP_200_OK)

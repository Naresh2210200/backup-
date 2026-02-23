from rest_framework import views, status, permissions
from rest_framework.response import Response
from .models import GSTR1Output, VerificationRun, VerificationError
from .serializers import GSTR1OutputSerializer, VerificationRunSerializer
from services import r2, fastapi_client
from apps.auth_app.middleware import get_current_user_payload


class IsCA(permissions.BasePermission):
    def has_permission(self, request, view):
        payload = get_current_user_payload(request)
        return payload and payload.get('role') == 'ca'


class TriggerGSTR1GenerationView(views.APIView):
    """
    POST /api/outputs/generate/
    Body: { customer_id, financial_year, month, upload_ids: [] }
    Offloads to FastAPI, saves GSTR1Output record, returns output_id + download info.
    """
    permission_classes = [IsCA]

    def post(self, request):
        payload = get_current_user_payload(request)
        data = request.data

        required = ['customer_id', 'financial_year', 'month', 'upload_ids']
        for field in required:
            if field not in data:
                return Response({"error": f"Missing field: {field}"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Fetch storage keys for the upload IDs from the uploads app
            from apps.uploads.models import Upload
            uploads = Upload.objects.filter(id__in=data['upload_ids'])
            upload_keys = [u.storage_key for u in uploads if u.storage_key]

            fastapi_payload = {
                "ca_code": payload['ca_code'],
                "customer_id": str(data['customer_id']),
                "financial_year": data['financial_year'],
                "month": data['month'],
                "upload_ids": data['upload_ids'],
                "upload_keys": upload_keys,
            }
            result = fastapi_client.trigger_gstr1_generation(fastapi_payload)

            output = GSTR1Output.objects.create(
                customer_id=data['customer_id'],
                customer_name=data.get('customer_name', 'Unknown'),
                financial_year=data['financial_year'],
                month=data['month'],
                storage_key=result['storage_key'],
                file_name=result['file_name'],
                generated_by=payload['username'],
                status='generated'
            )

            # Generate a presigned download URL immediately
            download_url = r2.get_download_presigned_url(result['storage_key'])

            return Response({
                "output_id": str(output.id),
                "file_name": output.file_name,
                "storage_key": result['storage_key'],
                "sheets_processed": result.get('sheets_processed', 0),
                "download_url": download_url,
                "status": output.status
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DownloadGSTR1View(views.APIView):
    """GET /api/outputs/<output_id>/download/"""
    permission_classes = [IsCA]

    def get(self, request, output_id):
        output = GSTR1Output.objects.filter(id=output_id).first()
        if not output:
            return Response({"error": "Output not found"}, status=status.HTTP_404_NOT_FOUND)

        url = r2.get_download_presigned_url(output.storage_key)
        return Response({"download_url": url, "file_name": output.file_name, "expires_in": 300})


class TriggerVerificationView(views.APIView):
    """
    POST /api/outputs/verify/
    Body: { customer_id, financial_year, month }
    Finds the latest GSTR1Output for that month, triggers FastAPI verification.
    """
    permission_classes = [IsCA]

    def post(self, request):
        payload = get_current_user_payload(request)
        data = request.data

        customer_id  = data.get('customer_id')
        financial_year = data.get('financial_year')
        month        = data.get('month')

        if not all([customer_id, financial_year, month]):
            return Response({"error": "customer_id, financial_year, and month are required."}, status=status.HTTP_400_BAD_REQUEST)

        # Find the most recent generated output for this customer/month
        output = GSTR1Output.objects.filter(
            customer_id=customer_id,
            financial_year=financial_year,
            month=month
        ).order_by('-generated_at').first()

        if not output:
            return Response(
                {"error": f"No generated GSTR1 found for {month} {financial_year}. Generate it first."},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            result = fastapi_client.trigger_verification({
                "storage_key": output.storage_key,
                "ca_code": payload['ca_code'],
                "customer_id": str(customer_id),
                "financial_year": financial_year,
                "month": month,
            })

            run = VerificationRun.objects.create(
                customer_id=output.customer_id,
                customer_name=output.customer_name,
                gstr1_output_id=output.id,
                financial_year=output.financial_year,
                month=output.month,
                total_checked=result.get('total_checked', 0),
                total_moved=result.get('total_moved_to_b2cs', 0),
                total_pan_errors=0,
                corrected_key=result.get('corrected_key', ''),
                error_report_key=result.get('error_report_key', ''),
                status='completed'
            )

            response_data = {
                "run_id": str(run.id),
                "total_checked": run.total_checked,
                "total_invalid": result.get('total_invalid', 0),
                "total_moved_to_b2cs": run.total_moved,
                "status": run.status,
                "dashboard_data": result.get('dashboard_data', {})
            }

            if run.corrected_key:
                response_data['corrected_download_url'] = r2.get_download_presigned_url(run.corrected_key)
            if run.error_report_key:
                response_data['error_report_download_url'] = r2.get_download_presigned_url(run.error_report_key)

            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VerificationResultView(views.APIView):
    """GET /api/outputs/verify/<run_id>/"""
    permission_classes = [IsCA]

    def get(self, request, run_id):
        run = VerificationRun.objects.filter(id=run_id).first()
        if not run:
            return Response({"error": "Run not found"}, status=status.HTTP_404_NOT_FOUND)

        data = VerificationRunSerializer(run).data

        if run.corrected_key:
            data['corrected_download_url'] = r2.get_download_presigned_url(run.corrected_key)
        if run.error_report_key:
            data['error_report_download_url'] = r2.get_download_presigned_url(run.error_report_key)

        return Response(data)
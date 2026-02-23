import uuid
from django.db import models

class GSTR1Output(models.Model):
    """
    Model representing a generated GSTR1 Excel file in the tenant-specific database.
    """
    STATUS_CHOICES = [
        ('generated', 'Generated'),
        ('verified', 'Verified'),
        ('corrected', 'Corrected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer_id = models.UUIDField()
    customer_name = models.CharField(max_length=255)
    financial_year = models.CharField(max_length=10)
    month = models.CharField(max_length=20)
    storage_key = models.TextField(help_text="R2 path to generated GSTR1 Excel")
    file_name = models.CharField(max_length=255)
    generated_at = models.DateTimeField(auto_now_add=True)
    generated_by = models.CharField(max_length=100, help_text="CA username who triggered generation")
    status = models.CharField(max_length=20, default='generated', choices=STATUS_CHOICES)

    class Meta:
        db_table = 'gstr1_outputs'
        app_label = 'outputs'

class VerificationRun(models.Model):
    """
    Model representing a single execution of the GSTR verification engine.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer_id = models.UUIDField()
    customer_name = models.CharField(max_length=255)
    gstr1_output_id = models.UUIDField(help_text="Reference to GSTR1Output.id")
    financial_year = models.CharField(max_length=10)
    month = models.CharField(max_length=20)
    total_checked = models.IntegerField(default=0)
    total_moved = models.IntegerField(default=0)
    total_pan_errors = models.IntegerField(default=0)
    corrected_key = models.TextField(blank=True, help_text="R2 path to corrected GSTR1 file")
    error_report_key = models.TextField(blank=True, help_text="R2 path to error report Excel")
    json_key = models.TextField(blank=True, help_text="R2 path to GSTR1 JSON file")
    status = models.CharField(max_length=20, default='pending', choices=STATUS_CHOICES)
    run_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'verification_runs'
        app_label = 'outputs'

class VerificationError(models.Model):
    """
    Model representing a specific error detected during a verification run.
    """
    ERROR_TYPE_CHOICES = [
        ('invalid_gstin', 'Invalid GSTIN'),
        ('cancelled', 'Cancelled GSTIN'),
        ('inactive', 'Inactive GSTIN'),
        ('pan_invalid', 'PAN Invalid'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run_id = models.UUIDField(help_text="Reference to VerificationRun.id")
    gstin = models.CharField(max_length=20)
    trade_name = models.CharField(max_length=255, blank=True)
    invoice_no = models.CharField(max_length=100)
    invoice_date = models.CharField(max_length=20)
    taxable_value = models.DecimalField(max_digits=15, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2)
    error_type = models.CharField(max_length=50, choices=ERROR_TYPE_CHOICES)
    cancel_date = models.CharField(max_length=20, blank=True)
    pan_number = models.CharField(max_length=10, blank=True)
    pan_valid = models.BooleanField(default=False)
    action_taken = models.CharField(max_length=50, default='moved_to_b2cs')
    hsn_adjusted = models.BooleanField(default=False)

    class Meta:
        db_table = 'verification_errors'
        app_label = 'outputs'

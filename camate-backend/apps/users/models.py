import uuid
from django.db import models

class Customer(models.Model):
    """
    Model representing a Customer (client of a CA) in the tenant-specific database.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=100)  # unique per CA firm, enforced in serializer
    email = models.EmailField(blank=True)
    password_hash = models.CharField(max_length=255)
    full_name = models.CharField(max_length=255)
    firm_name = models.CharField(max_length=255, blank=True)
    gstin = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=15, blank=True)
    ca_code = models.CharField(max_length=20, help_text="Reference to the CA firm code.")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customers'
        app_label = 'users'

    def __str__(self):
        return self.firm_name or self.full_name

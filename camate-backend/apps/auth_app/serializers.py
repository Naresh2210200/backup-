import bcrypt
import re
from rest_framework import serializers
from .models import CAFirm
from apps.users.models import Customer
from services.db_router import get_ca_db_alias, _is_sqlite
from django.db import DEFAULT_DB_ALIAS

class CARegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    ca_code = serializers.CharField(
        required=True,
        min_length=4,
        max_length=10,
        help_text="Your unique CA code (4-10 alphanumeric characters). Share with clients."
    )

    class Meta:
        model = CAFirm
        fields = ['ca_code', 'username', 'email', 'password', 'full_name', 'firm_name', 'gstin', 'address', 'phone']

    def validate_ca_code(self, value):
        value = value.upper().strip()
        if not re.match(r'^[A-Z0-9]+$', value):
            raise serializers.ValidationError("CA Code must be alphanumeric only (letters and numbers, no spaces or symbols).")
        if CAFirm.objects.filter(ca_code=value).exists():
            raise serializers.ValidationError("This CA Code is already taken. Please choose another.")
        return value

    def validate_username(self, value):
        if CAFirm.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already taken.")
        return value

    def validate_email(self, value):
        if CAFirm.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already registered.")
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        ca_firm = CAFirm.objects.create(
            password_hash=hashed_pw,
            **validated_data
        )
        return ca_firm

class CustomerRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    ca_code = serializers.CharField(required=True)

    class Meta:
        model = Customer
        fields = ['username', 'email', 'password', 'full_name', 'firm_name', 'gstin', 'address', 'phone', 'ca_code']

    def validate_ca_code(self, value):
        value = value.upper().strip()
        if not CAFirm.objects.filter(ca_code__iexact=value).exists():
            raise serializers.ValidationError(
                f"CA Code '{value}' not found. Please check the code given by your CA."
            )
        return value

    def validate_gstin(self, value):
        if value and not re.match(
            r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$',
            value.upper()
        ):
            raise serializers.ValidationError(
                "Invalid GSTIN format. Expected: 22AAAAA0000A1Z5"
            )
        return value.upper() if value else value

    def create(self, validated_data):
        password = validated_data.pop('password')
        ca_code = validated_data['ca_code']

        # In SQLite dev mode, use default DB; in PostgreSQL, use tenant DB
        db_alias = DEFAULT_DB_ALIAS if _is_sqlite() else get_ca_db_alias(ca_code)

        if Customer.objects.using(db_alias).filter(username=validated_data['username']).exists():
            raise serializers.ValidationError({"username": "Username already exists for this CA firm."})

        hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        customer = Customer(
            password_hash=hashed_pw,
            **validated_data
        )
        customer.save(using=db_alias)
        return customer

class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    password = serializers.CharField()
    role = serializers.ChoiceField(choices=['ca', 'customer'])
    ca_code = serializers.CharField(required=False)

    def validate(self, data):
        if data['role'] == 'customer' and not data.get('ca_code'):
            raise serializers.ValidationError({"ca_code": "CA Code is required for customers."})
        return data
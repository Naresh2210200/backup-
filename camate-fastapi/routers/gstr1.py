"""
GSTR1 Generation Router
========================
POST /gstr1/generate
  - Accepts a list of R2 storage keys for CSV files
  - Downloads each CSV from R2
  - Runs the GSTR1 Excel generation logic
  - Uploads the resulting Excel to R2 outputs/
  - Returns the storage_key and file_name
"""
import io
import time
import logging
from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import storage
from gstr1_engine import generate_gstr1_excel

logger = logging.getLogger(__name__)
router = APIRouter()


class GenerateRequest(BaseModel):
    ca_code: str
    customer_id: str
    financial_year: str
    month: str
    upload_ids: List[str]
    upload_keys: List[str]   # R2 storage keys for the CSV files


class GenerateResponse(BaseModel):
    storage_key: str
    file_name: str
    sheets_processed: int
    status: str = "success"


@router.post("/generate", response_model=GenerateResponse)
async def generate_gstr1(payload: GenerateRequest):
    """
    Download CSV files from R2, generate GSTR1 Excel, upload result back to R2.
    """
    logger.info(f"GSTR1 generation started: CA={payload.ca_code}, Customer={payload.customer_id}, Month={payload.month}")

    if not payload.upload_keys:
        raise HTTPException(status_code=400, detail="No upload_keys provided.")

    # 1. Download all CSV files from R2
    csv_files = []
    for key in payload.upload_keys:
        try:
            content = storage.read_file(key)
            file_name = key.split('/')[-1]
            # Strip timestamp prefix (e.g. "1234567890_b2b.csv" → "b2b.csv")
            if '_' in file_name and file_name.split('_')[0].isdigit():
                file_name = '_'.join(file_name.split('_')[1:])
            csv_files.append({"name": file_name, "content": content})
        except ValueError as e:
            logger.warning(f"Skipping file {key}: {e}")

    if not csv_files:
        raise HTTPException(status_code=422, detail="No readable CSV files found in the provided keys.")

    # 2. Generate GSTR1 Excel
    try:
        excel_bytes, sheets_processed = generate_gstr1_excel(csv_files)
    except Exception as e:
        logger.error(f"Excel generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Excel generation failed: {str(e)}")

    # 3. Upload to R2 (or local storage)
    from datetime import datetime
    timestamp_str = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    file_name = f"GSTR1_standard_{timestamp_str}.xlsx"
    output_key = f"outputs/{payload.ca_code}/{payload.customer_id}/{payload.financial_year}/{payload.month}/{file_name}"

    try:
        storage.save_file(
            output_key,
            excel_bytes,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    logger.info(f"GSTR1 generation complete: {output_key} ({sheets_processed} sheets)")
    return GenerateResponse(
        storage_key=output_key,
        file_name=file_name,
        sheets_processed=sheets_processed
    )

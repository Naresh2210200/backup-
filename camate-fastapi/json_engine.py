import json
from datetime import datetime

def generate_gstr1_json(wb, gstin, fp):
    """
    Extracts data from the GSTR1 Workbook and returns a dictionary 
    formatted according to the GST portal's JSON schema version 1.0.
    """
    gstr1_json = {
        "gstin": gstin,
        "fp": fp,
        "gt": 0,    # Default to 0, usually provided by user or historical
        "cur_gt": 0,
        "version": "V1.0"
    }

    def clean_val(v):
        if v is None: return 0.0
        if isinstance(v, (int, float)): return float(v)
        try:
            return float(str(v).replace(',','').strip())
        except:
            return 0.0

    # 1. B2B Section
    if 'b2b' in wb.sheetnames:
        ws = wb['b2b']
        head = [str(cell.value).strip().upper() if cell.value else '' for cell in ws[1]]
        gstin_idx = next((i for i, h in enumerate(head) if 'GSTIN' in h), None)
        inv_no_idx = next((i for i, h in enumerate(head) if 'INVOICE NUMBER' in h or 'INVOICE NO' in h), None)
        inv_dt_idx = next((i for i, h in enumerate(head) if 'INVOICE DATE' in h or 'DATE' in h), None)
        inv_val_idx = next((i for i, h in enumerate(head) if 'INVOICE VALUE' in h), None)
        pos_idx = next((i for i, h in enumerate(head) if 'PLACE OF SUPPLY' in h), None)
        rcm_idx = next((i for i, h in enumerate(head) if 'REVERSE CHARGE' in h or 'RCM' in h), None)
        inv_typ_idx = next((i for i, h in enumerate(head) if 'INVOICE TYPE' in h), None)
        rate_idx = next((i for i, h in enumerate(head) if 'RATE' in h or 'GST%' in h), None)
        tax_val_idx = next((i for i, h in enumerate(head) if 'TAXABLE VALUE' in h), None)
        # Tax columns
        i_idx = next((i for i, h in enumerate(head) if 'IGST' in h), None)
        c_idx = next((i for i, h in enumerate(head) if 'CGST' in h), None)
        s_idx = next((i for i, h in enumerate(head) if 'SGST' in h), None)
        cess_idx = next((i for i, h in enumerate(head) if 'CESS' in h), None)

        if gstin_idx is not None:
            b2b_data = {} # gstin -> [invs]
            for row in ws.iter_rows(min_row=2, values_only=True):
                g = str(row[gstin_idx]).strip().upper() if row[gstin_idx] else None
                if not g: continue
                
                if g not in b2b_data:
                    b2b_data[g] = {} # inv_no -> {details, items: []}
                
                inv_no = str(row[inv_no_idx]).strip() if inv_no_idx is not None else "UNK"
                if inv_no not in b2b_data[g]:
                    b2b_data[g][inv_no] = {
                        "inum": inv_no,
                        "idt": str(row[inv_dt_idx]) if inv_dt_idx is not None else "",
                        "val": clean_val(row[inv_val_idx]) if inv_val_idx is not None else 0.0,
                        "pos": str(row[pos_idx]).split('-')[0].strip() if pos_idx is not None else "",
                        "rchrg": "Y" if str(row[rcm_idx]).upper().startswith('Y') else "N",
                        "inv_typ": "R", # Default Regular
                        "itms": []
                    }
                
                # Add item
                item = {
                    "num": len(b2b_data[g][inv_no]["itms"]) + 1,
                    "itm_det": {
                        "rt": clean_val(row[rate_idx]) if rate_idx is not None else 0.0,
                        "txval": clean_val(row[tax_val_idx]) if tax_val_idx is not None else 0.0,
                        "iamt": clean_val(row[i_idx]) if i_idx is not None else 0.0,
                        "camt": clean_val(row[c_idx]) if c_idx is not None else 0.0,
                        "samt": clean_val(row[s_idx]) if s_idx is not None else 0.0,
                        "csamt": clean_val(row[cess_idx]) if cess_idx is not None else 0.0,
                    }
                }
                b2b_data[g][inv_no]["itms"].append(item)
            
            # Format for JSON
            gstr1_json["b2b"] = []
            for g, invs in b2b_data.items():
                gstr1_json["b2b"].append({
                    "ctin": g,
                    "inv": list(invs.values())
                })

    # 2. B2CS Section (Small Invoices)
    if 'b2cs' in wb.sheetnames:
        ws = wb['b2cs']
        head = [str(cell.value).strip().upper() if cell.value else '' for cell in ws[1]]
        pos_idx = next((i for i, h in enumerate(head) if 'PLACE OF SUPPLY' in h), None)
        rate_idx = next((i for i, h in enumerate(head) if 'RATE' in h or 'GST%' in h), None)
        tax_val_idx = next((i for i, h in enumerate(head) if 'TAXABLE VALUE' in h), None)
        cess_idx = next((i for i, h in enumerate(head) if 'CESS' in h), None)
        typ_idx = next((i for i, h in enumerate(head) if 'TYPE' in h), None)

        if pos_idx is not None:
            b2cs_grouped = {} # (pos, typ, rate) -> totals
            for row in ws.iter_rows(min_row=2, values_only=True):
                pos = str(row[pos_idx]).split('-')[0].strip() if row[pos_idx] else ""
                typ = str(row[typ_idx]).upper() if typ_idx is not None and row[typ_idx] else "OE"
                rt = clean_val(row[rate_idx]) if rate_idx is not None else 0.0
                key = (pos, typ, rt)
                
                if key not in b2cs_grouped:
                    b2cs_grouped[key] = {"txval": 0.0, "csamt": 0.0}
                
                b2cs_grouped[key]["txval"] += clean_val(row[tax_val_idx]) if tax_val_idx is not None else 0.0
                b2cs_grouped[key]["csamt"] += clean_val(row[cess_idx]) if cess_idx is not None else 0.0
            
            gstr1_json["b2cs"] = []
            for (pos, typ, rt), vals in b2cs_grouped.items():
                gstr1_json["b2cs"].append({
                    "sply_ty": "INTER" if (gstin and pos != gstin[:2]) else "INTRA",
                    "pos": pos,
                    "rt": rt,
                    "txval": round(vals["txval"], 2),
                    "csamt": round(vals["csamt"], 2),
                    "typ": typ
                })

    # 3. HSN Section
    if 'hsn' in wb.sheetnames:
        ws = wb['hsn']
        head = [str(cell.value).strip().upper() if cell.value else '' for cell in ws[1]]
        hsn_idx = next((i for i, h in enumerate(head) if 'HSN' in h), None)
        desc_idx = next((i for i, h in enumerate(head) if 'DESCRIPTION' in h), None)
        uqc_idx = next((i for i, h in enumerate(head) if 'UQC' in h), None)
        qty_idx = next((i for i, h in enumerate(head) if 'QUANTITY' in h), None)
        val_idx = next((i for i, h in enumerate(head) if 'TOTAL VALUE' in h), None)
        txval_idx = next((i for i, h in enumerate(head) if 'TAXABLE VALUE' in h), None)
        i_idx = next((i for i, h in enumerate(head) if 'IGST' in h), None)
        c_idx = next((i for i, h in enumerate(head) if 'CGST' in h), None)
        s_idx = next((i for i, h in enumerate(head) if 'SGST' in h), None)
        cess_idx = next((i for i, h in enumerate(head) if 'CESS' in h), None)

        if hsn_idx is not None:
            hsn_list = []
            for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), 1):
                hsn_code = str(row[hsn_idx]).strip() if row[hsn_idx] else None
                if not hsn_code: continue
                
                hsn_list.append({
                    "num": row_idx,
                    "hsn_sc": hsn_code,
                    "desc": str(row[desc_idx])[:30] if desc_idx is not None and row[desc_idx] else "Goods",
                    "uqc": str(row[uqc_idx]).split('-')[0].strip() if uqc_idx is not None and row[uqc_idx] else "OTH",
                    "qty": clean_val(row[qty_idx]) if qty_idx is not None else 0.0,
                    "val": clean_val(row[val_idx]) if val_idx is not None else 0.0,
                    "txval": clean_val(row[txval_idx]) if txval_idx is not None else 0.0,
                    "iamt": clean_val(row[i_idx]) if i_idx is not None else 0.0,
                    "camt": clean_val(row[c_idx]) if c_idx is not None else 0.0,
                    "samt": clean_val(row[s_idx]) if s_idx is not None else 0.0,
                    "csamt": clean_val(row[cess_idx]) if cess_idx is not None else 0.0
                })
            gstr1_json["hsn"] = {"data": hsn_list}

    return gstr1_json

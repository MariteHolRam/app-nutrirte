import os
import sys
import json

# Auto-install dependencies if not present
try:
    import pdfplumber
except ImportError:
    print("Installing pdfplumber...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pdfplumber"])
    import pdfplumber

pdf_path = r"../sistema-de-alimentos-equivalentes-para-pacientes-renales-smae-renal-original.pdf"
output_js_path = "foods_data.js"

if not os.path.exists(pdf_path):
    # Fallback to current folder just in case
    pdf_path = "sistema-de-alimentos-equivalentes-para-pacientes-renales-smae-renal-original.pdf"
    if not os.path.exists(pdf_path):
        print(f"Error: Manual PDF not found in parent folder or current folder. Check paths.")
        sys.exit(1)

print(f"Reading PDF: {pdf_path}")

# Mapping page numbers to group and subgroup names
page_mappings = {
    16: ("Verduras", "Bajas en potasio"),
    17: ("Verduras", "Moderadas en potasio"),
    18: ("Verduras", "Altas en potasio"),
    19: ("Frutas", "Bajas en potasio"),
    20: ("Frutas", "Bajas en potasio"),
    21: ("Frutas", "Moderadas en potasio"),
    22: ("Frutas", "Moderadas en potasio"),
    23: ("Frutas", "Altas en potasio"),
    24: ("Frutas", "No determinadas en potasio"),
    25: ("Leguminosas", "Bajas en fósforo y altas en potasio"),
    26: ("Leguminosas", "Altas en fósforo y altas en potasio"),
    27: ("Leguminosas", "Altas en sodio y altas en potasio"),
    28: ("Cereales y Tubérculos", "Sin grasa bajos en sodio"),
    29: ("Cereales y Tubérculos", "Sin grasa bajos en sodio"),
    30: ("Cereales y Tubérculos", "Sin grasa bajos en sodio"),
    31: ("Cereales y Tubérculos", "Sin grasa bajos en sodio"),
    32: ("Cereales y Tubérculos", "Sin grasa bajos en sodio"),
    33: ("Cereales y Tubérculos", "Sin grasa bajos en sodio"),
    34: ("Cereales y Tubérculos", "Sin grasa bajos en sodio"),
    35: ("Cereales y Tubérculos", "Sin grasa bajos en sodio"),
    36: ("Cereales y Tubérculos", "Sin grasa altos en sodio"),
    37: ("Cereales y Tubérculos", "Con grasa bajos en sodio"),
    38: ("Cereales y Tubérculos", "Con grasa bajos en sodio"),
    39: ("Cereales y Tubérculos", "Con grasa bajos en sodio"),
    40: ("Cereales y Tubérculos", "Con grasa bajos en sodio"),
    41: ("Cereales y Tubérculos", "Con grasa altos en sodio"),
    42: ("Cereales y Tubérculos", "Con grasa altos en sodio"),
    43: ("Alimentos de Origen Animal", "Muy bajo aporte en grasa y bajos en sodio"),
    44: ("Alimentos de Origen Animal", "Muy bajo aporte en grasa y bajos en sodio"),
    45: ("Alimentos de Origen Animal", "Muy bajo aporte en grasa y bajos en sodio"),
    46: ("Alimentos de Origen Animal", "Muy bajo aporte en grasa y altos en sodio"),
    47: ("Alimentos de Origen Animal", "Muy bajo aporte en grasa y altos en sodio"),
    48: ("Alimentos de Origen Animal", "Bajo aporte en grasa y bajos en sodio"),
    49: ("Alimentos de Origen Animal", "Bajo aporte en grasa y bajos en sodio"),
    50: ("Alimentos de Origen Animal", "Bajo aporte en grasa y bajos en sodio"),
    51: ("Alimentos de Origen Animal", "Bajo aporte en grasa y altos en sodio"),
    52: ("Alimentos de Origen Animal", "Moderado aporte en grasa y bajos en sodio"),
    53: ("Alimentos de Origen Animal", "Moderado aporte en grasa y altos en sodio"),
    54: ("Alimentos de Origen Animal", "Alto aporte en grasa y bajos en sodio"),
    55: ("Alimentos de Origen Animal", "Alto aporte en grasa y bajos en sodio"),
    56: ("Alimentos de Origen Animal", "Alto aporte en grasa y altos en sodio"),
    57: ("Alimentos de Origen Animal", "Alto aporte en grasa y altos en sodio"),
    58: ("Leche", "Entera baja en fósforo / Entera alta en fósforo"),
    59: ("Leche", "Semidescremada / Descremada alta en fósforo"),
    60: ("Leche", "Con azúcar baja en fósforo / no determinado"),
    61: ("Leche", "Con azúcar alta en fósforo"),
    62: ("Aceites y Grasas", "Bajas en sodio"),
    63: ("Aceites y Grasas", "Bajas en sodio"),
    64: ("Aceites y Grasas", "Altas en sodio"),
    65: ("Aceites y Grasas", "Con proteína bajas en sodio"),
    66: ("Aceites y Grasas", "Con proteína bajas en sodio"),
    67: ("Aceites y Grasas", "Con proteína altas en sodio"),
    68: ("Azúcares", "Sin grasa bajos en sodio"),
    69: ("Azúcares", "Sin grasa bajos en sodio"),
    70: ("Azúcares", "Sin grasa altos en sodio / Con grasa altos"),
    71: ("Azúcares", "Con grasa bajos en sodio"),
    72: ("Bebidas Alcohólicas", "Etanol"),
    73: ("Bebidas Alcohólicas", "Etanol"),
    74: ("Condimentos", "Bajos en sodio"),
    75: ("Condimentos", "Bajos en sodio"),
    76: ("Condimentos", "Bajos en sodio"),
    77: ("Condimentos", "Altos en sodio"),
    78: ("Líquidos", "Bajos en sodio, fósforo y potasio"),
    79: ("Líquidos", "Altos en sodio, fósforo y potasio")
}

extracted_data = []

with pdfplumber.open(pdf_path) as pdf:
    for page_num, (group, subgroup) in page_mappings.items():
        print(f"Parsing page {page_num} ({group} - {subgroup})...")
        page = pdf.pages[page_num - 1]
        
        tables = page.extract_tables()
        if not tables:
            continue
            
        for table in tables:
            for row in table:
                cleaned_row = [cell.replace('\n', ' ').strip() if cell else "" for cell in row]
                
                if not cleaned_row or not cleaned_row[0] or cleaned_row[0] in ["ALIMENTO", "Alimento", "Grupo", "Subgrupos"]:
                    continue
                
                if len(cleaned_row) < 3:
                    continue
                
                alimento = cleaned_row[0]
                cantidad = cleaned_row[1]
                unidad = cleaned_row[2]
                
                # Check if group has kJ column (shifts protein, lipids, and carbs columns by 1)
                has_kj = group in ["Frutas", "Leguminosas", "Condimentos", "Bebidas Alcohólicas"]
                
                if has_kj:
                    kcal = cleaned_row[5] if len(cleaned_row) > 5 else "0"
                    prot = cleaned_row[7] if len(cleaned_row) > 7 else "0"
                    lip = cleaned_row[8] if len(cleaned_row) > 8 else "0"
                    hc = cleaned_row[9] if len(cleaned_row) > 9 else "0"
                else:
                    kcal = cleaned_row[5] if len(cleaned_row) > 5 else "0"
                    prot = cleaned_row[6] if len(cleaned_row) > 6 else "0"
                    lip = cleaned_row[7] if len(cleaned_row) > 7 else "0"
                    hc = cleaned_row[8] if len(cleaned_row) > 8 else "0"
                
                potasio = "ND"
                sodio = "ND"
                fosforo = "ND"
                fibra = "ND"
                vitaminaA = "ND"
                vitaminaC = "ND"
                acidoFolico = "ND"
                hierro = "ND"
                agua = "ND"
                
                if group == "Verduras" and len(cleaned_row) >= 15:
                    potasio = cleaned_row[14]
                    fibra = cleaned_row[9] if len(cleaned_row) > 9 else "ND"
                    vitaminaA = cleaned_row[10] if len(cleaned_row) > 10 else "ND"
                    vitaminaC = cleaned_row[11] if len(cleaned_row) > 11 else "ND"
                    acidoFolico = cleaned_row[12] if len(cleaned_row) > 12 else "ND"
                    hierro = cleaned_row[13] if len(cleaned_row) > 13 else "ND"
                    agua = cleaned_row[15] if len(cleaned_row) > 15 else "ND"
                elif group == "Frutas" and len(cleaned_row) >= 16:
                    potasio = cleaned_row[15]
                    fibra = cleaned_row[10] if len(cleaned_row) > 10 else "ND"
                    vitaminaA = cleaned_row[11] if len(cleaned_row) > 11 else "ND"
                    vitaminaC = cleaned_row[12] if len(cleaned_row) > 12 else "ND"
                    acidoFolico = cleaned_row[13] if len(cleaned_row) > 13 else "ND"
                    hierro = cleaned_row[14] if len(cleaned_row) > 14 else "ND"
                    agua = cleaned_row[16] if len(cleaned_row) > 16 else "ND"
                elif group == "Leguminosas" and len(cleaned_row) >= 16:
                    sodio = cleaned_row[13]
                    fosforo = cleaned_row[14]
                    potasio = cleaned_row[15]
                    fibra = cleaned_row[10] if len(cleaned_row) > 10 else "ND"
                    hierro = cleaned_row[11] if len(cleaned_row) > 11 else "ND"
                elif group == "Cereales y Tubérculos" and len(cleaned_row) >= 15:
                    sodio = cleaned_row[13]
                    fosforo = cleaned_row[14]
                    fibra = cleaned_row[9] if len(cleaned_row) > 9 else "ND"
                    acidoFolico = cleaned_row[10] if len(cleaned_row) > 10 else "ND"
                    hierro = cleaned_row[12] if len(cleaned_row) > 12 else "ND"
                elif group == "Alimentos de Origen Animal" and len(cleaned_row) >= 15:
                    sodio = cleaned_row[13]
                    fosforo = cleaned_row[14]
                    vitaminaA = cleaned_row[9] if len(cleaned_row) > 9 else "ND"
                    hierro = cleaned_row[11] if len(cleaned_row) > 11 else "ND"
                elif group == "Leche" and len(cleaned_row) >= 14:
                    sodio = cleaned_row[12]
                    fosforo = cleaned_row[13]
                    vitaminaA = cleaned_row[9] if len(cleaned_row) > 9 else "ND"
                    agua = cleaned_row[13] if len(cleaned_row) > 13 else "ND"
                elif group == "Aceites y Grasas" and len(cleaned_row) >= 14:
                    sodio = cleaned_row[13]
                elif group == "Azúcares" and len(cleaned_row) >= 10:
                    sodio = cleaned_row[9]
                elif group == "Condimentos" and len(cleaned_row) >= 10:
                    sodio = cleaned_row[-1]
                elif group == "Líquidos" and len(cleaned_row) >= 12:
                    sodio = cleaned_row[9]
                    fosforo = cleaned_row[10]
                    potasio = cleaned_row[11]
                    agua = cleaned_row[11] if len(cleaned_row) > 11 else "ND"

                extracted_data.append({
                    "grupo": group,
                    "subgrupo": subgroup,
                    "alimento": alimento,
                    "porcion": f"{cantidad} {unidad}".strip(),
                    "kcal": kcal,
                    "prot": prot,
                    "lip": lip,
                    "hc": hc,
                    "potasio": potasio,
                    "sodio": sodio,
                    "fosforo": fosforo,
                    "fibra": fibra,
                    "vitaminaA": vitaminaA,
                    "vitaminaC": vitaminaC,
                    "acidoFolico": acidoFolico,
                    "hierro": hierro,
                    "agua": agua
                })

# Count items per group for information
group_counts = {}
for item in extracted_data:
    group = item["grupo"]
    group_counts[group] = group_counts.get(group, 0) + 1

print(f"Extracted a total of {len(extracted_data)} food items.")
print(f"Items per group:")
for grp, cnt in group_counts.items():
    print(f"  - {grp}: {cnt} items")

js_content = f"// SMAE Renal Food Database (All items)\nconst foodsData = {json.dumps(extracted_data, indent=2, ensure_ascii=False)};\n"

with open(output_js_path, "w", encoding="utf-8") as f:
    f.write(js_content)

print(f"Success! Saved complete food database to: '{output_js_path}'")


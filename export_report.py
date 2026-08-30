import pypandoc
import os

input_md = 'Poseidon_Report.md'
output_docx = 'Poseidon_Report.docx'

print("[SYSTEM] Starting conversion to DOCX...")

try:
    pypandoc.convert_file(input_md, 'docx', outputfile=output_docx)
    print(f"[SUCCESS] Document saved to: {os.path.abspath(output_docx)}")
    print("[SYSTEM] You can now open this DOCX file and use 'Save As' to export it as a PDF.")
except Exception as e:
    print(f"[ERROR] Conversion failed: {e}")

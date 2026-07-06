#!/usr/bin/env bash
# สร้างคู่มือ PDF จาก manual-src.html → public/manual.pdf
# ต้องมี weasyprint + ฟอนต์ Sarabun ติดตั้งในระบบ
set -e
cd "$(dirname "$0")/.."
weasyprint manual-src.html public/manual.pdf
echo "สร้าง public/manual.pdf เรียบร้อย"

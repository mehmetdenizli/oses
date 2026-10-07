@echo off
chcp 65001 > nul
title "O Ses Cigkofte POS System"

cd /d "%~dp0"

echo ============================================================
echo 🌯 O Ses Çiğköfte POS - Windows Kasa Başlatıcı
echo ============================================================

IF NOT EXIST "venv" (
    echo Sanal ortam venv bulunamadi, olusturuluyor...
    python -m venv venv
)

echo Kütüphane bağımlılıkları kontrol ediliyor...
".\venv\Scripts\python.exe" -m pip install -r requirements.txt --quiet

echo.
echo ============================================================
echo 🚀 POS Sunucusu Başlatılıyor!
echo 📍 Kasa Ekranı: http://localhost:8000
echo ============================================================
echo.

".\venv\Scripts\python.exe" main.py

pause

@echo off
title "O Ses POS - Windows Kasa Server"

cd /d "%~dp0"

echo ============================================================
echo O Ses Cigkofte POS - Windows Kasa Baslatici
echo ============================================================

IF NOT EXIST "venv" (
    echo Sanal ortam venv bulunamadi, olusturuluyor...
    python -m venv venv
)

echo Kutuphane bagimliliklari kontrol ediliyor...
".\venv\Scripts\python.exe" -m pip install -r requirements.txt --quiet

echo.
echo ============================================================
echo POS Sunucusu Baslatiliyor!
echo Kasa Ekrani: http://localhost:8000
echo ============================================================
echo.

".\venv\Scripts\python.exe" main.py

pause

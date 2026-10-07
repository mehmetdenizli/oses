@echo off
title "O Ses POS - Windows Kasa Server"

cd /d "%~dp0"

echo ============================================================
echo O Ses Cigkofte POS - Windows Kasa Baslatici
echo ============================================================

IF NOT EXIST "%~dp0venv" (
    echo Sanal ortam venv bulunamadi, olusturuluyor...
    python -m venv "%~dp0venv"
)

echo Kutuphane bagimliliklari kontrol ediliyor...
"%~dp0venv\Scripts\python.exe" -m pip install -r "%~dp0requirements.txt" --quiet

echo.
echo ============================================================
echo POS Sunucusu Baslatiliyor!
echo Kasa Ekrani: http://localhost:8000
echo ============================================================
echo.

"%~dp0venv\Scripts\python.exe" "%~dp0main.py"

pause

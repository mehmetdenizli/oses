@echo off
chcp 65001 > nul
title O Ses Çiğköfte POS & Adisyon Sistemi

echo ============================================================
echo 🌶️  O Ses Çiğköfte POS - Windows Kasa Tek Tıkla Başlatıcı
echo ============================================================

cd /d "%~dp0"

IF NOT EXIST "venv" (
    echo 📦 Sanal ortam (venv) oluşturuluyor...
    python -m venv venv
)

echo ⚙️ Sanal ortam aktif ediliyor...
call venv\Scripts\activate.bat

echo 📥 Bağımlılıklar yükleniyor...
pip install -r requirements.txt

echo.
echo ============================================================
echo 🚀 POS Sunucusu Yerel Ağda Çalıştırılıyor!
echo 📍 Kasa Ekranı: http://localhost:8000
echo 📱 Personel Telefonları: http://<Kasa_IP>:8000
echo ============================================================
echo.

python main.py

pause

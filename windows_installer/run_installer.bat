@echo off
chcp 65001 > nul
title O Ses POS - Windows Otomatik Sistem Kurucu

echo ============================================================
echo 🚀 O Ses POS - Windows Sistem Gereksinimleri Kurulumu
echo ============================================================
echo.
echo PowerShell Kurulum Sihirbazı Başlatılıyor...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup_windows.ps1"

pause

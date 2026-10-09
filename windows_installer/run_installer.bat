@echo off
title "O Ses POS - Windows Installer"
cd /d "%~dp0"

echo ============================================================
echo O Ses POS - Windows Otomatik Sistem Kurucu
echo ============================================================
echo.
echo PowerShell Kurulum Sihirbazı Baslatiliyor...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup_windows.ps1"

echo.
echo Kurulum tamamlandi. Pencereyi kapatmak icin bir tusa basin.
pause

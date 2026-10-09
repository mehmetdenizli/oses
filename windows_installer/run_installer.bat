@echo off
title "O Ses POS - Windows Otomatik Kurulum Sihirbazı"
cd /d "%~dp0"

:: Check for Administrative Privileges and Auto-Elevate if needed
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ============================================================
    echo Yonetici Izinleri Aliniyor (UAC Onayi Bekleniyor)...
    echo ============================================================
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo ============================================================
echo O Ses POS - Windows Otomatik Sistem Kurucu
echo ============================================================
echo.
echo PowerShell Otomatik Kurulum Sihirbazı Baslatiliyor...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup_windows.ps1"

echo.
echo Kurulum tamamlandi. Pencereyi kapatmak icin bir tusa basin.
pause

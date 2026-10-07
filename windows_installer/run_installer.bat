@echo off
title "O Ses POS - Windows Installer"

echo ============================================================
echo O Ses POS - Windows Otomatik Sistem Kurucu
echo ============================================================
echo.
echo PowerShell Kurulum Sihirbazı Baslatiliyor...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup_windows.ps1"

pause

@echo off
title "O Ses POS - Windows Uninstaller"
cd /d "%~dp0"

echo ============================================================
echo   O Ses POS - Windows Otomatik Kaldirma Sihirbazi
echo ============================================================
echo.
echo PowerShell Kaldirma Sihirbazi Baslatiliyor...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall_windows.ps1"

echo.
echo Islem tamamlandi. Pencereyi kapatmak icin bir tusa basin.
pause

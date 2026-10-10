@echo off
title "O Ses POS - Windows Kaldirma (Uninstall)"
cd /d "%~dp0"

if exist "%~dp0windows_installer\uninstall_windows.bat" (
    call "%~dp0windows_installer\uninstall_windows.bat"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows_installer\uninstall_windows.ps1"
)

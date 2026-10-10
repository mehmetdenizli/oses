@echo off
title "O Ses POS - Yazici Secimi ve Ayar Modu"
cd /d "%~dp0"

echo ============================================================
echo   O Ses POS - Yazici Secimi ve Ayar Modu (1 Seferlik)
echo ============================================================
echo.
echo Bu arac Chrome'u sessiz mod (kiosk-printing) OLMADAN acar.
echo Amaci: Ekrani acik tutarak SPENTA yazicinizi 1 kez secmektir.
echo.
echo 1. Acilan ekranda bir siparis alip "Odemeyi Al / Adisyonu Kapat" deyin.
echo 2. Kapanmayan pencerede Hedef kutusundan "SPENTA" yazicinizi secin.
echo 3. "Yazdir" butonuna basin ve ilk fisi basin.
echo 4. Sonrasinda pencereyi kapatin.
echo.

set "POS_PROFILE=%LOCALAPPDATA%\OSesPOS_ChromeProfile"
set "CHROME_PATH="

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
)

if "%CHROME_PATH%"=="" (
    echo Chrome bulunamadi!
    pause
    exit /b 1
)

start "" "%CHROME_PATH%" --app=http://localhost:8000 --user-data-dir="%POS_PROFILE%"
exit

@echo off
setlocal

echo ============================
echo   Git Remote Fixer
echo ============================

set /p URL=Enter GitHub repo URL: 

if "%URL%"=="" (
    echo URL required.
    pause
    exit /b
)

echo Removing old origin (if exists)...
git remote remove origin 2>nul

echo Adding new origin...
git remote add origin %URL%

git remote -v

echo.
echo Remote fixed.
pause
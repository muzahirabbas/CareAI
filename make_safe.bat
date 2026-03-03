@echo off
setlocal

echo ============================
echo   Git Safe Directory Tool
echo ============================

REM Get current directory
set DIR=%cd%

echo Current folder:
echo %DIR%
echo.

echo Making this folder safe for Git...

git config --global --add safe.directory "%DIR%"

if %ERRORLEVEL% NEQ 0 (
    echo Failed to mark as safe.
) else (
    echo Folder is now trusted by Git.
)

pause
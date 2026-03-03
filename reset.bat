@echo off
setlocal

echo ============================
echo   Git Reset Tool
echo ============================
echo 1 = Undo last commit (keep files)
echo 2 = Discard ALL local changes (DANGEROUS)
echo.

set /p CHOICE=Choose option (1/2): 

if "%CHOICE%"=="1" (
    git reset --soft HEAD~1
    echo Last commit undone (files kept).
)

if "%CHOICE%"=="2" (
    git reset --hard
    git clean -fd
    echo All local changes wiped.
)

pause
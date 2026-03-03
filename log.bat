@echo off
setlocal

echo ============================
echo   Git Log (Last 20)
echo ============================

git log --oneline --graph --decorate -20

pause
@echo off
REM Wrapper invocado por Task Scheduler para correr el snapshot horario.
REM 1. Ejecuta el script de snapshot (escribe a APP pocket\backups\)
REM 2. Si OK, mirror incremental a OneDrive\BOLIVIA-Backups
cd /d "C:\Users\Usuario\Desktop\Proyectos\BOLIVIA\APP pocket"
if not exist "backups" mkdir "backups"
echo. >> "backups\_scheduled.log"
echo === %date% %time% === >> "backups\_scheduled.log"
call npx tsx scripts/backup-snapshot.ts >> "backups\_scheduled.log" 2>&1
set SNAPSHOT_RC=%ERRORLEVEL%
if "%SNAPSHOT_RC%"=="0" (
  echo --- Sync OneDrive --- >> "backups\_scheduled.log"
  robocopy "backups" "C:\Users\Usuario\OneDrive\BOLIVIA-Backups" /E /XO /R:1 /W:1 /NP /NDL /NJH /NJS >> "backups\_scheduled.log" 2>&1
)
exit /b %SNAPSHOT_RC%

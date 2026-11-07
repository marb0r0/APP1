@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado.
  echo Instale Node.js 22 ou superior em https://nodejs.org/ e tente novamente.
  pause
  exit /b 1
)

if not exist package.json (
  echo package.json nao encontrado.
  echo Execute este ficheiro na pasta raiz do Pitchline.
  pause
  exit /b 1
)

if not exist node_modules (
  echo A instalar dependencias do Pitchline...
  call npm install
  if errorlevel 1 (
    echo Falha ao instalar dependencias. Verifique a ligacao a internet e tente novamente.
    pause
    exit /b 1
  )
)

set "PORT=3000"
call :CheckPort %PORT%
if not errorlevel 1 goto StartServer

echo A porta 3000 ja esta ocupada. Vou tentar a porta 3001 para nao abrir outra aplicacao.
set "PORT=3001"
call :CheckPort %PORT%
if not errorlevel 1 goto StartServer

echo A porta 3001 tambem esta ocupada. Vou tentar a porta 3002.
set "PORT=3002"
call :CheckPort %PORT%
if not errorlevel 1 goto StartServer

echo As portas 3000, 3001 e 3002 estao ocupadas. Feche outras instancias do Pitchline e tente novamente.
pause
exit /b 1

:StartServer
echo A iniciar a app Pitchline de futebol na porta %PORT%...
start "Pitchline - servidor local" cmd /k "cd /d "%~dp0" ^&^& npm run dev -- --port %PORT%"
set /a WAIT_COUNT=0

:WaitForServer
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%PORT%/' -TimeoutSec 2; if ($response.Content -match 'Pitchline') { exit 0 }; exit 1 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 goto OpenApp
set /a WAIT_COUNT+=1
if %WAIT_COUNT% GEQ 45 goto ServerTimeout
timeout /t 2 /nobreak >nul
goto WaitForServer

:OpenApp
echo Pitchline pronto. A abrir http://localhost:%PORT%/
start "" "http://localhost:%PORT%/"
exit /b 0

:ServerTimeout
echo O servidor Pitchline nao ficou pronto a tempo.
echo Consulte a janela "Pitchline - servidor local" para ver o erro. A app de resultados precisa de ligacao a internet.
pause
exit /b 1

:CheckPort
powershell -NoProfile -ExecutionPolicy Bypass -Command "$client = New-Object System.Net.Sockets.TcpClient; try { $client.Connect('127.0.0.1', %1); exit 1 } catch { exit 0 } finally { $client.Dispose() }" >nul 2>nul
exit /b %errorlevel%

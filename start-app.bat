@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado.
  echo Instale o Node.js 22+ em https://nodejs.org/ e tente novamente.
  pause
  exit /b 1
)

if not exist package.json (
  echo package.json nao encontrado.
  echo Execute este ficheiro na pasta raiz do projeto.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo Falha na instalacao das dependencias.
    pause
    exit /b 1
  )
)

echo Iniciando Pitchline...
start "" http://localhost:3000
call npm run dev

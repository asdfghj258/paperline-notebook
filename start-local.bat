@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.jsが見つかりません。https://nodejs.org/ からNode.js LTSをインストールしてください。
  pause
  exit /b 1
)
if not exist node_modules (
  echo 初回セットアップ中です。しばらくお待ちください...
  call npm install
  if errorlevel 1 (
    echo npm installに失敗しました。
    pause
    exit /b 1
  )
)
echo ブラウザで http://localhost:5173/ を開いてください。
call npm run dev -- --host 0.0.0.0
pause

@echo off
setlocal
cd /d "%~dp0"
title DocuSleuth AI - Local Workspace
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install it from https://nodejs.org/ and run again.
  pause
  exit /b 1
)
node.exe server.mjs --open
if errorlevel 1 pause


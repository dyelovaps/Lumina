@echo off
cd /d "%~dp0"
title Lanceur Lumina
python lumina_lanceur.py
if errorlevel 1 (
  echo Python 3 est requis : https://www.python.org/downloads/
  pause
)

@echo off
chcp 65001 >nul
echo Rosi Reader - instalacao automatica
echo (vai pedir permissao de administrador; a primeira vez demora bastante)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%~dp0instalar.ps1""'"

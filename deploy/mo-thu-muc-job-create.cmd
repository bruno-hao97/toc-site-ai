@echo off
cd /d "%~dp0.."
explorer /select,"%CD%\server\php-bridge\job-create.php"
echo.
echo Da chon file: server\php-bridge\job-create.php
echo.
echo Tiep theo: aaPanel -^> Files -^> search migrate-jobs.php -^> Upload -^> chon file nay -^> Replace
echo.
pause

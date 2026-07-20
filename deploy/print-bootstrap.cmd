@echo off
chcp 65001 >nul
echo.
echo ============================================================
echo  QUAN TRONG - DOC TRUOC KHI LAM
echo ============================================================
echo.
echo File nay CHI IN lenh ra man hinh Windows.
echo No KHONG tu upload len VPS.
echo.
echo Neu mo URL hotfix-upload.php ma thay 404 = BINH THUONG
echo (vi file chua duoc tao tren VPS).
echo.
echo Ban phai lam 1 trong 2 cach:
echo   A) aaPanel -^> Files -^> upload job-create.php  (DE NHAT)
echo   B) aaPanel -^> Terminal -^> paste lenh bash ben duoi
echo.
echo Xem: deploy\UPLOAD-1-FILE-AAPANEL.md
echo.
echo ============================================================
echo.
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0push-bridge-hotfix.ps1" -PrintBootstrapCommand
pause

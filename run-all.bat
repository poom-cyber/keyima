@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo [!] ต้องมี Node.js 22+ ก่อน  https://nodejs.org & pause & exit /b)
if not exist "be\node_modules" ( echo [setup] ติดตั้ง backend... & pushd be && call npm install --no-audit --no-fund & popd )
if not exist "db\node_modules" ( echo [setup] ติดตั้ง db...      & pushd db && call npm install --no-audit --no-fund & popd )
echo [db] โหลด/อัปเดตสินค้า 312 รายการ...
node --experimental-sqlite "db\sync-catalog.js"
echo เปิด: storefront(:3000) admin-api(:4000) หน้าร้าน(:5173) หน้าแอดมิน(:5174)
start "KEYIMA storefront-api :3000" cmd /k "cd /d "%~dp0be\storefront-api" && node --experimental-sqlite server.js"
start "KEYIMA admin-api :4000"      cmd /k "cd /d "%~dp0be\admin-api" && node --experimental-sqlite server.js"
start "KEYIMA shop :5173"           cmd /k "node "%~dp0serve-fe.js" "%~dp0fe\store" 5173"
start "KEYIMA admin :5174"          cmd /k "node "%~dp0serve-fe.js" "%~dp0fe\admin" 5174"
timeout /t 4 >nul
start http://localhost:5173
start http://localhost:5174/login
echo.
echo  หน้าร้าน  : http://localhost:5173
echo  หน้าแอดมิน: http://localhost:5174/login   (admin / admin123 · API base = http://localhost:4000)
echo  ปิดหน้าต่างสีดำเพื่อหยุดบริการ
endlocal

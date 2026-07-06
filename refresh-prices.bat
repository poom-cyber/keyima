@echo off
setlocal
cd /d "%~dp0"
echo === ดึงราคาล่าสุดจากระบบเช็คราคา (data.json -> catalog -> ฐานข้อมูล) ===
where python >nul 2>nul && (python db\build_catalog.py) || (py db\build_catalog.py)
node --experimental-sqlite db\sync-catalog.js
echo.
echo เสร็จ! ถ้าเซิร์ฟเวอร์เปิดอยู่ ให้ Ctrl+F5 ที่หน้าร้าน/แอดมิน
echo (หรือกดปุ่ม "ดึงราคาล่าสุด" ในหน้าแอดมิน เพื่อซิงค์เข้า DB ทันทีโดยไม่ต้องรันไฟล์นี้)
pause

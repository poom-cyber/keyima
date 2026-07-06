/* config.js — ตั้งค่าร้าน (แก้ตรงนี้ก่อนใช้จริง) */

// URL ของ backend ตอนขึ้นเว็บจริง (Render) — *** เปลี่ยนเป็นของคุณหลัง deploy ***
const PROD_API = "https://keyima-api.onrender.com";
const IS_LOCAL = ["localhost", "127.0.0.1", ""].includes(location.hostname);

window.APP_CONFIG = {
  API_BASE: IS_LOCAL ? "http://localhost:3000" : PROD_API,   // storefront-api

  // *** ใส่เลขพร้อมเพย์ของร้าน (เบอร์มือถือ 10 หลัก หรือเลขบัตร ปชช. 13 หลัก) ***
  PROMPTPAY_ID: "0820095962",                     // เช่น "0812345678"

  // ลิงก์แอด LINE ของร้าน (ให้ลูกค้าส่งสลิป/สอบถาม)
  LINE_URL: "https://lin.ee/aQLcKQK",

  SHOP_NAME: "KEYIMA",
  CURRENCY: "thb"
};

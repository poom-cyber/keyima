/* login.js */
if (AdminAPI.token()) location.href = "index.html";

const apiInput = document.getElementById("api-base");
apiInput.value = AdminAPI.base();

const err = document.getElementById("err");
const btn = document.getElementById("login-btn");

async function doLogin() {
  AdminAPI.setBase(apiInput.value.trim() || "http://localhost:3000");
  err.textContent = "";
  btn.disabled = true; btn.textContent = "กำลังเข้าสู่ระบบ…";
  try {
    await AdminAPI.login(
      document.getElementById("username").value.trim(),
      document.getElementById("password").value
    );
    location.href = "index.html";
  } catch (e) {
    err.textContent = e.message;
    btn.disabled = false; btn.textContent = "เข้าสู่ระบบ";
  }
}

btn.addEventListener("click", doLogin);
document.getElementById("password").addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });

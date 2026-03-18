const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

module.exports = function ({ pool, views, config }) {
  const router = require("express").Router();
  const { pageHead, themeScript } = views;
  const { AUTH_SECRET, AUTH_MODE, SESSION_PASSWORD, SESSION_PIN } = config;

  // Load vision icon for login animation
  let visionIconSvg = '';
  try {
    visionIconSvg = fs.readFileSync(path.join(__dirname, '..', 'vision icon.svg'), 'utf8');
  } catch (e) { /* no icon available */ }

  router.get("/login", (req, res) => {
    if (!AUTH_SECRET) return res.redirect("/");
    const isPIN = AUTH_MODE === "pin";
    const pinLen = 8; // fixed display length to avoid leaking actual PIN length
    res.send(`${pageHead("Login")}
<body>
${themeScript()}
<style>
  body { display: flex; align-items: center; justify-content: center; overflow: hidden; }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes dotPop {
    0% { transform: scale(1); }
    50% { transform: scale(1.3); }
    100% { transform: scale(1); }
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-6px); }
    40%, 80% { transform: translateX(6px); }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .login-card { position: relative; z-index: 1; width: 100%; max-width: 360px; padding: 44px 32px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
    backdrop-filter: blur(16px); text-align: center;
    animation: scaleIn 0.4s ease both; }
  .login-card .logo { font-weight: 300; font-size: 13px; letter-spacing: 2px; text-transform: uppercase;
    color: var(--text-muted); margin-bottom: 28px; animation: fadeInUp 0.4s ease both; animation-delay: 0.1s; }
  .login-card h1 { font-size: 26px; font-weight: 300; letter-spacing: -0.3px; margin-bottom: 6px;
    animation: fadeInUp 0.4s ease both; animation-delay: 0.15s; }
  .login-card p { color: var(--text-muted); font-size: 14px; font-weight: 300; margin-bottom: 24px;
    animation: fadeInUp 0.4s ease both; animation-delay: 0.2s; }
  .login-card input[type="password"] { width: 100%; padding: 12px 16px; font-size: 14px; font-weight: 300;
    border: 1px solid var(--border); border-radius: 8px; background: transparent;
    color: var(--text); font-family: inherit; box-sizing: border-box; }
  .login-card input:focus { outline: none; border-color: var(--warm); }
  .login-card button[type="submit"] { width: 100%; margin-top: 14px; padding: 12px; font-size: 13px; font-weight: 500;
    border: 1px solid var(--warm); border-radius: 8px; cursor: pointer;
    background: transparent; color: var(--warm); text-transform: uppercase;
    letter-spacing: 1px; font-family: inherit; transition: all 0.2s; }
  .login-card button[type="submit"]:hover { background: rgba(160,140,212,0.1); color: var(--text); }
  .error-msg { margin-top: 14px; padding: 10px; border-radius: 6px;
    background: var(--red-bg); color: var(--red); font-size: 13px; display: none; }
  .pin-dots { display: flex; justify-content: center; gap: 12px; margin-bottom: 24px;
    animation: fadeInUp 0.4s ease both; animation-delay: 0.25s; }
  .pin-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--border);
    transition: all 0.2s; }
  .pin-dot.filled { background: var(--warm); border-color: var(--warm); animation: dotPop 0.2s ease; }
  .pin-dot.error { border-color: var(--red); background: var(--red); }
  .pin-dots.shake { animation: shake 0.4s ease; }
  .pin-pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 240px; margin: 0 auto;
    animation: fadeInUp 0.4s ease both; animation-delay: 0.3s; }
  .pin-key { padding: 16px; font-size: 22px; font-weight: 300; border: 1px solid var(--border);
    border-radius: 10px; background: transparent; color: var(--text); cursor: pointer;
    font-family: inherit; transition: all 0.15s; user-select: none; -webkit-user-select: none;
    touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
  .pin-key:hover { border-color: var(--warm); }
  .pin-key:active { background: rgba(160,140,212,0.1); transform: scale(0.95); }
  .pin-key.fn { font-size: 12px; font-weight: 400; letter-spacing: 0.5px; text-transform: uppercase;
    color: var(--text-muted); border-color: transparent; }
  .pin-key.fn:hover { color: var(--text); }
  @keyframes loginIconPulse {
    0% { transform: scale(0.3); opacity: 0; }
    40% { transform: scale(1.05); opacity: 1; }
    60% { transform: scale(0.98); opacity: 1; }
    80% { transform: scale(1); opacity: 1; }
    100% { transform: scale(1); opacity: 0; }
  }
  @keyframes loginGlow {
    0% { box-shadow: 0 0 0 0 rgba(212,165,116,0); }
    50% { box-shadow: 0 0 60px 20px rgba(212,165,116,0.3); }
    100% { box-shadow: 0 0 80px 30px rgba(212,165,116,0); }
  }
  @keyframes loginFadeOut {
    0% { opacity: 1; }
    100% { opacity: 0; }
  }
  .login-success-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: var(--bg); z-index: 1000; align-items: center; justify-content: center;
    flex-direction: column; gap: 24px; }
  .login-success-overlay.active { display: flex; animation: loginFadeOut 0.5s ease 1.6s forwards; }
  .login-success-overlay .icon-container { width: 120px; height: 120px; border-radius: 24px;
    overflow: hidden; animation: loginIconPulse 2s ease forwards, loginGlow 2s ease forwards; }
  .login-success-overlay .icon-container svg { width: 100%; height: 100%; }
  .login-success-overlay .welcome-text { font-size: 16px; font-weight: 300; color: var(--text-muted);
    letter-spacing: 2px; text-transform: uppercase; opacity: 0;
    animation: fadeInUp 0.4s ease 0.4s forwards; }
</style>
  <div class="login-success-overlay" id="login-success">
    <div class="icon-container">${visionIconSvg}</div>
    <div class="welcome-text">Welcome back</div>
  </div>
  <div class="login-card">
    <div class="logo">Per-sistant</div>
    <h1>Welcome back</h1>
    ${isPIN ? `
    <p>Enter your PIN</p>
    <div class="pin-dots" id="pin-dots"></div>
    <div class="pin-pad" id="pin-pad"></div>
    <div id="error" class="error-msg"></div>
    ` : `
    <p>Enter your password to continue</p>
    <form id="login-form">
      <input type="password" id="pw" placeholder="Password" autofocus required>
      <button type="submit">Sign In</button>
    </form>
    <div id="error" class="error-msg"></div>
    `}
  </div>
  <script>
    var errEl = document.getElementById('error');
    async function doLogin(value) {
      try {
        var res = await fetch('/api/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: value }),
        });
        var data = await res.json();
        if (res.ok) {
          var overlay = document.getElementById('login-success');
          if (overlay.querySelector('svg')) {
            overlay.classList.add('active');
            setTimeout(function() { window.location.href = '/'; }, 2000);
          } else {
            window.location.href = '/';
          }
          return null;
        }
        else return data.error || 'Invalid credentials';
      } catch(e) { return 'Connection error'; }
    }
    ${isPIN ? `
    (function() {
      var pinLen = ${pinLen};
      var pin = '';
      var submitting = false;
      var dotsEl = document.getElementById('pin-dots');
      var dotsHtml = '';
      for (var i = 0; i < pinLen; i++) dotsHtml += '<div class="pin-dot" id="dot-' + i + '"></div>';
      dotsEl.innerHTML = dotsHtml;
      var padEl = document.getElementById('pin-pad');
      var padHtml = '';
      [1,2,3,4,5,6,7,8,9].forEach(function(n) {
        padHtml += '<button class="pin-key" type="button" data-digit="' + n + '">' + n + '</button>';
      });
      padHtml += '<button class="pin-key fn" type="button" data-action="clear">Clear</button>';
      padHtml += '<button class="pin-key" type="button" data-digit="0">0</button>';
      padHtml += '<button class="pin-key fn" type="button" data-action="submit" style="color:var(--warm);">Go</button>';
      padEl.innerHTML = padHtml;
      function updateDots() {
        for (var i = 0; i < pinLen; i++) {
          document.getElementById('dot-' + i).className = 'pin-dot' + (i < pin.length ? ' filled' : '');
        }
      }
      function handleDigit(n) {
        if (pin.length >= pinLen || submitting) return;
        pin += n;
        updateDots();
        errEl.style.display = 'none';
      }
      async function submitPin() {
        if (!pin.length || submitting) return;
        submitting = true;
        var err = await doLogin(pin);
        if (err) {
          for (var i = 0; i < pinLen; i++) {
            if (i < pin.length) document.getElementById('dot-' + i).className = 'pin-dot error';
          }
          dotsEl.classList.add('shake');
          errEl.textContent = err; errEl.style.display = 'block';
          setTimeout(function() { pin = ''; submitting = false; updateDots(); dotsEl.classList.remove('shake'); }, 600);
        }
      }
      padEl.addEventListener('click', function(e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        e.preventDefault();
        if (btn.dataset.digit !== undefined) handleDigit(btn.dataset.digit);
        else if (btn.dataset.action === 'clear') { pin = ''; updateDots(); errEl.style.display = 'none'; }
        else if (btn.dataset.action === 'submit') submitPin();
      });
    })();
    ` : `
    document.getElementById('login-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      var err = await doLogin(document.getElementById('pw').value);
      if (err) { errEl.textContent = err; errEl.style.display = 'block'; }
    });
    `}
  </script>
</body></html>`);
  });

  router.post("/api/login", async (req, res) => {
    const { password } = req.body;
    if (!AUTH_SECRET) return res.json({ ok: true });
    if (!password) return res.status(400).json({ error: (AUTH_MODE === "pin" ? "PIN" : "Password") + " required" });
    const providedBuf = Buffer.from(String(password));
    const expectedBuf = Buffer.from(AUTH_SECRET);
    if (providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      let timeout = 15;
      try {
        const r = await pool.query("SELECT session_timeout_minutes FROM user_settings WHERE id = 1");
        if (r.rows.length) timeout = r.rows[0].session_timeout_minutes;
      } catch {}
      req.session.authenticated = true;
      req.session.lastActivity = Date.now();
      req.session.timeoutMinutes = timeout;
      return res.json({ ok: true });
    }
    return res.status(401).json({ error: AUTH_MODE === "pin" ? "Invalid PIN" : "Invalid password" });
  });

  router.post("/api/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  return router;
};

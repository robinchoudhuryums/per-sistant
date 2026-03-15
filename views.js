// ============================================================================
// Per-sistant — Shared Views (CSS, JS, HTML helpers)
// ============================================================================

const { PERFIN_URL } = require("./config");

const SHARED_CSS = require("./views/css");
const SHARED_JS = require("./views/js");

function pageHead(title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Per-sistant</title>
  <link rel="manifest" href="/manifest.json">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#0a0b14">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>${SHARED_CSS}</style>
  <script>${SHARED_JS}</script>
</head>`;
}

function navBar(activePage) {
  const links = [
    { href: "/", label: "Dashboard", icon: "&#9632;" },
    { href: "/todos", label: "To-Dos", icon: "&#9745;" },
    { href: "/emails", label: "Emails", icon: "&#9993;" },
    { href: "/notes", label: "Notes", icon: "&#9998;" },
    { href: "/calendar", label: "Calendar", icon: "&#128197;" },
    { href: "/contacts", label: "Contacts", icon: "&#128100;" },
    { href: "/review", label: "Review", icon: "&#128202;" },
    { href: "/analytics", label: "Analytics", icon: "&#128200;" },
    { href: "/settings", label: "Settings", icon: "&#9881;" },
  ];
  const bottomLinks = links.slice(0, 5);
  const perfinLink = PERFIN_URL ? `<a href="${PERFIN_URL}" target="_blank">Perfin</a>` : "";
  return `<nav class="topnav">
    <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
      <div class="logo">Per-sistant</div>
      <button class="mobile-toggle" onclick="document.querySelector('.nav-links').classList.toggle('mobile-open')" aria-label="Toggle menu">&#9776;</button>
    </div>
    <div class="nav-links">
      ${links.map(l => `<a href="${l.href}" class="${activePage === l.href ? 'active' : ''}">${l.label}</a>`).join("\n      ")}
      ${perfinLink}
    </div>
  </nav>
  <nav class="bottom-nav">
    ${bottomLinks.map(l => `<a href="${l.href}" class="${activePage === l.href ? 'active' : ''}"><span class="nav-icon">${l.icon}</span>${l.label}</a>`).join("\n    ")}
  </nav>`;
}

function themeScript() {
  return `<script>
    (function(){
      var t = localStorage.getItem('theme') || 'dark';
      var effective = t;
      if (t === 'auto') effective = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      if (effective === 'light') document.documentElement.setAttribute('data-theme','light');
      if (t === 'auto') window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function(e) {
        if (e.matches) document.documentElement.setAttribute('data-theme','light');
        else document.documentElement.removeAttribute('data-theme');
      });
    })();
  </script>`;
}

module.exports = { SHARED_CSS, SHARED_JS, pageHead, navBar, themeScript };

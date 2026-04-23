// ============================================================================
// Per-sistant — Shared Views (CSS, JS, HTML helpers)
// ============================================================================
// Warm-paper design system. CSS is split across three files so each fits in a
// single push; they concatenate into one <style> block at page-head time.

const { PERFIN_URL } = require("./config");

const CSS_CORE = require("./views/css");
const CSS_COMPONENTS = require("./views/css-components");
const CSS_PAGES = require("./views/css-pages");
const SHARED_CSS = CSS_CORE + CSS_COMPONENTS + CSS_PAGES;
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
  <link rel="apple-touch-icon" href="/icon-192.svg">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#faf7f2">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>${SHARED_CSS}</style>
  <script>${SHARED_JS}</script>
</head>`;
}

// Navigation items, shared between sidebar render paths.
// Icons kept small and line-based to match the mono-label aesthetic.
const NAV = [
  { href: "/",         label: "Dashboard", id: "dashboard" },
  { href: "/todos",    label: "To-Dos",    id: "todos" },
  { href: "/emails",   label: "Emails",    id: "emails" },
  { href: "/notes",    label: "Notes",     id: "notes" },
  { href: "/contacts", label: "Contacts",  id: "contacts" },
  { href: "/calendar", label: "Calendar",  id: "calendar" },
  { href: "/review",   label: "Review",    id: "review" },
  { href: "/analytics",label: "Analytics", id: "analytics" },
  { href: "/settings", label: "Settings",  id: "settings" },
];

function navIcon(id) {
  // Tiny 14x14 stroke-only glyphs matching the design bundle's aesthetic.
  const c = 'currentColor', sw = '1.3';
  switch (id) {
    case 'dashboard': return `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="5" height="5" fill="none" stroke="${c}" stroke-width="${sw}"/><rect x="8" y="1" width="5" height="5" fill="none" stroke="${c}" stroke-width="${sw}"/><rect x="1" y="8" width="5" height="5" fill="none" stroke="${c}" stroke-width="${sw}"/><rect x="8" y="8" width="5" height="5" fill="none" stroke="${c}" stroke-width="${sw}"/></svg>`;
    case 'todos': return `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1.5" y="1.5" width="11" height="11" fill="none" stroke="${c}" stroke-width="${sw}"/><path d="M4 7 L6 9 L10 5" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/></svg>`;
    case 'emails': return `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1.5" y="3" width="11" height="8" fill="none" stroke="${c}" stroke-width="${sw}"/><path d="M1.5 3.5 L7 8 L12.5 3.5" fill="none" stroke="${c}" stroke-width="${sw}"/></svg>`;
    case 'notes': return `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1.5 L11 1.5 L11 12.5 L3 12.5 Z" fill="none" stroke="${c}" stroke-width="${sw}"/><line x1="5" y1="5" x2="9" y2="5" stroke="${c}" stroke-width="1"/><line x1="5" y1="7.5" x2="9" y2="7.5" stroke="${c}" stroke-width="1"/><line x1="5" y1="10" x2="7.5" y2="10" stroke="${c}" stroke-width="1"/></svg>`;
    case 'contacts': return `<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="5" r="2.3" fill="none" stroke="${c}" stroke-width="${sw}"/><path d="M2.5 12.5 Q2.5 8.5 7 8.5 Q11.5 8.5 11.5 12.5" fill="none" stroke="${c}" stroke-width="${sw}"/></svg>`;
    case 'calendar': return `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1.5" y="2.5" width="11" height="10" fill="none" stroke="${c}" stroke-width="${sw}"/><line x1="1.5" y1="5.5" x2="12.5" y2="5.5" stroke="${c}" stroke-width="1"/><line x1="4.5" y1="1" x2="4.5" y2="4" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/><line x1="9.5" y1="1" x2="9.5" y2="4" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/></svg>`;
    case 'review': return `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="8" width="2" height="5" fill="${c}"/><rect x="6" y="5" width="2" height="8" fill="${c}"/><rect x="10" y="2" width="2" height="11" fill="${c}"/></svg>`;
    case 'analytics': return `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M1.5 11 L5 7 L8 9 L12.5 3" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'settings': return `<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="2" fill="none" stroke="${c}" stroke-width="${sw}"/><path d="M7 1 L7 3 M7 11 L7 13 M1 7 L3 7 M11 7 L13 7 M2.8 2.8 L4.2 4.2 M9.8 9.8 L11.2 11.2 M2.8 11.2 L4.2 9.8 M9.8 4.2 L11.2 2.8" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/></svg>`;
    default: return '';
  }
}

// navBar(activePath) — renders the sidebar plus the app bar with breadcrumbs.
// The sidebar is position:fixed; body has padding-left:220px (css.js) so main
// content isn't obscured. Pages keep their existing `<div class="container">`
// wrapper unchanged.
function navBar(activePath) {
  const active = (NAV.find(n => n.href === activePath) || {}).id || 'dashboard';
  const links = NAV.map(n => `
    <a href="${n.href}" class="${n.id === active ? 'active' : ''}">
      <span class="icon">${navIcon(n.id)}</span>
      <span class="label">${n.label}</span>
    </a>`).join('');
  const perfinLink = PERFIN_URL
    ? `<a href="${PERFIN_URL}" target="_blank" rel="noopener">
         <span class="icon"><svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7 4 L7 10 M4 7 L10 7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></span>
         <span class="label">Perfin</span>
       </a>` : '';
  const here = (NAV.find(n => n.href === activePath) || {}).label || 'Per-sistant';
  return `
<aside class="sidebar">
  <div class="sidebar-brand">
    <div class="glyph">P</div>
    <div>
      <div class="name">Per-sistant</div>
      <div class="tag">personal assistant</div>
    </div>
  </div>
  <nav class="sidebar-nav">
    ${links}
    ${perfinLink ? '<div class="sep"></div>' + perfinLink : ''}
  </nav>
  <div class="sidebar-foot">
    <button id="sidebar-collapse-btn" class="collapse-btn" aria-label="Collapse sidebar">
      <span>&#8249;</span><span class="lbl">Collapse</span>
    </button>
  </div>
</aside>
<header class="appbar">
  <button class="mobile-sidebar-toggle" id="mobile-sidebar-toggle" aria-label="Menu">&#9776;</button>
  <nav class="crumbs">
    <a href="/">Home</a>
    <span class="sep">&rsaquo;</span>
    <span class="here">${here}</span>
  </nav>
  <div class="spacer"></div>
</header>`;
}

// themeScript — applies saved palette + mode to body on every page and wires
// the sidebar collapse + mobile toggle. Pulls server-side prefs once via
// /api/settings for first-load correctness across devices.
function themeScript() {
  return `<script>
  (function(){
    function apply() {
      try {
        var saved = JSON.parse(localStorage.getItem('ps-ui') || '{}');
        var palette = saved.palette || 'copper';
        var mode = saved.mode || 'light';
        document.body.setAttribute('data-palette', palette);
        document.body.setAttribute('data-mode', mode);
        if (saved.collapsed === true) document.body.classList.add('sidebar-collapsed');
      } catch {}
    }
    if (document.body) apply();
    document.addEventListener('DOMContentLoaded', function() {
      apply();
      var btn = document.getElementById('sidebar-collapse-btn');
      if (btn) btn.addEventListener('click', function() {
        document.body.classList.toggle('sidebar-collapsed');
        var s = {};
        try { s = JSON.parse(localStorage.getItem('ps-ui') || '{}'); } catch {}
        s.collapsed = document.body.classList.contains('sidebar-collapsed');
        localStorage.setItem('ps-ui', JSON.stringify(s));
      });
      var mob = document.getElementById('mobile-sidebar-toggle');
      if (mob) mob.addEventListener('click', function() {
        document.body.classList.toggle('sidebar-open');
      });
    });
    fetch('/api/settings').then(function(r){return r.json();}).then(function(s){
      if (!s) return;
      var cur = {};
      try { cur = JSON.parse(localStorage.getItem('ps-ui') || '{}'); } catch {}
      if (s.palette && cur.palette !== s.palette) {
        cur.palette = s.palette;
        if (document.body) document.body.setAttribute('data-palette', s.palette);
      }
      if (s.theme === 'dark' || s.theme === 'light') {
        cur.mode = s.theme;
        if (document.body) document.body.setAttribute('data-mode', s.theme);
      }
      localStorage.setItem('ps-ui', JSON.stringify(cur));
    }).catch(function(){});
  })();
</script>`;
}

module.exports = { SHARED_CSS, SHARED_JS, pageHead, navBar, themeScript };

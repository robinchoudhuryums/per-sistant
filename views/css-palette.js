// ============================================================================
// Per-sistant — Palette Overrides (forest + mint)
// ============================================================================
// Injected after SHARED_CSS so later :root declarations win the cascade.
// Swaps Per-sistant's warm/teal accents for a forest+mint scheme so it reads
// visibly distinct from Perfin (which keeps warm tan + teal) while sharing
// the same component structure.
//
// The CSS variable overrides affect buttons, badges, borders, links, active
// states, and anywhere `var(--warm)` / `var(--teal)` / `var(--green)` is used.
// A handful of hardcoded rgba() glows in views/css.js still reference the
// original hues; those are cosmetic accents on hover/focus and are scheduled
// for a follow-up pass.

module.exports = `
:root {
  --warm: #4a8a5a; --warm-glow: #5fa070; --teal: #6fd4b0;
  --green: #68d89f; --green-bg: rgba(104,216,159,0.1);
}
[data-theme="light"] {
  --warm: #3a6e48; --warm-glow: #2e5c3a; --teal: #3a9a7a;
  --green: #2a8050; --green-bg: rgba(42,128,80,0.1);
}
[data-mode="work"] {
  --warm: #2e5c3a; --warm-glow: #1f4a26; --teal: #4bb890;
}
[data-theme="light"][data-mode="work"] {
  --warm: #224a2a; --warm-glow: #163818; --teal: #2a8060;
}
/* Refine hardcoded warm/teal glows to match the new palette */
.actions button.primary:hover:not(:disabled),
.actions .btn.primary:hover,
.modal .modal-actions button.primary:hover {
  background: rgba(74,138,90,0.10);
}
.filters button.active { background: rgba(74,138,90,0.08); }
.card::before {
  background: linear-gradient(135deg, rgba(74,138,90,0.30), rgba(111,212,176,0.30), rgba(104,216,159,0.20));
}
.section::before {
  background: linear-gradient(135deg, rgba(74,138,90,0.15), rgba(111,212,176,0.15));
}
input:focus, select:focus, textarea:focus {
  box-shadow: 0 0 0 3px rgba(74,138,90,0.15), 0 0 20px rgba(91,168,230,0.10);
}
.search-bar input:focus {
  box-shadow: 0 0 0 3px rgba(74,138,90,0.15), 0 0 30px rgba(91,168,230,0.08);
}
.actions button.primary { box-shadow: 0 0 12px rgba(74,138,90,0.15); }
.actions button.primary:hover:not(:disabled) { box-shadow: 0 0 20px rgba(74,138,90,0.25); }
.tree-svg {
  filter: drop-shadow(0 20px 40px rgba(111,212,176,0.20)) drop-shadow(0 8px 16px rgba(74,138,90,0.15));
}
.tree-stat-value.glow-green { text-shadow: 0 0 12px rgba(104,216,159,0.40); }
.tree-stat-value.glow-warm  { text-shadow: 0 0 12px rgba(74,138,90,0.40); }
.tree-stat-value.glow-teal  { text-shadow: 0 0 12px rgba(111,212,176,0.40); }
`;

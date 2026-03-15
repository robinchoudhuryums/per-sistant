const express = require("express");

module.exports = function ({ pool, config }) {
  const router = express.Router();
  const PERFIN_URL = config.PERFIN_URL;

  router.get("/api/perfin/stats", async (req, res) => {
    const perfinUrl = PERFIN_URL || (await pool.query("SELECT perfin_url FROM user_settings WHERE id = 1").catch(() => ({rows:[]}))).rows[0]?.perfin_url;
    if (!perfinUrl) return res.json({ connected: false });
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const r = await fetch(`${perfinUrl}/api/subscriptions?filter=active`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!r.ok) return res.json({ connected: false });
      const subs = await r.json();
      const totalMonthly = subs.filter(s => s.cadence_days <= 31).reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
      const upcoming = subs.filter(s => {
        const next = new Date(s.next_expected);
        const now = new Date();
        const diff = (next - now) / 86400000;
        return diff >= 0 && diff <= 7;
      });
      res.json({ connected: true, total_subscriptions: subs.length, monthly_cost: totalMonthly.toFixed(2), upcoming_this_week: upcoming.length, upcoming });
    } catch {
      res.json({ connected: false });
    }
  });

  return router;
};

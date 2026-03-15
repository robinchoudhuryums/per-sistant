const { pageHead, navBar, themeScript } = require("../views");

module.exports = function(AUTH_SECRET) {
  return (req, res) => {
    res.send(`${pageHead("Settings")}
<body>
${themeScript()}
<div class="container">
  ${navBar("/settings")}
  <h1>Settings</h1>
  <p class="subtitle">Configure your personal assistant</p>

  <div id="status" class="status-msg"></div>

  <div class="section">
    <h2>Appearance</h2>
    <div style="display:flex;gap:12px;align-items:center;">
      <label style="margin:0;font-size:13px;color:var(--text);">Theme</label>
      <select id="s-theme" onchange="saveSettings()" style="width:auto;padding:8px 14px;font-size:13px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);">
        <option value="dark">Night Mode</option>
        <option value="light">Day Mode</option>
        <option value="auto">Auto (System)</option>
      </select>
    </div>
  </div>

  <div class="section">
    <h2>Session</h2>
    <div style="display:flex;gap:12px;align-items:center;">
      <label style="margin:0;font-size:13px;color:var(--text);">Timeout (minutes)</label>
      <input type="number" id="s-timeout" min="1" max="1440" style="width:100px;padding:8px 14px;font-size:13px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);">
      <button onclick="saveSettings()" style="padding:8px 16px;font-size:12px;font-weight:500;border:1px solid var(--warm);border-radius:8px;cursor:pointer;background:transparent;color:var(--warm);font-family:inherit;">Save</button>
    </div>
  </div>

  <div class="section">
    <h2>Default Task Horizon</h2>
    <select id="s-horizon" onchange="saveSettings()" style="width:auto;padding:8px 14px;font-size:13px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);">
      <option value="short">Short-term</option>
      <option value="medium">Medium-term</option>
      <option value="long">Long-term</option>
    </select>
  </div>

  <div class="section">
    <h2>Perfin Integration</h2>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Link to your Perfin (personal finance tracker) instance</p>
    <div style="display:flex;gap:12px;align-items:center;">
      <input type="url" id="s-perfin" placeholder="https://your-perfin-instance.onrender.com" style="flex:1;padding:8px 14px;font-size:13px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);">
      <button onclick="saveSettings()" style="padding:8px 16px;font-size:12px;font-weight:500;border:1px solid var(--warm);border-radius:8px;cursor:pointer;background:transparent;color:var(--warm);font-family:inherit;">Save</button>
    </div>
  </div>

  <div class="section">
    <h2>AI Features</h2>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px;" id="ai-status"></p>
    <div id="ai-models-section" style="display:none;">
      <p style="font-size:11px;color:var(--text-muted);margin-bottom:16px;">Choose a model for each AI feature. Sonnet is smarter but ~5x more expensive than Haiku. Set to Off to disable.</p>
      <div style="display:grid;gap:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
          <div><div style="font-size:13px;font-weight:400;">Email Drafting</div><div style="font-size:10px;color:var(--text-muted);">AI-compose emails from a prompt</div></div>
          <select id="aim-email_draft" onchange="saveAIModels()" style="width:120px;padding:6px 10px;font-size:12px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);"><option value="haiku">Haiku</option><option value="sonnet">Sonnet</option><option value="off">Off</option></select>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
          <div><div style="font-size:13px;font-weight:400;">Task Breakdown</div><div style="font-size:10px;color:var(--text-muted);">Auto-generate subtasks from task title</div></div>
          <select id="aim-task_breakdown" onchange="saveAIModels()" style="width:120px;padding:6px 10px;font-size:12px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);"><option value="haiku">Haiku</option><option value="sonnet">Sonnet</option><option value="off">Off</option></select>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
          <div><div style="font-size:13px;font-weight:400;">Smart Quick Add</div><div style="font-size:10px;color:var(--text-muted);">AI-parse natural language into structured tasks</div></div>
          <select id="aim-quick_add" onchange="saveAIModels()" style="width:120px;padding:6px 10px;font-size:12px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);"><option value="haiku">Haiku</option><option value="sonnet">Sonnet</option><option value="off">Off</option></select>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
          <div><div style="font-size:13px;font-weight:400;">Weekly Review Summary</div><div style="font-size:10px;color:var(--text-muted);">AI-written narrative of your week</div></div>
          <select id="aim-review_summary" onchange="saveAIModels()" style="width:120px;padding:6px 10px;font-size:12px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);"><option value="haiku">Haiku</option><option value="sonnet">Sonnet</option><option value="off">Off</option></select>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
          <div><div style="font-size:13px;font-weight:400;">Email Tone Adjustment</div><div style="font-size:10px;color:var(--text-muted);">Rewrite emails in different tones</div></div>
          <select id="aim-email_tone" onchange="saveAIModels()" style="width:120px;padding:6px 10px;font-size:12px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);"><option value="haiku">Haiku</option><option value="sonnet">Sonnet</option><option value="off">Off</option></select>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
          <div><div style="font-size:13px;font-weight:400;">Daily Briefing</div><div style="font-size:10px;color:var(--text-muted);">AI summary of your day on the dashboard</div></div>
          <select id="aim-daily_briefing" onchange="saveAIModels()" style="width:120px;padding:6px 10px;font-size:12px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);"><option value="haiku">Haiku</option><option value="sonnet">Sonnet</option><option value="off">Off</option></select>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;">
          <div><div style="font-size:13px;font-weight:400;">Note Auto-Tagging</div><div style="font-size:10px;color:var(--text-muted);">Suggest tags when creating notes</div></div>
          <select id="aim-note_tagging" onchange="saveAIModels()" style="width:120px;padding:6px 10px;font-size:12px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);"><option value="haiku">Haiku</option><option value="sonnet">Sonnet</option><option value="off">Off</option></select>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Email (SMTP)</h2>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px;" id="smtp-status"></p>
  </div>

  <div class="section">
    <h2>Browser Notifications</h2>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Get notified about reminders and overdue tasks</p>
    <div class="actions" style="margin-bottom:0;">
      <button onclick="enableNotifications()" id="notif-btn">Enable Notifications</button>
    </div>
  </div>

  <div class="section">
    <h2>Keyboard Shortcuts</h2>
    <div style="font-size:12px;color:var(--text-muted);line-height:2;">
      <span class="kbd">/</span> Focus search &middot;
      <span class="kbd">N</span> New task &middot;
      <span class="kbd">E</span> New email &middot;
      <span class="kbd">C</span> Calendar &middot;
      <span class="kbd">R</span> Weekly review &middot;
      <span class="kbd">Q</span> Quick add (on todos page) &middot;
      <span class="kbd">Esc</span> Close modals
    </div>
  </div>

  <div class="section">
    <h2>Data Export</h2>
    <div class="actions" style="margin-bottom:0;">
      <button onclick="exportData('todos')">Export Todos</button>
      <button onclick="exportData('emails')">Export Emails</button>
      <button onclick="exportData('notes')">Export Notes</button>
      <button onclick="exportData('contacts')">Export Contacts</button>
    </div>
  </div>

  <div class="section">
    <h2>Trash</h2>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Deleted items are kept for 30 days before permanent removal.</p>
    <div id="trash-list" style="margin-bottom:10px;"></div>
    <div class="actions" style="margin-bottom:0;">
      <button onclick="loadTrash()">View Trash</button>
      <button class="danger" style="border-color:var(--red);color:var(--red);" onclick="emptyTrash()">Empty Trash</button>
    </div>
  </div>

  <div class="section">
    <h2>Automations</h2>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Create rules that trigger actions automatically when events occur.</p>
    <div id="automations-list" style="margin-bottom:12px;"></div>
    <button onclick="openAutoModal()" style="padding:8px 16px;font-size:12px;font-weight:500;border:1px solid var(--warm);border-radius:8px;cursor:pointer;background:transparent;color:var(--warm);font-family:inherit;text-transform:uppercase;">+ New Rule</button>
  </div>

  <div class="section">
    <h2>Webhooks</h2>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Configure external webhook endpoints to receive event notifications.</p>
    <div id="webhooks-list" style="margin-bottom:12px;"></div>
    <button onclick="openWebhookModal()" style="padding:8px 16px;font-size:12px;font-weight:500;border:1px solid var(--warm);border-radius:8px;cursor:pointer;background:transparent;color:var(--warm);font-family:inherit;text-transform:uppercase;">+ New Webhook</button>
  </div>

  <div class="section">
    <h2>Slack Integration</h2>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Add a Slack Incoming Webhook URL to receive notifications in Slack.</p>
    <div style="display:flex;gap:12px;align-items:center;">
      <input type="url" id="s-slack" placeholder="https://hooks.slack.com/services/..." style="flex:1;padding:8px 14px;font-size:13px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);">
      <button onclick="saveSlack()" style="padding:8px 16px;font-size:12px;font-weight:500;border:1px solid var(--warm);border-radius:8px;cursor:pointer;background:transparent;color:var(--warm);font-family:inherit;">Save</button>
    </div>
  </div>

  ${AUTH_SECRET ? '<div class="section"><h2>Session</h2><div class="actions" style="margin-bottom:0;"><button class="danger" style="border-color:var(--red);color:var(--red);" onclick="logout()">Log Out</button></div></div>' : ''}
</div>

<!-- Automation Modal -->
<div class="modal-overlay" id="auto-modal">
  <div class="modal">
    <h2 id="auto-modal-title">New Automation</h2>
    <input type="hidden" id="auto-id">
    <label>Name</label>
    <input type="text" id="auto-name" placeholder="e.g. Auto-prioritize work tasks">
    <label>When (Trigger)</label>
    <select id="auto-trigger" style="width:100%;padding:10px 14px;font-size:14px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);">
      <option value="todo_created">Task Created</option>
      <option value="todo_completed">Task Completed</option>
      <option value="email_created">Email Created</option>
      <option value="note_created">Note Created</option>
    </select>
    <label>If (Condition — optional)</label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div>
        <select id="auto-cond-field" style="width:100%;padding:8px;font-size:12px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);">
          <option value="">Any</option>
          <option value="category">Category equals</option>
          <option value="priority">Priority equals</option>
          <option value="title_contains">Title contains</option>
          <option value="horizon">Horizon equals</option>
        </select>
      </div>
      <input type="text" id="auto-cond-value" placeholder="Value..." style="padding:8px;font-size:12px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);">
    </div>
    <label>Then (Action)</label>
    <select id="auto-action" style="width:100%;padding:10px 14px;font-size:14px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);" onchange="updateActionFields()">
      <option value="set_priority">Set Priority</option>
      <option value="set_category">Set Category</option>
      <option value="set_horizon">Set Horizon</option>
      <option value="add_tag">Add Tag (notes)</option>
      <option value="create_todo">Create Follow-up Task</option>
    </select>
    <label>Action Value</label>
    <input type="text" id="auto-action-value" placeholder="e.g. urgent, work, short...">
    <div class="modal-actions">
      <button onclick="closeAutoModal()">Cancel</button>
      <button class="primary" onclick="saveAutomation()">Save</button>
      <button class="danger" id="auto-delete-btn" style="display:none" onclick="deleteAutomation()">Delete</button>
    </div>
  </div>
</div>

<!-- Webhook Modal -->
<div class="modal-overlay" id="webhook-modal">
  <div class="modal">
    <h2 id="wh-modal-title">New Webhook</h2>
    <input type="hidden" id="wh-id">
    <label>Name</label>
    <input type="text" id="wh-name" placeholder="e.g. Slack notifications, Zapier">
    <label>URL</label>
    <input type="url" id="wh-url" placeholder="https://example.com/webhook">
    <label>Events</label>
    <div id="wh-events" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
      <label style="display:inline;font-size:11px;cursor:pointer;"><input type="checkbox" value="todo_created" style="width:auto;margin-right:4px;">Task Created</label>
      <label style="display:inline;font-size:11px;cursor:pointer;"><input type="checkbox" value="todo_completed" style="width:auto;margin-right:4px;">Task Completed</label>
      <label style="display:inline;font-size:11px;cursor:pointer;"><input type="checkbox" value="email_sent" style="width:auto;margin-right:4px;">Email Sent</label>
      <label style="display:inline;font-size:11px;cursor:pointer;"><input type="checkbox" value="note_created" style="width:auto;margin-right:4px;">Note Created</label>
      <label style="display:inline;font-size:11px;cursor:pointer;"><input type="checkbox" value="streak_milestone" style="width:auto;margin-right:4px;">Streak Milestone</label>
    </div>
    <div class="modal-actions">
      <button onclick="closeWebhookModal()">Cancel</button>
      <button class="primary" onclick="saveWebhook()">Save</button>
      <button class="danger" id="wh-delete-btn" style="display:none" onclick="deleteWebhook()">Delete</button>
    </div>
  </div>
</div>

<script>
function applyTheme(t) {
  var effective = t;
  if (t === 'auto') effective = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  if (effective === 'light') document.documentElement.setAttribute('data-theme','light');
  else document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('theme', t);
}
async function load() {
  var s = await fetch('/api/settings').then(r=>r.json());
  document.getElementById('s-theme').value = s.theme || 'dark';
  document.getElementById('s-timeout').value = s.session_timeout_minutes || 15;
  document.getElementById('s-horizon').value = s.default_horizon || 'short';
  document.getElementById('s-perfin').value = s.perfin_url || '';
  document.getElementById('smtp-status').textContent = s.smtp_configured
    ? 'SMTP is configured and ready to send emails.'
    : 'SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env to enable email sending.';
  document.getElementById('ai-status').textContent = s.ai_configured
    ? 'Claude AI is configured. Manage model preferences for each feature below.'
    : 'Not configured. Set ANTHROPIC_API_KEY in .env to enable AI features.';
  if (s.ai_configured) {
    document.getElementById('ai-models-section').style.display = 'block';
    try {
      var models = await fetch('/api/ai/models').then(r=>r.json());
      var features = ['email_draft','task_breakdown','quick_add','review_summary','email_tone','daily_briefing','note_tagging'];
      features.forEach(f => {
        var el = document.getElementById('aim-'+f);
        if (el) el.value = models['ai_model_'+f] || 'off';
      });
    } catch {}
  }
  document.getElementById('s-slack').value = s.slack_webhook_url || '';
  if ('Notification' in window && Notification.permission === 'granted') {
    document.getElementById('notif-btn').textContent = 'Notifications Enabled';
    document.getElementById('notif-btn').disabled = true;
  }

  // Apply theme
  applyTheme(s.theme || 'dark');
}

async function saveSettings() {
  var data = {
    theme: document.getElementById('s-theme').value,
    session_timeout_minutes: parseInt(document.getElementById('s-timeout').value) || 15,
    default_horizon: document.getElementById('s-horizon').value,
    perfin_url: document.getElementById('s-perfin').value || null,
  };
  await fetch('/api/settings', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});

  // Apply theme immediately
  applyTheme(data.theme);

  var el = document.getElementById('status');
  el.className = 'status-msg success';
  el.textContent = 'Settings saved.';
  setTimeout(()=>{ el.className = 'status-msg'; }, 3000);
}

async function exportData(type) {
  var data = await fetch('/api/'+type).then(r=>r.json());
  var blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = type+'-export-'+new Date().toISOString().split('T')[0]+'.json';
  a.click();
}

async function saveAIModels() {
  var data = {};
  var features = ['email_draft','task_breakdown','quick_add','review_summary','email_tone','daily_briefing','note_tagging'];
  features.forEach(f => { data['ai_model_'+f] = document.getElementById('aim-'+f).value; });
  await fetch('/api/ai/models', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  var el = document.getElementById('status');
  el.className = 'status-msg success';
  el.textContent = 'AI model preferences saved.';
  setTimeout(()=>{ el.className = 'status-msg'; }, 3000);
}

async function enableNotifications() {
  if (!('Notification' in window)) return alert('Browser does not support notifications');
  var perm = await Notification.requestPermission();
  if (perm === 'granted') {
    document.getElementById('notif-btn').textContent = 'Notifications Enabled';
    document.getElementById('notif-btn').disabled = true;
    new Notification('Per-sistant', { body: 'Notifications enabled! You will be notified about reminders and overdue tasks.' });
  }
}

async function loadTrash() {
  var items = await fetch('/api/trash').then(r=>r.json());
  var el = document.getElementById('trash-list');
  if (!items.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">Trash is empty.</div>'; return; }
  el.innerHTML = items.map(function(item) {
    var d = new Date(item.deleted_at).toLocaleDateString();
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">'
      +'<div><span style="color:var(--text-muted);font-size:11px;margin-right:8px;">'+item.type+'</span>'+esc(item.title||'Untitled')+'<span style="color:var(--text-muted);font-size:11px;margin-left:8px;">deleted '+d+'</span></div>'
      +'<div style="display:flex;gap:6px;">'
      +'<button onclick="restoreItem(\''+item.type+'\','+item.id+')" style="background:var(--green-bg);color:var(--green);border:1px solid var(--green);padding:3px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-family:inherit;">Restore</button>'
      +'<button onclick="permanentDelete(\''+item.type+'\','+item.id+')" style="background:var(--red-bg);color:var(--red);border:1px solid var(--red);padding:3px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-family:inherit;">Delete</button>'
      +'</div></div>';
  }).join('');
}

async function restoreItem(type, id) {
  await fetch('/api/trash/'+type+'/'+id+'/restore', {method:'POST'});
  loadTrash();
  var el = document.getElementById('status');
  el.className = 'status-msg success'; el.textContent = 'Item restored.';
  setTimeout(function(){ el.className = 'status-msg'; }, 3000);
}

async function permanentDelete(type, id) {
  if (!confirm('Permanently delete this item? This cannot be undone.')) return;
  await fetch('/api/trash/'+type+'/'+id, {method:'DELETE'});
  loadTrash();
}

async function emptyTrash() {
  if (!confirm('Permanently delete all items in trash? This cannot be undone.')) return;
  await fetch('/api/trash/empty', {method:'POST'});
  loadTrash();
  var el = document.getElementById('status');
  el.className = 'status-msg success'; el.textContent = 'Trash emptied.';
  setTimeout(function(){ el.className = 'status-msg'; }, 3000);
}

// Automations
async function loadAutomations() {
  var autos = await fetch('/api/automations').then(r=>r.json());
  var el = document.getElementById('automations-list');
  if (!autos.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">No automation rules configured.</div>'; return; }
  el.innerHTML = autos.map(a => {
    var condText = '';
    if (a.conditions) {
      var keys = Object.keys(a.conditions).filter(k=>a.conditions[k]);
      condText = keys.length ? ' when ' + keys.map(k=>k+'='+a.conditions[k]).join(' & ') : '';
    }
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);font-size:13px;">'
      +'<div style="flex:1;"><div style="font-weight:400;">'+esc(a.name)+'</div>'
      +'<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">'+a.trigger_type+condText+' &rarr; '+a.action_type+'</div></div>'
      +'<div style="display:flex;gap:6px;align-items:center;">'
      +'<button onclick="toggleAutomation('+a.id+','+!a.enabled+')" style="background:'+(a.enabled?'var(--green-bg)':'var(--surface-2)')+';color:'+(a.enabled?'var(--green)':'var(--text-muted)')+';border:1px solid '+(a.enabled?'var(--green)':'var(--border)')+';padding:3px 10px;border-radius:6px;cursor:pointer;font-size:10px;font-family:inherit;">'+(a.enabled?'On':'Off')+'</button>'
      +'<button onclick="editAutomation('+a.id+')" style="background:none;border:1px solid var(--border);color:var(--text-muted);padding:3px 10px;border-radius:6px;cursor:pointer;font-size:10px;font-family:inherit;">Edit</button>'
      +'</div></div>';
  }).join('');
}
function openAutoModal() {
  document.getElementById('auto-modal-title').textContent = 'New Automation';
  document.getElementById('auto-id').value = '';
  document.getElementById('auto-name').value = '';
  document.getElementById('auto-trigger').value = 'todo_created';
  document.getElementById('auto-cond-field').value = '';
  document.getElementById('auto-cond-value').value = '';
  document.getElementById('auto-action').value = 'set_priority';
  document.getElementById('auto-action-value').value = '';
  document.getElementById('auto-delete-btn').style.display = 'none';
  document.getElementById('auto-modal').classList.add('active');
}
function closeAutoModal() { document.getElementById('auto-modal').classList.remove('active'); }
async function editAutomation(id) {
  var autos = await fetch('/api/automations').then(r=>r.json());
  var a = autos.find(x=>x.id===id); if (!a) return;
  document.getElementById('auto-modal-title').textContent = 'Edit Automation';
  document.getElementById('auto-id').value = id;
  document.getElementById('auto-name').value = a.name;
  document.getElementById('auto-trigger').value = a.trigger_type;
  var condKeys = Object.keys(a.conditions||{}).filter(k=>a.conditions[k]);
  document.getElementById('auto-cond-field').value = condKeys[0] || '';
  document.getElementById('auto-cond-value').value = condKeys.length ? a.conditions[condKeys[0]] : '';
  document.getElementById('auto-action').value = a.action_type;
  var actData = a.action_data||{};
  document.getElementById('auto-action-value').value = actData[Object.keys(actData)[0]] || '';
  document.getElementById('auto-delete-btn').style.display = 'inline-block';
  document.getElementById('auto-modal').classList.add('active');
}
async function saveAutomation() {
  var id = document.getElementById('auto-id').value;
  var condField = document.getElementById('auto-cond-field').value;
  var condValue = document.getElementById('auto-cond-value').value;
  var actionType = document.getElementById('auto-action').value;
  var actionValue = document.getElementById('auto-action-value').value;
  var conditions = {};
  if (condField && condValue) conditions[condField] = condValue;
  var actionKey = actionType === 'set_priority' ? 'priority' : actionType === 'set_category' ? 'category' : actionType === 'set_horizon' ? 'horizon' : actionType === 'add_tag' ? 'tag' : 'title';
  var action_data = {}; action_data[actionKey] = actionValue;
  var data = {
    name: document.getElementById('auto-name').value,
    trigger_type: document.getElementById('auto-trigger').value,
    conditions: conditions,
    action_type: actionType,
    action_data: action_data,
  };
  if (!data.name) return alert('Name is required');
  if (id) await fetch('/api/automations/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  else await fetch('/api/automations', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  closeAutoModal(); loadAutomations();
}
async function deleteAutomation() {
  var id = document.getElementById('auto-id').value;
  await fetch('/api/automations/'+id, {method:'DELETE'});
  closeAutoModal(); loadAutomations();
}
async function toggleAutomation(id, enabled) {
  await fetch('/api/automations/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled})});
  loadAutomations();
}
function updateActionFields() {}

// Webhooks
async function loadWebhooks() {
  var whs = await fetch('/api/webhooks').then(r=>r.json());
  var el = document.getElementById('webhooks-list');
  if (!whs.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">No webhooks configured.</div>'; return; }
  el.innerHTML = whs.map(w =>
    '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);font-size:13px;">'
    +'<div style="flex:1;"><div style="font-weight:400;">'+esc(w.name)+'</div>'
    +'<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">'+esc(w.url.substring(0,50))+(w.url.length>50?'...':'')+'</div>'
    +'<div style="font-size:9px;color:var(--text-muted);margin-top:2px;">Events: '+(w.events||[]).join(', ')+(w.last_status?' &middot; Last: '+w.last_status:'')+'</div></div>'
    +'<div style="display:flex;gap:6px;align-items:center;">'
    +'<button onclick="testWebhook('+w.id+')" style="background:none;border:1px solid var(--teal);color:var(--teal);padding:3px 10px;border-radius:6px;cursor:pointer;font-size:10px;font-family:inherit;">Test</button>'
    +'<button onclick="toggleWebhook('+w.id+','+!w.enabled+')" style="background:'+(w.enabled?'var(--green-bg)':'var(--surface-2)')+';color:'+(w.enabled?'var(--green)':'var(--text-muted)')+';border:1px solid '+(w.enabled?'var(--green)':'var(--border)')+';padding:3px 10px;border-radius:6px;cursor:pointer;font-size:10px;font-family:inherit;">'+(w.enabled?'On':'Off')+'</button>'
    +'<button onclick="editWebhook('+w.id+')" style="background:none;border:1px solid var(--border);color:var(--text-muted);padding:3px 10px;border-radius:6px;cursor:pointer;font-size:10px;font-family:inherit;">Edit</button>'
    +'</div></div>'
  ).join('');
}
function openWebhookModal() {
  document.getElementById('wh-modal-title').textContent='New Webhook';
  document.getElementById('wh-id').value='';
  document.getElementById('wh-name').value='';
  document.getElementById('wh-url').value='';
  document.querySelectorAll('#wh-events input').forEach(cb=>cb.checked=false);
  document.getElementById('wh-delete-btn').style.display='none';
  document.getElementById('webhook-modal').classList.add('active');
}
function closeWebhookModal() { document.getElementById('webhook-modal').classList.remove('active'); }
async function editWebhook(id) {
  var whs = await fetch('/api/webhooks').then(r=>r.json());
  var w = whs.find(x=>x.id===id); if (!w) return;
  document.getElementById('wh-modal-title').textContent='Edit Webhook';
  document.getElementById('wh-id').value=id;
  document.getElementById('wh-name').value=w.name;
  document.getElementById('wh-url').value=w.url;
  document.querySelectorAll('#wh-events input').forEach(cb=>{cb.checked=(w.events||[]).includes(cb.value);});
  document.getElementById('wh-delete-btn').style.display='inline-block';
  document.getElementById('webhook-modal').classList.add('active');
}
async function saveWebhook() {
  var events=[];document.querySelectorAll('#wh-events input:checked').forEach(cb=>events.push(cb.value));
  var data={name:document.getElementById('wh-name').value,url:document.getElementById('wh-url').value,events:events};
  if(!data.name||!data.url)return alert('Name and URL required');
  var id=document.getElementById('wh-id').value;
  if(id) await fetch('/api/webhooks/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  else await fetch('/api/webhooks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  closeWebhookModal();loadWebhooks();
}
async function deleteWebhook() {
  var id=document.getElementById('wh-id').value;
  await fetch('/api/webhooks/'+id,{method:'DELETE'});
  closeWebhookModal();loadWebhooks();
}
async function toggleWebhook(id,enabled) {
  await fetch('/api/webhooks/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled})});
  loadWebhooks();
}
async function testWebhook(id) {
  var r=await fetch('/api/webhooks/'+id+'/test',{method:'POST'}).then(r=>r.json());
  alert(r.ok?'Webhook test successful (status: '+r.status+')':'Webhook test failed'+(r.status?' (status: '+r.status+')':''));
  loadWebhooks();
}

// Slack
async function saveSlack() {
  var url=document.getElementById('s-slack').value||null;
  await fetch('/api/settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({slack_webhook_url:url})});
  var el=document.getElementById('status');el.className='status-msg success';el.textContent='Slack webhook saved.';
  setTimeout(function(){el.className='status-msg';},3000);
}

async function logout() {
  await fetch('/api/logout', {method:'POST'});
  location.href = '/login';
}

load();
loadAutomations();
loadWebhooks();
</script>
</body></html>`);
  };
};

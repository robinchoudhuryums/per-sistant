const { pageHead, navBar, themeScript } = require("../views");

module.exports = function() {
  return (req, res) => {
    res.send(`${pageHead("Dashboard")}
<body>
${themeScript()}
<div class="container">
  ${navBar("/")}
  <div style="display:flex;align-items:center;justify-content:space-between;">
    <div><h1>Dashboard</h1><p class="subtitle" style="margin-bottom:0;">Your personal command center</p></div>
    <button id="customize-btn" style="padding:6px 14px;font-size:10px;font-weight:500;letter-spacing:0.5px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:transparent;color:var(--text-muted);font-family:inherit;text-transform:uppercase;">Customize</button>
  </div>
  <div style="margin-bottom:36px;"></div>

  <!-- Customization panel -->
  <div id="customize-panel" style="display:none;margin-bottom:24px;padding:16px;border-radius:var(--radius);background:var(--surface);border:1px solid var(--warm);">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <span style="font-size:10px;font-weight:500;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.5px;">Widget Visibility &amp; Order</span>
      <button id="reset-layout-btn" style="padding:4px 10px;font-size:10px;font-weight:500;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:transparent;color:var(--text-muted);font-family:inherit;">Reset</button>
    </div>
    <div id="widget-toggles" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
    <div style="margin-top:10px;font-size:10px;color:var(--text-muted);">Drag widgets below to reorder. Click toggles above to show/hide.</div>
  </div>

  <div id="dash-widgets">
    <!-- Search widget -->
    <div class="dash-widget" data-widget="search" draggable="true">
      <div class="search-bar">
        <span class="search-icon">&#128269;</span>
        <input type="text" id="global-search" placeholder="Search todos, emails, notes, contacts... (press /)">
      </div>
      <div class="section search-results" id="search-results" style="display:none;margin-bottom:24px;"></div>
    </div>

    <!-- Productivity Tree widget -->
    <div class="dash-widget" data-widget="tree" draggable="true">
      <div class="section tree-widget" id="tree-section">
        <div class="tree-container">
          <div class="tree-glow" id="tree-glow"></div>
          <div class="tree-particle"></div>
          <div class="tree-particle"></div>
          <div class="tree-particle"></div>
          <svg class="tree-svg" id="tree-svg" viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg">
            <!-- Isometric base platform -->
            <defs>
              <linearGradient id="platform-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:rgba(107,159,159,0.3)"/>
                <stop offset="100%" style="stop-color:rgba(160,140,212,0.2)"/>
              </linearGradient>
              <linearGradient id="trunk-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#8b6b4a"/>
                <stop offset="100%" style="stop-color:#5c4632"/>
              </linearGradient>
              <radialGradient id="leaf-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" style="stop-color:rgba(111,207,151,0.6)"/>
                <stop offset="100%" style="stop-color:rgba(111,207,151,0)"/>
              </radialGradient>
              <filter id="glow-filter">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <!-- Platform (isometric diamond) -->
            <polygon points="140,240 60,210 140,180 220,210" fill="url(#platform-grad)" stroke="rgba(107,159,159,0.4)" stroke-width="1"/>
            <polygon points="140,240 60,210 60,218 140,248" fill="rgba(107,159,159,0.15)" stroke="none"/>
            <polygon points="140,240 220,210 220,218 140,248" fill="rgba(160,140,212,0.12)" stroke="none"/>
            <!-- Trunk -->
            <rect x="133" y="150" width="14" height="60" rx="3" fill="url(#trunk-grad)"/>
            <rect x="136" y="155" width="3" height="50" rx="1" fill="rgba(255,255,255,0.08)"/>
            <!-- Branch left -->
            <line x1="140" y1="170" x2="118" y2="155" stroke="#6b4d35" stroke-width="3" stroke-linecap="round"/>
            <!-- Branch right -->
            <line x1="140" y1="165" x2="165" y2="148" stroke="#6b4d35" stroke-width="3" stroke-linecap="round"/>
            <!-- Leaf cluster group (populated by JS based on productivity) -->
            <g id="tree-leaves" filter="url(#glow-filter)"></g>
            <!-- Streak fire effect at top (shown when streak > 0) -->
            <g id="tree-streak" style="display:none">
              <circle cx="140" cy="68" r="10" fill="rgba(232,200,109,0.3)">
                <animate attributeName="r" values="8;12;8" dur="2s" repeatCount="indefinite"/>
              </circle>
              <text x="140" y="72" text-anchor="middle" font-size="14" fill="#e8c86d">&#x1F525;</text>
            </g>
          </svg>
        </div>
        <div class="tree-stats">
          <div><span class="tree-stat-value glow-green" id="tree-done">-</span>Done Today</div>
          <div><span class="tree-stat-value glow-warm" id="tree-streak-val">-</span>Streak</div>
          <div><span class="tree-stat-value glow-teal" id="tree-score">-</span>Score</div>
        </div>
        <div class="tree-status-msg" id="tree-msg">Loading your tree...</div>
      </div>
    </div>

    <!-- Cards widget -->
    <div class="dash-widget" data-widget="cards" draggable="true">
      <div class="top-cards" id="cards"></div>
    </div>

    <!-- AI Daily Briefing widget -->
    <div class="dash-widget" data-widget="briefing" draggable="true">
      <div id="briefing-section" style="display:none;margin-bottom:24px;">
        <div class="section">
          <h2>Today's Briefing</h2>
          <div id="briefing-content" style="font-size:14px;font-weight:300;line-height:1.7;"></div>
        </div>
      </div>
    </div>

    <!-- AI Smart Suggestions widget -->
    <div class="dash-widget" data-widget="suggestions" draggable="true">
      <div id="suggestions-section" style="display:none;margin-bottom:24px;">
        <div class="section">
          <h2>Smart Suggestions</h2>
          <div id="suggestions-content"></div>
        </div>
      </div>
    </div>

    <!-- AI Natural Language Query widget -->
    <div class="dash-widget" data-widget="ai_query" draggable="true">
      <div class="section" style="margin-bottom:24px;">
        <h2>Ask Your Assistant</h2>
        <div style="display:flex;gap:8px;">
          <input type="text" id="ai-query-input" placeholder="Ask anything... &quot;What did I do last week?&quot; &quot;How many tasks are overdue?&quot;" style="flex:1;padding:10px 14px;font-size:13px;font-family:inherit;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);outline:none;">
          <button id="ask-ai-btn" style="padding:10px 18px;font-size:12px;font-weight:500;letter-spacing:0.5px;border:1px solid var(--teal);border-radius:8px;cursor:pointer;background:transparent;color:var(--teal);font-family:inherit;text-transform:uppercase;">Ask</button>
        </div>
        <div id="ai-query-answer" style="display:none;margin-top:12px;padding:12px 16px;background:var(--surface-2);border-radius:8px;font-size:13px;font-weight:300;line-height:1.6;white-space:pre-wrap;"></div>
      </div>
    </div>

    <!-- Task Overview widget -->
    <div class="dash-widget" data-widget="tasks" draggable="true">
      <div class="section" style="margin-bottom:24px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <h2 style="margin-bottom:0;">Task Overview</h2>
        </div>
        <div class="filters" id="dash-task-filters">
          <button class="active" data-view="all">All</button>
          <button data-view="category">By Category</button>
          <button data-view="urgency">By Urgency</button>
          <button data-view="due">Due Soon</button>
        </div>
        <div id="dash-tasks"></div>
      </div>
    </div>

    <!-- Upcoming + Emails widget -->
    <div class="dash-widget" data-widget="upcoming_emails" draggable="true">
      <div class="dash-two-col" style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <div class="section">
          <h2>Upcoming Tasks</h2>
          <div id="upcoming-tasks"></div>
        </div>
        <div class="section">
          <h2>Scheduled Emails</h2>
          <div id="scheduled-emails"></div>
        </div>
      </div>
    </div>

    <!-- Perfin widget -->
    <div class="dash-widget" data-widget="perfin" draggable="true">
      <div id="perfin-section" style="display:none;margin-top:24px;">
        <div class="section">
          <h2>Perfin — Financial Overview</h2>
          <div id="perfin-data"></div>
        </div>
      </div>
    </div>

    <!-- Shortcuts widget -->
    <div class="dash-widget" data-widget="shortcuts" draggable="true">
      <div style="margin-top:24px;text-align:center;">
        <p style="font-size:11px;color:var(--text-muted);">Keyboard shortcuts: <span class="kbd">/</span> Search &middot; <span class="kbd">N</span> New task &middot; <span class="kbd">E</span> New email &middot; <span class="kbd">?</span> Show all</p>
      </div>
    </div>
  </div>
</div>
<script>
var searchTimeout = null;
function doSearch(q) {
  clearTimeout(searchTimeout);
  if (!q || q.length < 2) { document.getElementById('search-results').style.display='none'; return; }
  searchTimeout = setTimeout(async function() {
    var results = await fetch('/api/search?q='+encodeURIComponent(q)).then(r=>r.json());
    if (!results.length) { document.getElementById('search-results').innerHTML='<div class="empty-msg">No results</div>'; }
    else {
      document.getElementById('search-results').innerHTML = results.map(r => {
        var href = r.type==='todo'?'/todos':r.type==='email'?'/emails':r.type==='note'?'/notes':'/contacts';
        var actions = '';
        if (r.type === 'todo' && !r.completed) {
          actions = '<div style="display:flex;gap:6px;margin-top:6px;"><button data-action="search-complete" data-id="'+r.id+'" data-recurring="'+!!r.recurring+'" style="background:var(--green-bg);color:var(--green);border:1px solid var(--green);padding:2px 10px;border-radius:6px;cursor:pointer;font-size:10px;font-family:inherit;">Complete</button></div>';
        } else if (r.type === 'email' && r.status === 'scheduled') {
          actions = '<div style="display:flex;gap:6px;margin-top:6px;"><button data-action="search-send" data-id="'+r.id+'" style="background:var(--blue-bg);color:var(--blue);border:1px solid var(--blue);padding:2px 10px;border-radius:6px;cursor:pointer;font-size:10px;font-family:inherit;">Send Now</button></div>';
        } else if (r.type === 'note') {
          actions = '<div style="display:flex;gap:6px;margin-top:6px;"><button data-action="search-pin" data-id="'+r.id+'" data-pinned="'+!!r.pinned+'" style="background:var(--yellow-bg);color:var(--yellow);border:1px solid var(--yellow);padding:2px 10px;border-radius:6px;cursor:pointer;font-size:10px;font-family:inherit;">'+(r.pinned?'Unpin':'Pin')+'</button></div>';
        }
        return '<a href="'+href+'" class="result-item" style="display:block;text-decoration:none;color:inherit;"><div class="result-type">'+r.type+(r.type==='todo'&&r.completed?' (done)':'')+'</div><div style="font-size:14px;">'+esc(r.title||'')+'</div>'+(r.description?'<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">'+esc(r.description)+'</div>':'')+actions+'</a>';
      }).join('');
    }
    document.getElementById('search-results').style.display='block';
  }, 300);
}

var dashView = 'all';
var allTodos = [];
function setDashView(btn, v) { dashView = v; document.querySelectorAll('#dash-task-filters button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderDashTasks(); }

function renderDashTasks() {
  var container = document.getElementById('dash-tasks');
  if (!allTodos.length) { container.innerHTML = '<div class="empty-msg">No pending tasks</div>'; return; }
  var html = '';
  if (dashView === 'category') {
    var cats = {};
    allTodos.forEach(t => { var c = t.category || 'Uncategorized'; if (!cats[c]) cats[c] = []; cats[c].push(t); });
    Object.keys(cats).sort().forEach(c => {
      html += '<div style="margin-bottom:16px;"><div style="font-size:10px;font-weight:500;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border);">'+esc(c)+' ('+cats[c].length+')</div>';
      cats[c].slice(0,5).forEach(t => { html += renderDashTodo(t); });
      if (cats[c].length > 5) html += '<div style="font-size:11px;color:var(--text-muted);padding:4px 0;">+'+(cats[c].length-5)+' more</div>';
      html += '</div>';
    });
  } else if (dashView === 'urgency') {
    ['urgent','high','medium','low'].forEach(p => {
      var items = allTodos.filter(t=>t.priority===p);
      if (!items.length) return;
      html += '<div style="margin-bottom:16px;"><div style="font-size:10px;font-weight:500;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border);">'+p+' ('+items.length+')</div>';
      items.slice(0,5).forEach(t => { html += renderDashTodo(t); });
      if (items.length > 5) html += '<div style="font-size:11px;color:var(--text-muted);padding:4px 0;">+'+(items.length-5)+' more</div>';
      html += '</div>';
    });
  } else if (dashView === 'due') {
    var withDue = allTodos.filter(t=>t.due_date).sort((a,b)=>new Date(a.due_date)-new Date(b.due_date));
    if (!withDue.length) { container.innerHTML = '<div class="empty-msg">No tasks with due dates</div>'; return; }
    withDue.slice(0,10).forEach(t => { html += renderDashTodo(t); });
  } else {
    allTodos.slice(0,10).forEach(t => { html += renderDashTodo(t); });
    if (allTodos.length > 10) html += '<div style="font-size:11px;color:var(--text-muted);padding:8px 0;text-align:center;"><a href="/todos">View all '+allTodos.length+' tasks &rarr;</a></div>';
  }
  container.innerHTML = html;
}

function renderDashTodo(t) {
  var overdue = t.due_date && new Date(t.due_date) <= new Date() ? ' style="color:var(--red)"' : '';
  var completeBtn = t.recurring
    ? '<button data-action="dash-complete-recurring" data-id="'+t.id+'" title="Complete & create next" style="background:none;border:1px solid var(--green);color:var(--green);width:22px;height:22px;border-radius:6px;cursor:pointer;font-size:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">&#10003;</button>'
    : '<button data-action="dash-complete" data-id="'+t.id+'" title="Mark complete" style="background:none;border:1px solid var(--green);color:var(--green);width:22px;height:22px;border-radius:6px;cursor:pointer;font-size:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">&#10003;</button>';
  var streakBadge = t.recurring && t.streak_count > 0 ? '<span class="badge streak">&#x1F525; '+t.streak_count+'</span>' : '';
  return '<div class="todo-item" style="display:flex;align-items:center;gap:10px;">'+completeBtn+'<div class="todo-content" style="flex:1;"><div class="todo-title">'+esc(t.title)+'</div><div class="todo-meta"><span class="badge '+t.priority+'">'+t.priority+'</span>'+(t.category?'<span>'+esc(t.category)+'</span>':'')+(t.due_date?'<span'+overdue+'>Due: '+new Date(t.due_date).toLocaleDateString()+'</span>':'')+(t.recurring?'<span class="badge recurring">recurring</span>':'')+streakBadge+'</div></div></div>';
}

async function dashComplete(id) {
  await fetch('/api/todos/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({completed:true})});
  allTodos = allTodos.filter(t=>t.id!==id);
  renderDashTasks();
  showUndo('Task completed','todo',id,'complete');
}

async function dashCompleteRecurring(id) {
  await fetch('/api/todos/'+id+'/complete-recurring', {method:'POST'});
  allTodos = await fetch('/api/todos?completed=false&limit=50').then(r=>r.json());
  renderDashTasks();
}

async function dashSendEmail(id) {
  var r = await fetch('/api/emails/'+id+'/send', {method:'POST'}).then(r=>r.json());
  if (r.ok) { showUndo('Email sent','email',id,'send'); load(); } else { alert('Failed: '+(r.error||'Unknown error')); }
}

// Search quick actions
async function searchComplete(id, isRecurring) {
  if (isRecurring) await fetch('/api/todos/'+id+'/complete-recurring', {method:'POST'});
  else await fetch('/api/todos/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({completed:true})});
  showUndo('Task completed','todo',id,'complete');
  document.getElementById('search-results').style.display='none';
  document.getElementById('global-search').value='';
  load();
}
async function searchSendEmail(id) {
  var r = await fetch('/api/emails/'+id+'/send', {method:'POST'}).then(r=>r.json());
  if (r.ok) { showUndo('Email sent','email',id,'send'); }
  document.getElementById('search-results').style.display='none';
  document.getElementById('global-search').value='';
  load();
}
async function searchTogglePin(id, pinned) {
  await fetch('/api/notes/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({pinned:pinned})});
  document.getElementById('search-results').style.display='none';
  document.getElementById('global-search').value='';
  load();
}

async function load() {
  const stats = await fetch('/api/stats').then(r=>r.json());
  document.getElementById('cards').innerHTML = [
    {label:'Pending Tasks',value:stats.todos.pending,cls:'warm'},
    {label:'Urgent',value:stats.todos.urgent,cls:'red'},
    {label:'Overdue',value:stats.todos.overdue,cls:stats.todos.overdue > 0 ? 'red' : 'green'},
    {label:'Completed',value:stats.todos.done,cls:'green'},
    {label:'Email Drafts',value:stats.emails.drafts,cls:'blue'},
    {label:'Scheduled',value:stats.emails.scheduled,cls:'yellow'},
    {label:'Emails Sent',value:stats.emails.sent,cls:'teal'},
    {label:'Notes',value:stats.notes.total,cls:'warm'},
  ].map(c => '<div class="card"><div class="label">'+c.label+'</div><div class="value '+c.cls+'">'+c.value+'</div></div>').join('');

  // Update productivity tree
  var streakData = [];
  try { streakData = await fetch('/api/streaks').then(r=>r.json()); } catch {}
  updateTree(stats, streakData);

  allTodos = await fetch('/api/todos?completed=false&limit=50').then(r=>r.json());
  renderDashTasks();

  const upcoming = allTodos.filter(t=>t.due_date).sort((a,b)=>new Date(a.due_date)-new Date(b.due_date)).slice(0,5);
  document.getElementById('upcoming-tasks').innerHTML = upcoming.length
    ? upcoming.map(t => '<div class="todo-item"><div class="todo-content"><div class="todo-title">'+esc(t.title)+'</div><div class="todo-meta"><span class="badge '+t.priority+'">'+t.priority+'</span>'+(t.recurring?'<span class="badge recurring">recurring</span>':'')+'<span>Due: '+new Date(t.due_date).toLocaleDateString()+'</span></div></div></div>').join('')
    : '<div class="empty-msg">No upcoming tasks with due dates</div>';

  const emails = await fetch('/api/emails?status=scheduled').then(r=>r.json());
  document.getElementById('scheduled-emails').innerHTML = emails.length
    ? emails.slice(0,5).map(e => '<div class="todo-item" style="display:flex;align-items:center;gap:10px;"><button data-action="dash-send-email" data-id="'+e.id+'" title="Send now" style="background:none;border:1px solid var(--blue);color:var(--blue);padding:2px 8px;border-radius:6px;cursor:pointer;font-size:11px;flex-shrink:0;font-family:inherit;">Send</button><div class="todo-content" style="flex:1;"><div class="todo-title">'+esc(e.subject)+'</div><div class="todo-meta"><span>To: '+esc(e.recipient_name||e.recipient_email)+'</span><span>'+new Date(e.scheduled_at).toLocaleString()+'</span></div></div></div>').join('')
    : '<div class="empty-msg">No scheduled emails</div>';

  // Load Perfin data
  try {
    var perfin = await fetch('/api/perfin/stats').then(r=>r.json());
    if (perfin.connected) {
      document.getElementById('perfin-section').style.display='block';
      var html = '<div class="top-cards" style="margin-bottom:0">';
      html += '<div class="card"><div class="label">Active Subscriptions</div><div class="value teal">'+perfin.total_subscriptions+'</div></div>';
      html += '<div class="card"><div class="label">Monthly Cost</div><div class="value warm">$'+perfin.monthly_cost+'</div></div>';
      html += '<div class="card"><div class="label">Renewing This Week</div><div class="value '+(perfin.upcoming_this_week>0?'yellow':'green')+'">'+perfin.upcoming_this_week+'</div></div>';
      html += '</div>';
      if (perfin.upcoming && perfin.upcoming.length) {
        html += '<div style="margin-top:16px;">';
        perfin.upcoming.forEach(s => {
          html += '<div class="todo-item"><div class="todo-content"><div class="todo-title">'+esc(s.display_name||s.merchant_key)+'</div><div class="todo-meta"><span>$'+parseFloat(s.amount).toFixed(2)+'</span><span>Due: '+new Date(s.next_expected).toLocaleDateString()+'</span></div></div></div>';
        });
        html += '</div>';
      }
      document.getElementById('perfin-data').innerHTML = html;
    }
  } catch {}

  // Check notifications and show browser alerts
  fetch('/api/notifications/check').then(r=>r.json()).then(d => {
    if (d.notifications && d.notifications.length && 'Notification' in window && Notification.permission === 'granted') {
      var important = d.notifications.filter(n => n.type === 'overdue' || n.type === 'streak_at_risk');
      important.slice(0,3).forEach(n => {
        new Notification('Per-sistant', { body: (n.type==='overdue'?'Overdue: ':'Streak at risk: ')+n.title, icon: '/icon-192.svg' });
      });
    }
  }).catch(function(){});

  // Load AI daily briefing (non-blocking)
  fetch('/api/ai/daily-briefing').then(r=>r.json()).then(d => {
    if (d.briefing) {
      document.getElementById('briefing-content').textContent = d.briefing;
      document.getElementById('briefing-section').style.display = 'block';
    }
  }).catch(function(){});

  // Load AI smart suggestions (non-blocking)
  fetch('/api/ai/smart-suggestions').then(r=>r.json()).then(d => {
    if (d.suggestions && d.suggestions.length) {
      document.getElementById('suggestions-content').innerHTML = d.suggestions.map(s =>
        '<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;font-weight:300;line-height:1.5;">'+
        '<span style="color:var(--teal);margin-right:8px;">&#9733;</span>'+esc(s.suggestion)+'</div>'
      ).join('');
      document.getElementById('suggestions-section').style.display = 'block';
    }
  }).catch(function(){});
}

async function askAI() {
  var input = document.getElementById('ai-query-input');
  var q = input.value.trim();
  if (!q) return;
  var answerEl = document.getElementById('ai-query-answer');
  answerEl.textContent = 'Thinking...';
  answerEl.style.display = 'block';
  try {
    var r = await fetch('/api/ai/query', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q})}).then(r=>r.json());
    answerEl.textContent = r.answer || 'No answer available.';
  } catch (err) { answerEl.textContent = 'Error: '+err.message; }
}

// Dashboard widget customization
var widgetNames = {search:'Search',tree:'Productivity Tree',cards:'Stats Cards',briefing:'AI Briefing',suggestions:'Smart Suggestions',ai_query:'Ask AI',tasks:'Task Overview',upcoming_emails:'Upcoming & Emails',perfin:'Perfin',shortcuts:'Shortcuts'};
var dashLayout = {widgets:['search','tree','cards','briefing','suggestions','ai_query','tasks','upcoming_emails','perfin','shortcuts'],hidden:[]};
var wdragSrcWidget = null;

async function loadLayout() {
  try {
    var settings = await fetch('/api/settings').then(r=>r.json());
    if (settings.dashboard_layout) dashLayout = settings.dashboard_layout;
  } catch {}
  applyLayout();
}

function applyLayout() {
  var container = document.getElementById('dash-widgets');
  var widgets = container.querySelectorAll('.dash-widget');
  var map = {};
  widgets.forEach(w => { map[w.dataset.widget] = w; });
  // Reorder
  dashLayout.widgets.forEach(id => { if (map[id]) container.appendChild(map[id]); });
  // Show/hide
  widgets.forEach(w => {
    w.style.display = dashLayout.hidden.includes(w.dataset.widget) ? 'none' : 'block';
  });
  renderToggles();
}

function renderToggles() {
  var html = '';
  dashLayout.widgets.forEach(id => {
    var hidden = dashLayout.hidden.includes(id);
    html += '<button data-toggle-widget="'+id+'" style="padding:4px 12px;font-size:10px;font-weight:500;border-radius:20px;cursor:pointer;font-family:inherit;border:1px solid '+(hidden?'var(--border)':'var(--warm)')+';background:'+(hidden?'transparent':'rgba(212,165,116,0.1)')+';color:'+(hidden?'var(--text-muted)':'var(--warm)')+';">'+(widgetNames[id]||id)+'</button>';
  });
  document.getElementById('widget-toggles').innerHTML = html;
}

function toggleWidget(id) {
  var idx = dashLayout.hidden.indexOf(id);
  if (idx > -1) dashLayout.hidden.splice(idx, 1);
  else dashLayout.hidden.push(id);
  applyLayout();
  saveLayout();
}

function toggleCustomize() {
  var panel = document.getElementById('customize-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  document.getElementById('customize-btn').textContent = panel.style.display === 'none' ? 'Customize' : 'Done';
}

function resetLayout() {
  dashLayout = {widgets:['search','cards','briefing','tasks','upcoming_emails','perfin','shortcuts'],hidden:[]};
  applyLayout();
  saveLayout();
}

async function saveLayout() {
  await fetch('/api/settings', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({dashboard_layout:dashLayout})});
}

function wdragStart(e,w) { wdragSrcWidget = (w||e.target.closest('.dash-widget')).dataset.widget; (w||e.target.closest('.dash-widget')).style.opacity = '0.4'; }
function wdragOver(e) { e.preventDefault(); var w=e.target.closest('.dash-widget'); if(w) w.style.borderTop = '2px solid var(--warm)'; }
function wdragEnd(e) { document.querySelectorAll('.dash-widget').forEach(w => { w.style.opacity = '1'; w.style.borderTop = ''; }); }
function wdrop(e) {
  e.preventDefault(); var el=e.target.closest('.dash-widget'); if(el) el.style.borderTop = '';
  var target = (el||e.currentTarget).dataset.widget;
  if (wdragSrcWidget === target) return;
  var srcIdx = dashLayout.widgets.indexOf(wdragSrcWidget);
  var tgtIdx = dashLayout.widgets.indexOf(target);
  if (srcIdx > -1 && tgtIdx > -1) {
    dashLayout.widgets.splice(srcIdx, 1);
    dashLayout.widgets.splice(tgtIdx, 0, wdragSrcWidget);
    applyLayout();
    saveLayout();
  }
}

// Productivity Tree rendering
function updateTree(stats, streakData) {
  var leavesEl = document.getElementById('tree-leaves');
  if (!leavesEl) return;

  // Calculate tree health: 0-100
  var done = stats.todos.done || 0;
  var pending = stats.todos.pending || 0;
  var overdue = stats.todos.overdue || 0;
  var total = done + pending;
  var completionRate = total > 0 ? Math.round((done / total) * 100) : 50;
  var overdueRate = total > 0 ? Math.round((overdue / total) * 100) : 0;
  var health = Math.max(0, Math.min(100, completionRate - overdueRate));

  // Get best streak from streak data
  var bestStreak = 0;
  var currentStreak = 0;
  if (streakData && streakData.length) {
    streakData.forEach(function(s) {
      if (s.streak_count > currentStreak) currentStreak = s.streak_count;
      if (s.best_streak > bestStreak) bestStreak = s.best_streak;
    });
  }

  // Determine leaf count and color based on health (5-25 leaves)
  var leafCount = Math.max(5, Math.round(health / 4));
  var baseHue = health > 60 ? 145 : health > 30 ? 80 : 20; // green -> yellow -> brown
  var baseSat = health > 50 ? '60%' : '40%';
  var baseLight = health > 50 ? '55%' : '40%';

  // Generate leaves in a natural canopy shape
  var leaves = '';
  var leafPositions = [];
  for (var i = 0; i < leafCount; i++) {
    var angle = (i / leafCount) * Math.PI * 2 + (Math.random() * 0.5);
    var layer = Math.floor(i / 8); // 0, 1, 2 rings
    var radius = 25 + layer * 20 + Math.random() * 15;
    var cx = 140 + Math.cos(angle) * radius * 0.9;
    var cy = 110 + Math.sin(angle) * radius * 0.5 - layer * 15;
    var r = 12 + Math.random() * 8;
    var hue = baseHue + Math.random() * 20 - 10;
    var opacity = 0.5 + (health / 100) * 0.5;
    leaves += '<ellipse class="tree-leaf" cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" rx="'+r.toFixed(1)+'" ry="'+(r*0.7).toFixed(1)+'" fill="hsla('+Math.round(hue)+','+baseSat+','+baseLight+','+opacity.toFixed(2)+')" style="animation-delay:'+(Math.random()*-3).toFixed(1)+'s"/>';
  }

  // Top canopy highlight
  leaves += '<ellipse cx="140" cy="95" rx="30" ry="20" fill="url(#leaf-glow)" opacity="'+(health/150).toFixed(2)+'"/>';

  leavesEl.innerHTML = leaves;

  // Show streak fire
  var streakEl = document.getElementById('tree-streak');
  if (streakEl) streakEl.style.display = currentStreak > 0 ? 'block' : 'none';

  // Update glow color based on health
  var glowEl = document.getElementById('tree-glow');
  if (glowEl) {
    if (health > 70) glowEl.style.background = 'radial-gradient(ellipse, rgba(111,207,151,0.35) 0%, rgba(107,159,159,0.2) 40%, transparent 70%)';
    else if (health > 40) glowEl.style.background = 'radial-gradient(ellipse, rgba(232,200,109,0.25) 0%, rgba(107,159,159,0.12) 40%, transparent 70%)';
    else glowEl.style.background = 'radial-gradient(ellipse, rgba(235,107,107,0.2) 0%, rgba(160,140,212,0.1) 40%, transparent 70%)';
  }

  // Update stat displays
  document.getElementById('tree-done').textContent = done;
  document.getElementById('tree-streak-val').textContent = currentStreak;
  document.getElementById('tree-score').textContent = health;

  // Status message
  var msg = '';
  if (health >= 80) msg = 'Your tree is thriving! Keep up the amazing work.';
  else if (health >= 60) msg = 'Looking good! A few more tasks and your tree will flourish.';
  else if (health >= 40) msg = 'Your tree needs attention. Tackle some pending tasks!';
  else if (health >= 20) msg = 'Your tree is wilting. Time to catch up on overdue items.';
  else msg = 'Your tree is struggling. Start small — complete one task to begin recovery.';
  document.getElementById('tree-msg').textContent = msg;
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.key === '/') { e.preventDefault(); document.getElementById('global-search').focus(); }
  else if (e.key === 'n' || e.key === 'N') { location.href = '/todos'; }
  else if (e.key === 'e' || e.key === 'E') { location.href = '/emails'; }
  else if (e.key === 'c' || e.key === 'C') { location.href = '/calendar'; }
  else if (e.key === 'r' || e.key === 'R') { location.href = '/review'; }
});

// Bind static events
bindEvents([
  ['customize-btn','click',toggleCustomize],
  ['reset-layout-btn','click',resetLayout],
  ['ask-ai-btn','click',askAI],
]);
var searchInput=document.getElementById('global-search');
if(searchInput)searchInput.addEventListener('input',function(){doSearch(this.value);});
var aiInput=document.getElementById('ai-query-input');
if(aiInput)aiInput.addEventListener('keydown',function(e){if(e.key==='Enter')askAI();});
// Dash view filter tabs
onDelegate('dash-task-filters','click','button[data-view]',function(){setDashView(this,this.dataset.view);});
// Widget toggles (dynamic)
onDelegate('widget-toggles','click','[data-toggle-widget]',function(e){e.stopPropagation();toggleWidget(this.dataset.toggleWidget);});
// Drag-and-drop for widget reorder
(function(){var c=document.getElementById('dash-widgets');if(!c)return;c.addEventListener('dragstart',function(e){var w=e.target.closest('.dash-widget');if(w)wdragStart(e,w);});c.addEventListener('dragover',wdragOver);c.addEventListener('dragend',wdragEnd);c.addEventListener('drop',wdrop);})();
// Dynamic content delegation — dashboard actions
document.addEventListener('click',function(e){
  var btn=e.target.closest('[data-action]');
  if(!btn)return;
  var id=parseInt(btn.dataset.id),act=btn.dataset.action;
  e.preventDefault();e.stopPropagation();
  if(act==='dash-complete')dashComplete(id);
  else if(act==='dash-complete-recurring')dashCompleteRecurring(id);
  else if(act==='dash-send-email')dashSendEmail(id);
  else if(act==='search-complete')searchComplete(id,btn.dataset.recurring==='true');
  else if(act==='search-send')searchSendEmail(id);
  else if(act==='search-pin')searchTogglePin(id,btn.dataset.pinned==='true');
});

loadLayout();
load();
</script>
</body></html>`);
  };
};

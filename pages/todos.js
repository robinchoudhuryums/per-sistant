const { pageHead, navBar, themeScript } = require("../views");

module.exports = function() {
  return (req, res) => {
  res.send(`${pageHead("To-Dos")}
<body>
${themeScript()}
<div class="container">
  ${navBar("/todos")}
  <h1>To-Dos</h1>
  <p class="subtitle">Short, medium, and long-term task management</p>

  <div class="actions">
    <button class="primary" id="add-task-btn">+ New Task</button>
    <button id="quick-add-btn">Quick Add</button>
    <button id="template-btn">From Template</button>
    <button id="select-toggle">Select</button>
  </div>
  <div id="bulk-bar" style="display:none;padding:10px 16px;margin-bottom:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);display:none;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;">
    <span id="bulk-count">0 selected</span>
    <button id="bulk-complete-btn" style="background:var(--green-bg);color:var(--green);border:1px solid var(--green);padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit;">Complete</button>
    <button id="bulk-delete-btn" style="background:var(--red-bg);color:var(--red);border:1px solid var(--red);padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit;">Delete</button>
    <select id="bulk-priority" style="padding:4px 8px;font-size:12px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);">
      <option value="">Set Priority...</option><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
    </select>
    <button id="select-all-btn" style="margin-left:auto;background:none;border:1px solid var(--border);color:var(--text-muted);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-family:inherit;">Select All</button>
  </div>

  <div class="filter-bar" style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;align-items:center;">
    <select id="filter-horizon" style="padding:6px 12px;font-size:11px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:20px;color:var(--text);cursor:pointer;outline:none;appearance:none;-webkit-appearance:none;padding-right:24px;background-image:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22><path fill=%22%23999%22 d=%22M3 5l3 3 3-3%22/></svg>');background-repeat:no-repeat;background-position:right 8px center;">
      <option value="">All Horizons</option>
      <option value="short">Short-term</option>
      <option value="medium">Medium-term</option>
      <option value="long">Long-term</option>
    </select>
    <select id="filter-status" style="padding:6px 12px;font-size:11px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:20px;color:var(--text);cursor:pointer;outline:none;appearance:none;-webkit-appearance:none;padding-right:24px;background-image:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22><path fill=%22%23999%22 d=%22M3 5l3 3 3-3%22/></svg>');background-repeat:no-repeat;background-position:right 8px center;">
      <option value="pending">Pending</option>
      <option value="all">All Status</option>
      <option value="done">Completed</option>
    </select>
    <select id="filter-priority" style="padding:6px 12px;font-size:11px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:20px;color:var(--text);cursor:pointer;outline:none;appearance:none;-webkit-appearance:none;padding-right:24px;background-image:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22><path fill=%22%23999%22 d=%22M3 5l3 3 3-3%22/></svg>');background-repeat:no-repeat;background-position:right 8px center;">
      <option value="">Any Priority</option>
      <option value="urgent">Urgent</option>
      <option value="high">High</option>
      <option value="medium">Medium</option>
      <option value="low">Low</option>
    </select>
    <select id="filter-category" style="padding:6px 12px;font-size:11px;font-family:inherit;background:var(--surface);border:1px solid var(--border);border-radius:20px;color:var(--text);cursor:pointer;outline:none;appearance:none;-webkit-appearance:none;padding-right:24px;background-image:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22><path fill=%22%23999%22 d=%22M3 5l3 3 3-3%22/></svg>');background-repeat:no-repeat;background-position:right 8px center;">
      <option value="">All Categories</option>
    </select>
  </div>

  <div class="section">
    <div id="todo-list"></div>
  </div>
</div>

<!-- Add/Edit Modal -->
<div class="modal-overlay" id="modal">
  <div class="modal">
    <h2 id="modal-title">New Task</h2>
    <input type="hidden" id="edit-id">
    <label>Title</label>
    <input type="text" id="f-title" placeholder="What needs to be done?">
    <label>Description</label>
    <textarea id="f-desc" placeholder="Optional details..."></textarea>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div><label>Priority</label>
        <select id="f-priority"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select>
      </div>
      <div><label>Horizon</label>
        <select id="f-horizon"><option value="short">Short-term</option><option value="medium">Medium-term</option><option value="long">Long-term</option></select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div><label>Category</label>
        <select id="f-category-select">
          <option value="">None</option>
          <option value="__custom__">Custom...</option>
        </select>
        <input type="text" id="f-category-custom" placeholder="Type custom category" style="display:none;margin-top:6px;">
      </div>
      <div><label>Due Date</label>
        <input type="date" id="f-due"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div style="margin-top:12px;">
        <label style="display:inline;cursor:pointer">
          <input type="checkbox" id="f-recurring" style="width:auto;margin-right:6px;"> Recurring task
        </label>
      </div>
      <div id="f-recurrence" style="display:none;">
        <label>Repeat</label>
        <select id="f-recurrence-rule">
          <option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option>
          <option value="custom_days">Every N Days</option><option value="custom_weeks">Every N Weeks</option><option value="custom_months">Every N Months</option>
        </select>
        <div id="f-interval-row" style="display:none;gap:8px;align-items:center;margin-top:6px;">
          <label style="margin:0;font-size:11px;white-space:nowrap;">Every</label>
          <input type="number" id="f-interval" min="1" max="365" value="2" style="width:60px;font-size:12px;">
          <span id="f-interval-unit" style="font-size:11px;color:var(--text-muted);">days</span>
        </div>
      </div>
    </div>
    <div id="subtasks-section" style="display:none;margin-top:16px;">
      <label>Subtasks <button id="ai-breakdown-btn" style="float:right;padding:4px 10px;font-size:10px;font-weight:500;border:1px solid var(--teal);border-radius:6px;cursor:pointer;background:transparent;color:var(--teal);font-family:inherit;text-transform:uppercase;letter-spacing:0.5px;">AI Breakdown</button></label>
      <div id="subtask-list-edit"></div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <input type="text" id="new-subtask" placeholder="Add subtask..." style="flex:1">
        <button id="add-subtask-btn" style="padding:8px 16px;font-size:12px;font-weight:500;border:1px solid var(--warm);border-radius:8px;cursor:pointer;background:transparent;color:var(--warm);font-family:inherit;">Add</button>
      </div>
    </div>
    <!-- Location reminder (edit mode only) -->
    <div id="location-section" style="display:none;margin-top:16px;">
      <label>Location Reminder</label>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" id="f-location-name" placeholder="e.g. Home, Office, Grocery Store" style="flex:1">
        <button id="get-location-btn" title="Use current location" style="padding:10px 14px;font-size:14px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:transparent;color:var(--teal);flex-shrink:0;">&#128205;</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px;">
        <input type="number" step="any" id="f-location-lat" placeholder="Latitude" style="font-size:11px;">
        <input type="number" step="any" id="f-location-lng" placeholder="Longitude" style="font-size:11px;">
        <input type="number" id="f-location-radius" placeholder="Radius (m)" value="200" style="font-size:11px;">
      </div>
      <div id="location-status" style="font-size:10px;color:var(--text-muted);margin-top:4px;"></div>
    </div>
    <!-- Dependencies section (edit mode only) -->
    <div id="deps-section" style="display:none;margin-top:16px;">
      <label>Dependencies</label>
      <div id="deps-list" style="margin-bottom:8px;"></div>
      <div style="display:flex;gap:8px;">
        <select id="dep-select" style="flex:1"><option value="">Select a task this depends on...</option></select>
        <button id="add-dep-btn" style="padding:8px 16px;font-size:12px;font-weight:500;border:1px solid var(--warm);border-radius:8px;cursor:pointer;background:transparent;color:var(--warm);font-family:inherit;">Add</button>
      </div>
    </div>
    <div class="modal-actions">
      <button id="cancel-modal-btn">Cancel</button>
      <button class="primary" id="save-todo-btn">Save</button>
      <button id="save-template-btn" style="display:none;padding:10px 20px;font-size:13px;font-weight:500;border:1px solid var(--teal);border-radius:8px;cursor:pointer;background:transparent;color:var(--teal);font-family:inherit;">Save as Template</button>
      <button class="danger" id="delete-btn" style="display:none">Delete</button>
    </div>
  </div>
</div>

<!-- Template List Modal -->
<div class="modal-overlay" id="template-modal">
  <div class="modal">
    <h2>Task Templates</h2>
    <div id="template-list" style="margin-bottom:16px;"></div>
    <div class="modal-actions">
      <button id="close-template-btn">Close</button>
    </div>
  </div>
</div>

<!-- Quick Add Modal (natural language) -->
<div class="modal-overlay" id="quick-todo-modal">
  <div class="modal">
    <h2>Quick Add Task</h2>
    <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px;">
      Examples: "Buy groceries tomorrow" &middot; "Call dentist Friday at 2PM" &middot; "Finish report by March 20"
    </p>
    <label>What needs to be done?</label>
    <div style="display:flex;gap:8px;">
      <input type="text" id="qt-input" placeholder="Type or speak a task..." style="flex:1">
      <button id="qt-voice-btn" title="Voice input" style="padding:10px 14px;font-size:16px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:transparent;color:var(--warm);flex-shrink:0;">&#127908;</button>
    </div>
    <div id="qt-preview" style="display:none;margin-top:16px;" class="section">
      <h2>Preview</h2>
      <div id="qt-preview-content"></div>
    </div>
    <div class="modal-actions">
      <button id="qt-cancel-btn">Cancel</button>
      <button class="primary" id="qt-parse-btn">Parse</button>
      <button class="primary" id="qt-confirm" style="display:none">Create</button>
    </div>
  </div>
</div>

<script>
var curHorizon = '', curStatus = 'pending', curPriority = '', curCategory = '';
var dragSrcId = null;
var selectMode = false, selectedIds = new Set();

function toggleSelectMode() {
  selectMode = !selectMode;
  selectedIds.clear();
  document.getElementById('select-toggle').textContent = selectMode ? 'Cancel' : 'Select';
  document.getElementById('bulk-bar').style.display = selectMode ? 'flex' : 'none';
  document.querySelectorAll('.bulk-check').forEach(el => { el.style.display = selectMode ? 'inline-block' : 'none'; el.checked = false; });
  updateBulkCount();
}
function toggleBulkItem(id, checked) {
  if (checked) selectedIds.add(id); else selectedIds.delete(id);
  updateBulkCount();
}
function updateBulkCount() {
  document.getElementById('bulk-count').textContent = selectedIds.size + ' selected';
}
function selectAll() {
  document.querySelectorAll('.bulk-check').forEach(el => { el.checked = true; toggleBulkItem(parseInt(el.dataset.id,10), true); });
}
async function bulkAction(action, data) {
  if (!selectedIds.size) return;
  await fetch('/api/bulk/todos', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:Array.from(selectedIds),action:action,data:data||{}})});
  selectedIds.clear(); updateBulkCount(); load();
}
function setHorizon(v) { curHorizon = v; load(); }
function setStatus(v) { curStatus = v; load(); }
function setPriority(v) { curPriority = v; load(); }
function setCategory(v) { curCategory = v; load(); }

async function loadCategories() {
  try {
    var cats = await fetch('/api/todo-categories').then(r=>r.json());
    // Populate filter dropdown
    var filterSel = document.getElementById('filter-category');
    var html = '<option value="">All Categories</option>';
    cats.forEach(c => { html += '<option value="'+c+'"'+(curCategory===c?' selected':'')+'>'+c.charAt(0).toUpperCase()+c.slice(1)+'</option>'; });
    filterSel.innerHTML = html;
    // Also populate category select in modal
    var sel = document.getElementById('f-category-select');
    var curVal = sel.value;
    sel.innerHTML = '<option value="">None</option>';
    cats.forEach(c => { sel.innerHTML += '<option value="'+c+'">'+c.charAt(0).toUpperCase()+c.slice(1)+'</option>'; });
    sel.innerHTML += '<option value="__custom__">Custom...</option>';
    sel.value = curVal;
  } catch {}
}

async function load() {
  loadCategories();
  var q = [];
  if (curHorizon) q.push('horizon='+curHorizon);
  if (curStatus === 'pending') q.push('completed=false');
  else if (curStatus === 'done') q.push('completed=true');
  if (curPriority) q.push('priority='+curPriority);
  if (curCategory) q.push('category='+curCategory);
  var todos = await fetch('/api/todos'+(q.length?'?'+q.join('&'):'')).then(r=>r.json());
  if (!todos.length) { document.getElementById('todo-list').innerHTML = '<div class="empty-msg">No tasks found</div>'; return; }

  // Fetch subtasks and dependencies for all todos
  var subtaskMap = {}, depMap = {};
  await Promise.all(todos.map(async t => {
    try { subtaskMap[t.id] = await fetch('/api/todos/'+t.id+'/subtasks').then(r=>r.json()); } catch { subtaskMap[t.id] = []; }
    try { depMap[t.id] = await fetch('/api/todos/'+t.id+'/dependencies').then(r=>r.json()); } catch { depMap[t.id] = {blocked_by:[],blocking:[]}; }
  }));

  document.getElementById('todo-list').innerHTML = todos.map((t, idx) => {
    var dueTxt = t.due_date ? 'Due: '+new Date(t.due_date).toLocaleDateString() : '';
    var overdue = t.due_date && !t.completed && new Date(t.due_date) <= new Date() ? ' style="color:var(--red)"' : '';
    var subs = subtaskMap[t.id] || [];
    var subDone = subs.filter(s=>s.completed).length;
    var subHtml = '';
    if (subs.length) {
      subHtml = '<div class="subtask-progress"><div class="subtask-progress-fill" style="width:'+(subDone/subs.length*100)+'%"></div></div>';
      subHtml += '<div class="subtask-list">'+subs.map(s =>
        '<div class="subtask-item"><div class="subtask-check'+(s.completed?' done':'')+'" data-action="toggle-subtask" data-id="'+s.id+'" data-completed="'+(!s.completed)+'"></div><span class="subtask-text'+(s.completed?' done':'')+'" data-action="edit-subtask" data-id="'+s.id+'">'+esc(s.title)+'</span><button class="subtask-edit-btn" data-action="edit-subtask-btn" data-id="'+s.id+'">&#9998;</button></div>'
      ).join('')+'</div>';
    }
    var deps = depMap[t.id] || {blocked_by:[],blocking:[]};
    var unblockedBy = deps.blocked_by.filter(d=>!d.completed);
    var isBlocked = unblockedBy.length > 0;
    var depBadges = '';
    if (isBlocked) depBadges += '<span class="badge blocked" title="Blocked by: '+unblockedBy.map(d=>esc(d.title)).join(', ')+'">blocked ('+unblockedBy.length+')</span>';
    if (deps.blocking.length) depBadges += '<span class="badge blocking" title="Blocking: '+deps.blocking.map(d=>esc(d.title)).join(', ')+'">blocking ('+deps.blocking.length+')</span>';
    if (t.streak_count > 0) depBadges += '<span class="badge streak" title="Best: '+t.best_streak+'">&#x1F525; '+t.streak_count+' streak</span>';
    if (t.location_name) depBadges += '<span title="'+esc(t.location_name)+'" style="font-size:10px;color:var(--teal);">&#128205; '+esc(t.location_name)+'</span>';
    if (t.snoozed_until) depBadges += '<span style="font-size:10px;color:var(--yellow);" title="Snoozed until '+t.snoozed_until+'">&#128164; snoozed</span>';
    var recurInfo = '';
    if (t.recurring) {
      var ruleLabel = t.recurrence_rule;
      if (t.recurrence_rule && t.recurrence_rule.startsWith('custom') && t.recurrence_interval > 1) {
        var unit = t.recurrence_rule.replace('custom_','');
        ruleLabel = 'every '+t.recurrence_interval+' '+unit;
      }
      recurInfo = '<span class="badge recurring">'+ruleLabel+'</span>';
    }
    var skipSnoozeButtons = t.recurring && !t.completed ? '<button data-action="skip" data-id="'+t.id+'" title="Skip this occurrence" style="font-size:10px;padding:2px 6px;">Skip</button><button data-action="snooze" data-id="'+t.id+'" title="Snooze" style="font-size:10px;padding:2px 6px;">&#128164;</button>' : '';
    return '<div class="todo-item'+(isBlocked?' todo-blocked':'')+'" draggable="true" data-id="'+t.id+'" ondragstart="dragStart(event)" ondragover="dragOver(event)" ondrop="drop(event)" ondragend="dragEnd(event)"><input type="checkbox" class="bulk-check" data-id="'+t.id+'" style="display:'+(selectMode?'inline-block':'none')+';accent-color:var(--warm);margin-right:4px;cursor:pointer;"><span class="drag-handle">&#9776;</span><div class="todo-check'+(t.completed?' done':'')+'" data-action="toggle" data-id="'+t.id+'" data-completed="'+(!t.completed)+'" data-recurring="'+!!t.recurring+'"></div><div class="todo-content"><div class="todo-title'+(t.completed?' done':'')+'">'+esc(t.title)+'</div><div class="todo-meta"><span class="badge '+t.priority+'">'+t.priority+'</span><span class="badge '+t.horizon+'">'+t.horizon+'</span>'+recurInfo+depBadges+(t.category?'<span>'+esc(t.category)+'</span>':'')+(dueTxt?'<span'+overdue+'>'+dueTxt+'</span>':'')+(subs.length?'<span>'+subDone+'/'+subs.length+' subtasks</span>':'')+'</div>'+(t.description?'<div style="font-size:12px;color:var(--text-muted);margin-top:4px;font-weight:300">'+esc(t.description)+'</div>':'')+subHtml+'</div><div class="todo-actions">'+skipSnoozeButtons+'<button data-action="edit" data-id="'+t.id+'">&#9998;</button></div></div>';
  }).join('');
}

// Drag and drop
function dragStart(e) { dragSrcId = e.currentTarget.dataset.id; e.currentTarget.classList.add('dragging'); }
function dragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function dragEnd(e) { document.querySelectorAll('.todo-item').forEach(el => { el.classList.remove('dragging','drag-over'); }); }
async function drop(e) {
  e.preventDefault(); e.currentTarget.classList.remove('drag-over');
  var targetId = e.currentTarget.dataset.id;
  if (dragSrcId === targetId) return;
  var items = document.querySelectorAll('.todo-item[data-id]');
  var order = [];
  items.forEach((el, i) => { order.push({id: parseInt(el.dataset.id), sort_order: i}); });
  // Swap
  var srcIdx = order.findIndex(o => o.id === parseInt(dragSrcId));
  var tgtIdx = order.findIndex(o => o.id === parseInt(targetId));
  if (srcIdx > -1 && tgtIdx > -1) {
    var temp = order[srcIdx]; order[srcIdx] = order[tgtIdx]; order[tgtIdx] = temp;
    order.forEach((o, i) => o.sort_order = i);
    await fetch('/api/todos/reorder', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order})});
    load();
  }
}

// Subtasks
async function toggleSubtask(id, completed) {
  await fetch('/api/subtasks/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({completed})});
  load();
}

var editSubtasks = [];
async function addSubtask() {
  var input = document.getElementById('new-subtask');
  var title = input.value.trim();
  if (!title) return;
  var todoId = document.getElementById('edit-id').value;
  if (todoId) {
    await fetch('/api/todos/'+todoId+'/subtasks', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title})});
    input.value = '';
    loadEditSubtasks(todoId);
  } else {
    editSubtasks.push({title, completed: false});
    input.value = '';
    renderEditSubtasks();
  }
}
function renderEditSubtasks() {
  document.getElementById('subtask-list-edit').innerHTML = editSubtasks.map((s,i) =>
    '<div class="subtask-item"><span class="subtask-text" data-action="edit-new-sub" data-idx="'+i+'">'+esc(s.title)+'</span><button class="subtask-edit-btn" data-action="edit-new-sub-btn" data-idx="'+i+'" title="Edit">&#9998;</button><button data-action="remove-new-sub" data-idx="'+i+'" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:12px;padding:8px;-webkit-tap-highlight-color:transparent;touch-action:manipulation;">&#10005;</button></div>'
  ).join('');
}
async function loadEditSubtasks(todoId) {
  var subs = await fetch('/api/todos/'+todoId+'/subtasks').then(r=>r.json());
  document.getElementById('subtask-list-edit').innerHTML = subs.map(s =>
    '<div class="subtask-item"><div class="subtask-check'+(s.completed?' done':'')+'" data-action="toggle-edit-sub" data-id="'+s.id+'" data-completed="'+(!s.completed)+'" data-todo="'+todoId+'"></div><span class="subtask-text'+(s.completed?' done':'')+'" data-action="inline-edit-sub" data-id="'+s.id+'" data-todo="'+todoId+'">'+esc(s.title)+'</span><button class="subtask-edit-btn" data-action="inline-edit-sub-btn" data-id="'+s.id+'" data-todo="'+todoId+'" title="Edit">&#9998;</button><button data-action="delete-sub" data-id="'+s.id+'" data-todo="'+todoId+'" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:12px;padding:8px;-webkit-tap-highlight-color:transparent;touch-action:manipulation;">&#10005;</button></div>'
  ).join('');
}
async function deleteSubtask(id, todoId) {
  await fetch('/api/subtasks/'+id, {method:'DELETE'});
  loadEditSubtasks(todoId);
}
function inlineEditSubtask(span, id, todoId) {
  if (span.querySelector('input')) return;
  var old = span.textContent;
  var input = document.createElement('input');
  input.type = 'text'; input.value = old;
  input.style.cssText = 'font-size:12px;font-family:inherit;background:var(--surface-2);color:var(--text);border:1px solid var(--warm);border-radius:4px;padding:2px 6px;width:100%;';
  span.textContent = '';
  span.appendChild(input);
  input.focus(); input.select();
  function save() {
    var val = input.value.trim();
    if (val && val !== old) {
      fetch('/api/subtasks/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:val})}).then(function(){ if(todoId) loadEditSubtasks(todoId); else load(); });
    } else {
      span.textContent = old;
    }
  }
  input.addEventListener('blur', save);
  input.addEventListener('keydown', function(e) { if(e.key==='Enter'){e.preventDefault();input.blur();} if(e.key==='Escape'){input.value=old;input.blur();} });
}
function inlineEditNewSubtask(span, idx) {
  if (span.querySelector('input')) return;
  var old = span.textContent;
  var input = document.createElement('input');
  input.type = 'text'; input.value = old;
  input.style.cssText = 'font-size:12px;font-family:inherit;background:var(--surface-2);color:var(--text);border:1px solid var(--warm);border-radius:4px;padding:2px 6px;width:100%;';
  span.textContent = '';
  span.appendChild(input);
  input.focus(); input.select();
  function save() {
    var val = input.value.trim();
    if (val) { editSubtasks[idx].title = val; }
    renderEditSubtasks();
  }
  input.addEventListener('blur', save);
  input.addEventListener('keydown', function(e) { if(e.key==='Enter'){e.preventDefault();input.blur();} if(e.key==='Escape'){input.value=old;input.blur();} });
}

function openAdd() {
  document.getElementById('modal-title').textContent = 'New Task';
  document.getElementById('edit-id').value = '';
  document.getElementById('f-title').value = '';
  document.getElementById('f-desc').value = '';
  document.getElementById('f-priority').value = 'medium';
  document.getElementById('f-horizon').value = 'short';
  document.getElementById('f-category-select').value = '';
  document.getElementById('f-category-custom').style.display = 'none';
  document.getElementById('f-category-custom').value = '';
  document.getElementById('f-due').value = '';
  document.getElementById('f-recurring').checked = false;
  document.getElementById('f-recurrence').style.display = 'none';
  document.getElementById('f-recurrence-rule').value = 'weekly';
  document.getElementById('delete-btn').style.display = 'none';
  document.getElementById('save-template-btn').style.display = 'inline-block';
  document.getElementById('subtasks-section').style.display = 'block';
  document.getElementById('deps-section').style.display = 'none';
  document.getElementById('location-section').style.display = 'block';
  document.getElementById('f-location-name').value = '';
  document.getElementById('f-location-lat').value = '';
  document.getElementById('f-location-lng').value = '';
  document.getElementById('f-location-radius').value = 200;
  document.getElementById('location-status').textContent = '';
  editSubtasks = [];
  renderEditSubtasks();
  document.getElementById('modal').classList.add('active');
}

async function openEdit(id) {
  var todos = await fetch('/api/todos').then(r=>r.json());
  var t = todos.find(x=>x.id===id);
  if (!t) return;
  document.getElementById('modal-title').textContent = 'Edit Task';
  document.getElementById('edit-id').value = id;
  document.getElementById('f-title').value = t.title;
  document.getElementById('f-desc').value = t.description||'';
  document.getElementById('f-priority').value = t.priority;
  document.getElementById('f-horizon').value = t.horizon;
  var catSel = document.getElementById('f-category-select');
  var catCustom = document.getElementById('f-category-custom');
  if (t.category && ![...catSel.options].some(o=>o.value===t.category)) {
    catSel.value = '__custom__';
    catCustom.style.display = 'block';
    catCustom.value = t.category;
  } else {
    catSel.value = t.category || '';
    catCustom.style.display = 'none';
    catCustom.value = '';
  }
  document.getElementById('f-due').value = t.due_date?t.due_date.split('T')[0]:'';
  document.getElementById('f-recurring').checked = t.recurring||false;
  document.getElementById('f-recurrence').style.display = t.recurring ? 'block' : 'none';
  document.getElementById('f-recurrence-rule').value = t.recurrence_rule || 'weekly';
  document.getElementById('f-interval').value = t.recurrence_interval || 1;
  document.getElementById('f-interval-row').style.display = (t.recurrence_rule||'').startsWith('custom') ? 'flex' : 'none';
  document.getElementById('delete-btn').style.display = 'inline-block';
  document.getElementById('save-template-btn').style.display = 'inline-block';
  document.getElementById('subtasks-section').style.display = 'block';
  document.getElementById('deps-section').style.display = 'block';
  document.getElementById('location-section').style.display = 'block';
  document.getElementById('f-location-name').value = t.location_name || '';
  document.getElementById('f-location-lat').value = t.location_lat || '';
  document.getElementById('f-location-lng').value = t.location_lng || '';
  document.getElementById('f-location-radius').value = t.location_radius || 200;
  document.getElementById('location-status').textContent = t.location_lat ? 'Location: ' + t.location_lat.toFixed(4) + ', ' + t.location_lng.toFixed(4) : '';
  loadEditSubtasks(id);
  loadDeps(id);
  document.getElementById('modal').classList.add('active');
}

function closeModal() { document.getElementById('modal').classList.remove('active'); }

async function saveTodo() {
  var id = document.getElementById('edit-id').value;
  var isRecurring = document.getElementById('f-recurring').checked;
  var data = {
    title: document.getElementById('f-title').value,
    description: document.getElementById('f-desc').value || null,
    priority: document.getElementById('f-priority').value,
    horizon: document.getElementById('f-horizon').value,
    category: (document.getElementById('f-category-select').value === '__custom__' ? document.getElementById('f-category-custom').value : document.getElementById('f-category-select').value) || null,
    due_date: document.getElementById('f-due').value || null,
    recurring: isRecurring,
    recurrence_rule: isRecurring ? document.getElementById('f-recurrence-rule').value : null,
    recurrence_interval: isRecurring ? (parseInt(document.getElementById('f-interval').value) || 1) : 1,
    location_name: document.getElementById('f-location-name').value || null,
    location_lat: parseFloat(document.getElementById('f-location-lat').value) || null,
    location_lng: parseFloat(document.getElementById('f-location-lng').value) || null,
    location_radius: parseInt(document.getElementById('f-location-radius').value) || 200,
  };
  if (!data.title) return alert('Title is required');
  var result;
  if (id) {
    result = await fetch('/api/todos/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(r=>r.json());
  } else {
    result = await fetch('/api/todos', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(r=>r.json());
    // Create subtasks for new todo
    if (result.id && editSubtasks.length) {
      for (var s of editSubtasks) {
        await fetch('/api/todos/'+result.id+'/subtasks', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:s.title})});
      }
    }
  }
  closeModal(); load();
}

async function toggleTodo(id, completed, isRecurring) {
  if (completed && isRecurring) {
    await fetch('/api/todos/'+id+'/complete-recurring', {method:'POST'});
  } else {
    await fetch('/api/todos/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({completed})});
  }
  if (completed) showUndo('Task completed','todo',id,'complete');
  load();
}

async function skipTodo(id) {
  await fetch('/api/todos/'+id+'/skip-recurring', {method:'POST'});
  load();
}

async function snoozeTodo(id) {
  var until = prompt('Snooze until (YYYY-MM-DD):');
  if (!until) return;
  await fetch('/api/todos/'+id+'/snooze', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({until:until})});
  load();
}

async function deleteTodo() {
  var id = document.getElementById('edit-id').value;
  await fetch('/api/todos/'+id, {method:'DELETE'});
  closeModal(); load();
  showUndo('Task moved to trash','todo',id);
}

// Location
function getLocation() {
  if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
  document.getElementById('location-status').textContent = 'Getting location...';
  navigator.geolocation.getCurrentPosition(function(pos) {
    document.getElementById('f-location-lat').value = pos.coords.latitude.toFixed(6);
    document.getElementById('f-location-lng').value = pos.coords.longitude.toFixed(6);
    document.getElementById('location-status').textContent = 'Location set: ' + pos.coords.latitude.toFixed(4) + ', ' + pos.coords.longitude.toFixed(4);
  }, function(err) {
    document.getElementById('location-status').textContent = 'Error: ' + err.message;
  }, {enableHighAccuracy: true});
}

// Check location reminders periodically
function checkLocationReminders() {
  if (!navigator.geolocation || !('Notification' in window) || Notification.permission !== 'granted') return;
  navigator.geolocation.getCurrentPosition(async function(pos) {
    try {
      var todos = await fetch('/api/todos?completed=false').then(r=>r.json());
      todos.filter(t => t.location_lat && t.location_lng).forEach(t => {
        var dist = haversine(pos.coords.latitude, pos.coords.longitude, t.location_lat, t.location_lng);
        if (dist <= (t.location_radius || 200)) {
          new Notification('Per-sistant Reminder', { body: t.title + (t.location_name ? ' (near ' + t.location_name + ')' : ''), icon: '/icon-192.svg' });
        }
      });
    } catch {}
  }, function(){}, {enableHighAccuracy: false, timeout: 5000});
}
function haversine(lat1, lon1, lat2, lon2) {
  var R = 6371000; var p = Math.PI / 180;
  var a = 0.5 - Math.cos((lat2-lat1)*p)/2 + Math.cos(lat1*p)*Math.cos(lat2*p)*(1-Math.cos((lon2-lon1)*p))/2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
if (typeof setInterval !== 'undefined') setInterval(checkLocationReminders, 300000); // every 5 min

// Dependencies
async function loadDeps(todoId) {
  var deps = await fetch('/api/todos/'+todoId+'/dependencies').then(r=>r.json());
  var html = '';
  if (deps.blocked_by.length) {
    html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Blocked by:</div>';
    deps.blocked_by.forEach(d => {
      html += '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;"><span class="badge blocked">blocked by</span><span'+(d.completed?' style="text-decoration:line-through;opacity:0.5"':'')+'>'+esc(d.title)+'</span><button data-action="remove-dep" data-dep-id="'+d.dep_id+'" data-todo="'+todoId+'" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:12px;padding:4px;">&times;</button></div>';
    });
  }
  if (deps.blocking.length) {
    html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;margin-top:6px;">Blocking:</div>';
    deps.blocking.forEach(d => {
      html += '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;"><span class="badge blocking">blocking</span><span>'+esc(d.title)+'</span></div>';
    });
  }
  if (!deps.blocked_by.length && !deps.blocking.length) html = '<div style="font-size:11px;color:var(--text-muted);">No dependencies</div>';
  document.getElementById('deps-list').innerHTML = html;
  // Populate select with other todos
  var todos = await fetch('/api/todos?completed=false').then(r=>r.json());
  var existing = new Set(deps.blocked_by.map(d=>d.depends_on_id));
  var sel = document.getElementById('dep-select');
  sel.innerHTML = '<option value="">Select a task this depends on...</option>';
  todos.filter(t => t.id !== parseInt(todoId) && !existing.has(t.id)).forEach(t => {
    sel.innerHTML += '<option value="'+t.id+'">'+esc(t.title)+'</option>';
  });
}
async function addDep() {
  var todoId = document.getElementById('edit-id').value;
  var depId = document.getElementById('dep-select').value;
  if (!depId || !todoId) return;
  var r = await fetch('/api/todos/'+todoId+'/dependencies', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({depends_on_id:parseInt(depId)})}).then(r=>r.json());
  if (r.error) { alert(r.error); return; }
  loadDeps(todoId);
}
async function removeDep(depId, todoId) {
  await fetch('/api/dependencies/'+depId, {method:'DELETE'});
  loadDeps(todoId);
}

// Quick Add (natural language)
function openQuickTodo() {
  document.getElementById('qt-input').value = '';
  document.getElementById('qt-preview').style.display = 'none';
  document.getElementById('qt-confirm').style.display = 'none';
  document.getElementById('quick-todo-modal').classList.add('active');
  document.getElementById('qt-input').focus();
}
function closeQuickTodo() { document.getElementById('quick-todo-modal').classList.remove('active'); }

var parsedTodo = null;
function parseQuickTodo() {
  var input = document.getElementById('qt-input').value.trim();
  if (!input) return;
  var days = {sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6};
  var dateMatch = input.match(/\b(\d{4}-\d{2}-\d{2})\b/) || input.match(/\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}(?:,?\s*\d{4})?)\b/i);
  var tomorrowMatch = input.match(/\btomorrow\b/i);
  var dayMatch = input.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  var dueDate = null;
  if (dateMatch) { dueDate = new Date(dateMatch[1]); }
  else if (tomorrowMatch) { dueDate = new Date(); dueDate.setDate(dueDate.getDate()+1); }
  else if (dayMatch) {
    dueDate = new Date();
    var target = days[dayMatch[1].toLowerCase()];
    var diff = (target - dueDate.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    dueDate.setDate(dueDate.getDate() + diff);
  }
  // Extract priority
  var priority = 'medium';
  if (/\burgent\b/i.test(input)) priority = 'urgent';
  else if (/\bhigh\b|\bimportant\b/i.test(input)) priority = 'high';
  else if (/\blow\b/i.test(input)) priority = 'low';
  // Clean title
  var title = input.replace(/\b(tomorrow|today|urgent|high|low|important)\b/gi, '').replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '').replace(/\b(by|on|at|next|this)\b/gi, '').replace(/\s+/g,' ').trim();
  parsedTodo = { title: title, priority: priority, due_date: dueDate ? dueDate.toISOString().split('T')[0] : null, horizon: 'short' };
  document.getElementById('qt-preview-content').innerHTML =
    '<div style="font-size:13px;"><strong>Task:</strong> '+esc(parsedTodo.title)+'<br><strong>Priority:</strong> '+parsedTodo.priority+'<br><strong>Due:</strong> '+(parsedTodo.due_date||'None')+'</div>';
  document.getElementById('qt-preview').style.display = 'block';
  document.getElementById('qt-confirm').style.display = 'inline-block';
}
async function confirmQuickTodo() {
  if (!parsedTodo || !parsedTodo.title) return;
  await fetch('/api/todos', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(parsedTodo)});
  closeQuickTodo(); load();
}

// AI Task Breakdown
async function aiBreakdown() {
  var title = document.getElementById('f-title').value;
  if (!title) return alert('Enter a task title first');
  var btn = document.getElementById('ai-breakdown-btn');
  btn.textContent = 'Thinking...'; btn.disabled = true;
  try {
    var r = await fetch('/api/ai/task-breakdown', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title, description: document.getElementById('f-desc').value})}).then(r=>r.json());
    if (r.error) { alert(r.error); return; }
    var todoId = document.getElementById('edit-id').value;
    if (todoId) {
      for (var s of r.subtasks) {
        await fetch('/api/todos/'+todoId+'/subtasks', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:s})});
      }
      loadEditSubtasks(todoId);
    } else {
      r.subtasks.forEach(s => editSubtasks.push({title:s, completed:false}));
      renderEditSubtasks();
    }
  } catch (err) { alert('AI breakdown failed: '+err.message); }
  finally { btn.textContent = 'AI Breakdown'; btn.disabled = false; }
}

// AI-enhanced Quick Add
var parsedTodoAI = null;
async function parseQuickTodoAI() {
  var input = document.getElementById('qt-input').value.trim();
  if (!input) return;
  var btn = document.querySelector('#quick-todo-modal .primary');
  btn.textContent = 'Parsing...'; btn.disabled = true;
  try {
    var r = await fetch('/api/ai/parse-todo', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input})}).then(r=>r.json());
    if (r.error) { parseQuickTodo(); return; } // Fallback to regex parsing
    parsedTodo = r;
    document.getElementById('qt-preview-content').innerHTML =
      '<div style="font-size:13px;"><strong>Task:</strong> '+esc(r.title)+'<br><strong>Priority:</strong> '+r.priority+'<br><strong>Horizon:</strong> '+r.horizon+'<br><strong>Category:</strong> '+(r.category||'None')+'<br><strong>Due:</strong> '+(r.due_date||'None')+'</div>';
    document.getElementById('qt-preview').style.display = 'block';
    document.getElementById('qt-confirm').style.display = 'inline-block';
  } catch { parseQuickTodo(); } // Fallback to regex
  finally { btn.textContent = 'Parse'; btn.disabled = false; }
}

// Templates
async function openTemplateList() {
  var templates = await fetch('/api/todo-templates').then(r=>r.json());
  var el = document.getElementById('template-list');
  if (!templates.length) { el.innerHTML = '<div class="empty-msg">No templates yet. Edit a task and click "Save as Template" to create one.</div>'; }
  else {
    el.innerHTML = templates.map(t => {
      var subs = t.subtasks || [];
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.04);"><div style="flex:1;"><div style="font-size:14px;font-weight:400;">'+esc(t.name)+'</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">'+esc(t.title)+' &middot; <span class="badge '+t.priority+'">'+t.priority+'</span> &middot; '+t.horizon+(subs.length?' &middot; '+subs.length+' subtasks':'')+'</div></div><div style="display:flex;gap:6px;"><button data-action="apply-template" data-id="'+t.id+'" style="background:var(--green-bg);color:var(--green);border:1px solid var(--green);padding:4px 12px;border-radius:6px;cursor:pointer;font-size:11px;font-family:inherit;">Use</button><button data-action="delete-template" data-id="'+t.id+'" style="background:var(--red-bg);color:var(--red);border:1px solid var(--red);padding:4px 12px;border-radius:6px;cursor:pointer;font-size:11px;font-family:inherit;">&#10005;</button></div></div>';
    }).join('');
  }
  document.getElementById('template-modal').classList.add('active');
}
function closeTemplateList() { document.getElementById('template-modal').classList.remove('active'); }
async function applyTemplate(id) {
  await fetch('/api/todo-templates/'+id+'/apply', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
  closeTemplateList();
  load();
}
async function deleteTemplate(id) {
  await fetch('/api/todo-templates/'+id, {method:'DELETE'});
  openTemplateList();
}
async function saveAsTemplate() {
  var name = prompt('Template name:');
  if (!name) return;
  var isRecurring = document.getElementById('f-recurring').checked;
  var data = {
    name: name,
    title: document.getElementById('f-title').value,
    description: document.getElementById('f-desc').value || null,
    priority: document.getElementById('f-priority').value,
    horizon: document.getElementById('f-horizon').value,
    category: (document.getElementById('f-category-select').value === '__custom__' ? document.getElementById('f-category-custom').value : document.getElementById('f-category-select').value) || null,
    recurring: isRecurring,
    recurrence_rule: isRecurring ? document.getElementById('f-recurrence-rule').value : null,
    recurrence_interval: isRecurring ? parseInt(document.getElementById('f-interval').value) || 1 : 1,
    subtasks: editSubtasks.map(s => s.title),
  };
  // If editing existing, get subtasks from the server
  var todoId = document.getElementById('edit-id').value;
  if (todoId) {
    try {
      var subs = await fetch('/api/todos/'+todoId+'/subtasks').then(r=>r.json());
      data.subtasks = subs.map(s => s.title);
    } catch {}
  }
  await fetch('/api/todo-templates', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  alert('Template saved!');
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openAdd(); }
  else if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); openQuickTodo(); }
});


bindEvents([
  ['add-task-btn','click',openAdd],
  ['quick-add-btn','click',openQuickTodo],
  ['template-btn','click',openTemplateList],
  ['select-toggle','click',toggleSelectMode],
  ['bulk-complete-btn','click',function(){bulkAction('complete');}],
  ['bulk-delete-btn','click',function(){bulkAction('delete');}],
  ['select-all-btn','click',selectAll],
  ['ai-breakdown-btn','click',aiBreakdown],
  ['add-subtask-btn','click',addSubtask],
  ['get-location-btn','click',getLocation],
  ['add-dep-btn','click',addDep],
  ['cancel-modal-btn','click',closeModal],
  ['save-todo-btn','click',saveTodo],
  ['save-template-btn','click',saveAsTemplate],
  ['delete-btn','click',deleteTodo],
  ['close-template-btn','click',closeTemplateList],
  ['qt-voice-btn','click',function(){startVoiceInput('qt-input');}],
  ['qt-cancel-btn','click',closeQuickTodo],
  ['qt-parse-btn','click',parseQuickTodoAI],
  ['qt-confirm','click',confirmQuickTodo],
]);
document.getElementById('bulk-priority').addEventListener('change',function(){if(this.value){bulkAction('set_priority',{priority:this.value});this.value='';}});
document.getElementById('f-category-select').addEventListener('change',function(){if(this.value==='__custom__'){document.getElementById('f-category-custom').style.display='block';document.getElementById('f-category-custom').focus();}else{document.getElementById('f-category-custom').style.display='none';}});
document.getElementById('f-recurring').addEventListener('change',function(){document.getElementById('f-recurrence').style.display=this.checked?'block':'none';});
document.getElementById('f-recurrence-rule').addEventListener('change',function(){document.getElementById('f-interval-row').style.display=this.value.startsWith('custom')?'flex':'none';});
document.getElementById('qt-input').addEventListener('keydown',function(e){if(e.key==='Enter')parseQuickTodo();});
document.getElementById('filter-horizon').addEventListener('change',function(){setHorizon(this.value);});
document.getElementById('filter-status').addEventListener('change',function(){setStatus(this.value);});
document.getElementById('filter-priority').addEventListener('change',function(){setPriority(this.value);});
document.getElementById('filter-category').addEventListener('change',function(){setCategory(this.value);});
document.addEventListener('click',function(e){
  var btn=e.target.closest('[data-action]');
  if(!btn)return;
  var id=parseInt(btn.dataset.id),act=btn.dataset.action;
  e.stopPropagation();
  if(act==='toggle')toggleTodo(id,btn.dataset.completed==='true',btn.dataset.recurring==='true');
  else if(act==='edit')openEdit(id);
  else if(act==='skip')skipTodo(id);
  else if(act==='snooze')snoozeTodo(id);
  else if(act==='toggle-subtask'){toggleSubtask(id,btn.dataset.completed==='true');}
  else if(act==='edit-subtask'||act==='edit-subtask-btn'){inlineEditSubtask(act==='edit-subtask-btn'?btn.previousElementSibling:btn,id);}
  else if(act==='toggle-edit-sub'){toggleSubtask(id,btn.dataset.completed==='true');loadEditSubtasks(parseInt(btn.dataset.todo));}
  else if(act==='inline-edit-sub'||act==='inline-edit-sub-btn'){inlineEditSubtask(act==='inline-edit-sub-btn'?btn.previousElementSibling:btn,id,parseInt(btn.dataset.todo));}
  else if(act==='delete-sub')deleteSubtask(id,parseInt(btn.dataset.todo));
  else if(act==='edit-new-sub'||act==='edit-new-sub-btn'){inlineEditNewSubtask(act==='edit-new-sub-btn'?btn.previousElementSibling:btn,parseInt(btn.dataset.idx));}
  else if(act==='remove-new-sub'){editSubtasks.splice(parseInt(btn.dataset.idx),1);renderEditSubtasks();}
  else if(act==='remove-dep')removeDep(parseInt(btn.dataset.depId),parseInt(btn.dataset.todo));
  else if(act==='apply-template')applyTemplate(id);
  else if(act==='delete-template')deleteTemplate(id);
});
document.addEventListener('change',function(e){
  if(e.target.classList.contains('bulk-check'))toggleBulkItem(parseInt(e.target.dataset.id),e.target.checked);
});

load();
</script>
</body></html>`);
  };
};

const { pageHead, navBar, themeScript } = require("../views");

module.exports = function() {
  return (req, res) => {
  res.send(`${pageHead("Contacts")}
<body>
${themeScript()}
<div class="container">
  ${navBar("/contacts")}
  <h1>Contacts</h1>
  <p class="subtitle">Manage your email contacts for quick lookup</p>

  <div class="actions">
    <button class="primary" onclick="openAdd()">+ Add Contact</button>
    <button onclick="document.getElementById('csv-file').click()">Import CSV</button>
    <input type="file" id="csv-file" accept=".csv" style="display:none" onchange="importCSV(this)">
  </div>

  <div class="section">
    <div id="contact-list"></div>
  </div>
  <div id="import-status" class="status-msg"></div>
</div>

<div class="modal-overlay" id="contact-modal">
  <div class="modal">
    <h2 id="c-modal-title">Add Contact</h2>
    <input type="hidden" id="c-id">
    <label>Name</label>
    <input type="text" id="c-name" placeholder="e.g. Mom, Boss, John">
    <label>Email</label>
    <input type="email" id="c-email" placeholder="email@example.com">
    <div class="modal-actions">
      <button onclick="closeContact()">Cancel</button>
      <button class="primary" onclick="saveContact()">Save</button>
      <button class="danger" id="c-delete-btn" style="display:none" onclick="deleteContact()">Delete</button>
    </div>
  </div>
</div>

<script>
async function load() {
  var contacts = await fetch('/api/contacts').then(r=>r.json());
  if (!contacts.length) { document.getElementById('contact-list').innerHTML = '<div class="empty-msg">No contacts yet. Add contacts to use quick email addressing.</div>'; return; }
  document.getElementById('contact-list').innerHTML = '<table><thead><tr><th>Name</th><th>Email</th><th>Actions</th></tr></thead><tbody>' +
    contacts.map(c => '<tr><td>'+esc(c.name)+'</td><td>'+esc(c.email)+'</td><td><div class="todo-actions"><button onclick="openEdit('+c.id+')">&#9998;</button><button class="delete" onclick="deleteDirect('+c.id+')">&#10005;</button></div></td></tr>').join('') +
    '</tbody></table>';
}

function openAdd() {
  document.getElementById('c-modal-title').textContent = 'Add Contact';
  document.getElementById('c-id').value = '';
  document.getElementById('c-name').value = '';
  document.getElementById('c-email').value = '';
  document.getElementById('c-delete-btn').style.display = 'none';
  document.getElementById('contact-modal').classList.add('active');
}

async function openEdit(id) {
  var contacts = await fetch('/api/contacts').then(r=>r.json());
  var c = contacts.find(x=>x.id===id);
  if (!c) return;
  document.getElementById('c-modal-title').textContent = 'Edit Contact';
  document.getElementById('c-id').value = id;
  document.getElementById('c-name').value = c.name;
  document.getElementById('c-email').value = c.email;
  document.getElementById('c-delete-btn').style.display = 'inline-block';
  document.getElementById('contact-modal').classList.add('active');
}

function closeContact() { document.getElementById('contact-modal').classList.remove('active'); }

async function saveContact() {
  var data = { name: document.getElementById('c-name').value, email: document.getElementById('c-email').value };
  if (!data.name || !data.email) return alert('Name and email are required');
  var id = document.getElementById('c-id').value;
  if (id) await fetch('/api/contacts/'+id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  else {
    var r = await fetch('/api/contacts', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    var d = await r.json();
    if (d.error) return alert(d.error);
  }
  closeContact(); load();
}

async function deleteContact() {
  var id = document.getElementById('c-id').value;
  if (!confirm('Delete this contact?')) return;
  await fetch('/api/contacts/'+id, {method:'DELETE'});
  closeContact(); load();
}

async function deleteDirect(id) {
  if (!confirm('Delete this contact?')) return;
  await fetch('/api/contacts/'+id, {method:'DELETE'});
  load();
}

function importCSV(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = async function(e) {
    var lines = e.target.result.split('\\n').filter(l => l.trim());
    var contacts = [];
    for (var i = 0; i < lines.length; i++) {
      var parts = lines[i].split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= 2) {
        // Skip header row
        if (i === 0 && (parts[0].toLowerCase() === 'name' || parts[1].toLowerCase() === 'email')) continue;
        contacts.push({ name: parts[0], email: parts[1] });
      }
    }
    if (!contacts.length) { alert('No valid contacts found in CSV. Expected format: name,email'); return; }
    var r = await fetch('/api/contacts/import', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contacts:contacts})}).then(r=>r.json());
    var el = document.getElementById('import-status');
    el.className = 'status-msg success';
    el.textContent = 'Imported '+r.imported+' contacts'+(r.errors?' ('+r.errors+' errors)':'');
    setTimeout(function(){el.className='status-msg';},5000);
    load();
  };
  reader.readAsText(file);
  input.value = '';
}

load();
</script>
</body></html>`);
  };
};

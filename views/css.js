module.exports = `
    :root {
      --bg: #0b0e18; --surface: rgba(255,255,255,0.04); --surface-2: rgba(255,255,255,0.07);
      --border: rgba(255,255,255,0.08); --border-hover: rgba(255,255,255,0.18);
      --text: #f0ece4; --text-muted: rgba(240,236,228,0.5);
      --warm: #e6a44a; --warm-glow: #d4943e; --teal: #4db8c7;
      --green: #5cc98a; --green-bg: rgba(92,201,138,0.1);
      --red: #e85c5c; --red-bg: rgba(232,92,92,0.1);
      --yellow: #f0c850; --yellow-bg: rgba(240,200,80,0.12);
      --blue: #5ba8e6; --blue-bg: rgba(91,168,230,0.1);
      --coral: #e87860; --coral-bg: rgba(232,120,96,0.1);
      --radius: 12px;
    }
    [data-theme="light"] {
      --bg: #f5f1eb; --surface: rgba(0,0,0,0.03); --surface-2: rgba(0,0,0,0.06);
      --border: rgba(0,0,0,0.10); --border-hover: rgba(0,0,0,0.20);
      --text: #1a1a2e; --text-muted: rgba(26,26,46,0.5);
      --warm: #c47e20; --warm-glow: #b06e18; --teal: #2a8a98;
      --green: #2a9860; --green-bg: rgba(42,152,96,0.1);
      --red: #c24444; --red-bg: rgba(194,68,68,0.1);
      --yellow: #b89820; --yellow-bg: rgba(184,152,32,0.1);
      --blue: #3a7ec0; --blue-bg: rgba(58,126,192,0.1);
      --coral: #c25840; --coral-bg: rgba(194,88,64,0.1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, sans-serif; background: var(--bg);
      color: var(--text); min-height: 100vh; position: relative; overflow-x: hidden;
    }
    /* Sunrise aurora + mountain range background */
    body::before {
      content: ''; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background:
        /* Sunrise glow — golden center, sky blue edges */
        radial-gradient(ellipse at 50% 25%, rgba(240,200,80,0.22) 0%, transparent 45%),
        radial-gradient(ellipse at 25% 10%, rgba(91,168,230,0.20) 0%, transparent 50%),
        radial-gradient(ellipse at 75% 8%, rgba(77,184,199,0.18) 0%, transparent 45%),
        /* Coral/amber horizon band */
        radial-gradient(ellipse at 50% 40%, rgba(232,120,96,0.14) 0%, transparent 40%),
        radial-gradient(ellipse at 35% 30%, rgba(230,164,74,0.12) 0%, transparent 35%);
      pointer-events: none; z-index: 0; filter: blur(40px);
      animation: auroraShift 18s ease-in-out infinite alternate;
    }
    @keyframes auroraShift {
      0% { opacity: 0.85; transform: translateY(0); }
      33% { opacity: 1; transform: translateY(-8px) scaleX(1.02); }
      66% { opacity: 0.9; transform: translateY(4px) scaleX(0.98); }
      100% { opacity: 0.95; transform: translateY(-4px); }
    }
    body::after {
      content: ''; position: fixed; bottom: 0; left: 0; right: 0; height: 50vh;
      background:
        /* Far range — tall distant peaks */
        linear-gradient(168deg, transparent 12%,
          rgba(30,45,70,0.18) 26%, rgba(30,45,70,0.18) 27%, transparent 27.5%,
          transparent 30%,
          rgba(25,40,65,0.20) 36%, rgba(25,40,65,0.20) 37%, transparent 37.5%,
          transparent 40%,
          rgba(30,45,70,0.16) 44%, rgba(30,45,70,0.16) 45%, transparent 45.5%),
        /* Mid range — rocky ridges */
        linear-gradient(175deg, transparent 30%,
          rgba(35,50,75,0.25) 45%, rgba(35,50,75,0.25) 46%, transparent 46.5%,
          transparent 50%,
          rgba(30,45,68,0.28) 56%, rgba(30,45,68,0.28) 57%, transparent 57.5%,
          transparent 60%,
          rgba(35,50,75,0.22) 65%, rgba(35,50,75,0.22) 66%, transparent 66.5%),
        /* Near range — prominent foreground peaks */
        linear-gradient(185deg, transparent 40%,
          rgba(20,35,58,0.32) 55%, rgba(20,35,58,0.32) 56%, transparent 56.5%,
          transparent 62%,
          rgba(15,30,52,0.36) 72%, rgba(15,30,52,0.36) 73%, transparent 73.5%),
        /* Opposing slope (right-leaning peaks for variety) */
        linear-gradient(195deg, transparent 35%,
          rgba(25,42,62,0.20) 50%, rgba(25,42,62,0.20) 51%, transparent 51.5%,
          transparent 58%,
          rgba(20,38,58,0.26) 68%, rgba(20,38,58,0.26) 69%, transparent 69.5%),
        /* Base haze — warm sunrise glow behind mountains */
        linear-gradient(to top, rgba(15,25,45,0.45) 0%, rgba(50,40,60,0.20) 30%, rgba(230,160,70,0.06) 50%, transparent 70%);
      pointer-events: none; z-index: 0;
    }
    [data-theme="light"] body::before {
      background:
        radial-gradient(ellipse at 50% 25%, rgba(240,200,80,0.10) 0%, transparent 45%),
        radial-gradient(ellipse at 25% 10%, rgba(91,168,230,0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 75% 8%, rgba(77,184,199,0.08) 0%, transparent 45%),
        radial-gradient(ellipse at 50% 40%, rgba(232,120,96,0.06) 0%, transparent 40%);
      filter: blur(40px);
    }
    [data-theme="light"] body::after {
      background:
        linear-gradient(168deg, transparent 12%,
          rgba(80,95,130,0.08) 26%, rgba(80,95,130,0.08) 27%, transparent 27.5%,
          transparent 36%,
          rgba(75,90,125,0.10) 44%, rgba(75,90,125,0.10) 45%, transparent 45.5%),
        linear-gradient(175deg, transparent 30%,
          rgba(85,100,135,0.10) 45%, rgba(85,100,135,0.10) 46%, transparent 46.5%,
          transparent 56%,
          rgba(80,95,128,0.12) 65%, rgba(80,95,128,0.12) 66%, transparent 66.5%),
        linear-gradient(185deg, transparent 40%,
          rgba(70,85,118,0.14) 55%, rgba(70,85,118,0.14) 56%, transparent 56.5%,
          transparent 72%,
          rgba(65,80,112,0.16) 80%, rgba(65,80,112,0.16) 81%, transparent 81.5%),
        linear-gradient(to top, rgba(80,90,120,0.10) 0%, rgba(90,85,100,0.05) 30%, transparent 60%);
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .btn-loading { position: relative; color: transparent !important; pointer-events: none; }
    .btn-loading::after {
      content: ''; position: absolute; top: 50%; left: 50%; width: 14px; height: 14px;
      margin: -7px 0 0 -7px; border: 2px solid var(--warm); border-top-color: transparent;
      border-radius: 50%; animation: spin 0.6s linear infinite;
    }
    .container { max-width: 1060px; margin: 0 auto; padding: 24px 20px; position: relative; z-index: 1; }
    a { color: var(--warm); text-decoration: none; transition: color 0.2s; }
    a:hover { color: var(--text); }

    .topnav { display: flex; align-items: center; justify-content: space-between;
              padding: 20px 0; margin-bottom: 40px; }
    .topnav .logo { font-weight: 300; font-size: 13px; letter-spacing: 2px;
                    text-transform: uppercase; color: var(--text-muted); }
    .topnav .nav-links { display: flex; gap: 24px; font-size: 13px; font-weight: 400;
                         letter-spacing: 0.5px; }
    .topnav .nav-links a { color: var(--text-muted); }
    .topnav .nav-links a:hover { color: var(--text); }
    .topnav .nav-links a.active { color: var(--warm); }

    h1 { font-size: 42px; font-weight: 300; letter-spacing: -0.5px; margin-bottom: 8px; }
    .subtitle { color: var(--text-muted); margin-bottom: 36px; font-size: 15px; font-weight: 300; letter-spacing: 0.3px; }

    .top-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                 gap: 16px; margin-bottom: 36px; }
    .card { padding: 24px; border-radius: var(--radius); background: var(--surface);
            border: 1px solid var(--border); transition: all 0.3s ease; backdrop-filter: blur(12px); }
    .card:hover { border-color: var(--border-hover); background: var(--surface-2); }
    .card .label { font-size: 10px; color: var(--text-muted); text-transform: uppercase;
                   letter-spacing: 1.5px; font-weight: 500; }
    .card .value { font-size: 28px; font-weight: 300; margin-top: 8px;
                   font-variant-numeric: tabular-nums; letter-spacing: -1px; }
    .card .value.warm { color: var(--warm-glow); }
    .card .value.teal { color: var(--teal); }
    .card .value.green { color: var(--green); }
    .card .value.red { color: var(--red); }
    .card .sub { font-size: 11px; color: var(--text-muted); margin-top: 4px; font-weight: 300; }

    .actions { display: flex; gap: 10px; margin-bottom: 28px; flex-wrap: wrap; align-items: center; }
    .actions button, .actions .btn {
      padding: 9px 18px; font-size: 12px; font-weight: 500; letter-spacing: 0.5px;
      border: 1px solid var(--border); border-radius: 8px; cursor: pointer;
      background: transparent; color: var(--text-muted); transition: all 0.2s; text-transform: uppercase;
      font-family: inherit; text-decoration: none; display: inline-block;
    }
    .actions button:hover:not(:disabled), .actions .btn:hover { border-color: var(--warm); color: var(--text); }
    .actions button.primary, .actions .btn.primary { border-color: var(--warm); color: var(--warm); }
    .actions button.primary:hover:not(:disabled), .actions .btn.primary:hover { background: rgba(230,164,74,0.1); color: var(--text); }
    .actions button:disabled { opacity: 0.3; cursor: not-allowed; }

    .status-msg { padding: 14px 18px; border-radius: 8px; margin-bottom: 20px; display: none;
                  font-size: 13px; font-weight: 400; }
    .status-msg.success { background: var(--green-bg); border: 1px solid rgba(111,207,151,0.15);
                          color: var(--green); display: block; }
    .status-msg.error { background: var(--red-bg); border: 1px solid rgba(235,107,107,0.15);
                        color: var(--red); display: block; }

    .section { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
               padding: 24px; margin-bottom: 24px; backdrop-filter: blur(12px); }
    .section h2 { font-size: 10px; font-weight: 500; color: var(--text-muted); text-transform: uppercase;
                  letter-spacing: 1.5px; margin-bottom: 16px; }

    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 10px 12px; font-size: 9px; color: var(--text-muted);
         text-transform: uppercase; letter-spacing: 1.5px; font-weight: 500;
         border-bottom: 1px solid var(--border); }
    td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 13px; font-weight: 300; }
    tr { transition: background 0.15s; }
    tr:hover { background: var(--surface); }

    .empty-msg { text-align: center; padding: 40px; color: var(--text-muted); font-weight: 300; font-size: 14px; }

    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 10px;
             font-weight: 500; text-transform: uppercase; letter-spacing: 0.8px; }
    .badge.urgent { background: var(--red-bg); color: var(--red); }
    .badge.high { background: var(--yellow-bg); color: var(--yellow); }
    .badge.medium { background: var(--blue-bg); color: var(--blue); }
    .badge.low { background: var(--green-bg); color: var(--green); }
    .badge.draft { background: var(--blue-bg); color: var(--blue); }
    .badge.scheduled { background: var(--yellow-bg); color: var(--yellow); }
    .badge.sent { background: var(--green-bg); color: var(--green); }
    .badge.failed { background: var(--red-bg); color: var(--red); }
    .badge.short { background: var(--green-bg); color: var(--green); }
    .badge.long { background: var(--blue-bg); color: var(--blue); }

    /* Modal */
    .modal-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                     background: rgba(0,0,0,0.6); z-index: 100; backdrop-filter: blur(4px);
                     align-items: center; justify-content: center; }
    .modal-overlay.active { display: flex; }
    .modal { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius);
             padding: 32px; width: 90%; max-width: 540px; max-height: 90vh; overflow-y: auto; }
    .modal h2 { font-size: 20px; font-weight: 300; margin-bottom: 24px; }
    .modal label { display: block; font-size: 10px; color: var(--text-muted); text-transform: uppercase;
                   letter-spacing: 1.5px; font-weight: 500; margin-bottom: 6px; margin-top: 16px; }
    .modal label:first-of-type { margin-top: 0; }
    .modal input, .modal select, .modal textarea {
      width: 100%; padding: 10px 14px; font-size: 14px; font-family: inherit;
      background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
      color: var(--text); outline: none; transition: border-color 0.2s;
    }
    .modal input:focus, .modal select:focus, .modal textarea:focus { border-color: var(--warm); }
    .modal textarea { min-height: 100px; resize: vertical; }
    .modal .modal-actions { display: flex; gap: 10px; margin-top: 24px; justify-content: flex-end; }
    .modal .modal-actions button { padding: 10px 20px; font-size: 13px; font-weight: 500;
      border: 1px solid var(--border); border-radius: 8px; cursor: pointer;
      background: transparent; color: var(--text-muted); font-family: inherit; transition: all 0.2s; }
    .modal .modal-actions button.primary { border-color: var(--warm); color: var(--warm); }
    .modal .modal-actions button.primary:hover { background: rgba(230,164,74,0.1); }
    .modal .modal-actions button.danger { border-color: var(--red); color: var(--red); }
    .modal .modal-actions button.danger:hover { background: var(--red-bg); }

    /* Todo-specific */
    .todo-item { display: flex; align-items: flex-start; gap: 12px; padding: 14px 0;
                 border-bottom: 1px solid rgba(255,255,255,0.04); }
    .todo-item:last-child { border-bottom: none; }
    .todo-check { width: 28px; height: 28px; min-width: 28px; border: 2px solid var(--border); border-radius: 50%;
                  cursor: pointer; flex-shrink: 0; margin-top: 2px; transition: all 0.2s;
                  display: flex; align-items: center; justify-content: center;
                  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
                  padding: 8px; box-sizing: content-box; }
    .todo-check:hover { border-color: var(--warm); }
    .todo-check:active { transform: scale(0.9); }
    .todo-check.done { border-color: var(--green); background: var(--green); }
    .todo-check.done::after { content: '\\2713'; color: var(--bg); font-size: 14px; font-weight: 700; }
    .todo-content { flex: 1; min-width: 0; }
    .todo-title { font-size: 14px; font-weight: 400; }
    .todo-title.done { text-decoration: line-through; opacity: 0.4; }
    .todo-meta { font-size: 11px; color: var(--text-muted); margin-top: 4px; display: flex; gap: 12px; flex-wrap: wrap; }
    .todo-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .todo-actions button { background: none; border: none; color: var(--text-muted); cursor: pointer;
                           font-size: 14px; padding: 10px; transition: color 0.2s;
                           -webkit-tap-highlight-color: transparent; touch-action: manipulation;
                           min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center; }
    .todo-actions button:hover { color: var(--text); }
    .todo-actions button.delete:hover { color: var(--red); }

    /* Note card grid */
    .notes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
    .note-card { padding: 20px; border-radius: var(--radius); background: var(--surface);
                 border: 1px solid var(--border); transition: all 0.3s; cursor: pointer; }
    .note-card:hover { border-color: var(--border-hover); background: var(--surface-2); }
    .note-card.pinned { border-color: var(--warm); }
    .note-card .note-title { font-size: 14px; font-weight: 500; margin-bottom: 8px; }
    .note-card .note-preview { font-size: 12px; color: var(--text-muted); font-weight: 300;
                               line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 4;
                               -webkit-box-orient: vertical; overflow: hidden; }
    .note-card .note-preview.md { display: block; max-height: 80px; }
    .note-card .note-preview.md h2, .note-card .note-preview.md h3, .note-card .note-preview.md h4 { margin: 2px 0; }
    .md-badge { display: inline-block; font-size: 9px; padding: 1px 6px; border-radius: 8px; background: var(--surface-2); color: var(--teal); border: 1px solid var(--teal); margin-left: 6px; vertical-align: middle; }
    .note-card .note-date { font-size: 10px; color: var(--text-muted); margin-top: 12px;
                            text-transform: uppercase; letter-spacing: 0.5px; }

    /* Filters */
    .filters { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
    .filters button { padding: 6px 14px; font-size: 11px; font-weight: 500; letter-spacing: 0.5px;
      border: 1px solid var(--border); border-radius: 20px; cursor: pointer;
      background: transparent; color: var(--text-muted); font-family: inherit; transition: all 0.2s; }
    .filters button:hover { border-color: var(--warm); color: var(--text); }
    .filters button.active { border-color: var(--warm); color: var(--warm); background: rgba(230,164,74,0.08); }

    /* Subtasks */
    .subtask-list { margin-top: 8px; padding-left: 32px; }
    .subtask-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 12px; }
    .subtask-check { width: 20px; height: 20px; min-width: 20px; border: 1.5px solid var(--border); border-radius: 50%;
                     cursor: pointer; flex-shrink: 0; transition: all 0.2s;
                     display: flex; align-items: center; justify-content: center;
                     -webkit-tap-highlight-color: transparent; touch-action: manipulation;
                     padding: 10px; box-sizing: content-box; }
    .subtask-check:hover { border-color: var(--warm); }
    .subtask-check:active { transform: scale(0.9); }
    .subtask-check.done { border-color: var(--green); background: var(--green); }
    .subtask-check.done::after { content: '\\2713'; color: var(--bg); font-size: 10px; font-weight: 700; }
    .subtask-text { flex: 1; min-width: 0; }
    .subtask-text.done { text-decoration: line-through; opacity: 0.4; }
    .subtask-edit-btn { background: none; border: none; color: var(--text-muted); cursor: pointer;
                        font-size: 12px; padding: 8px; -webkit-tap-highlight-color: transparent;
                        touch-action: manipulation; transition: color 0.2s; }
    .subtask-edit-btn:hover { color: var(--warm); }
    .subtask-add { font-size: 11px; color: var(--text-muted); cursor: pointer; padding: 8px 0;
                   -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
    .subtask-add:hover { color: var(--warm); }
    .subtask-progress { height: 3px; background: var(--surface-2); border-radius: 2px; margin-top: 6px; overflow: hidden; }
    .subtask-progress-fill { height: 100%; background: var(--green); border-radius: 2px; transition: width 0.3s; }

    /* Calendar */
    .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .cal-header { text-align: center; font-size: 10px; color: var(--text-muted); text-transform: uppercase;
                  letter-spacing: 1px; padding: 8px 0; font-weight: 500; }
    .cal-day { min-height: 80px; padding: 6px; border-radius: 6px; background: var(--surface);
               border: 1px solid transparent; transition: all 0.2s; cursor: pointer; }
    .cal-day:hover { border-color: var(--border-hover); }
    .cal-day.today { border-color: var(--warm); }
    .cal-day.other-month { opacity: 0.3; }
    .cal-day-num { font-size: 11px; font-weight: 500; margin-bottom: 4px; }
    .cal-event { font-size: 9px; padding: 2px 4px; border-radius: 3px; margin-bottom: 2px;
                 white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cal-event.todo { background: var(--blue-bg); color: var(--blue); }
    .cal-event.todo.recurring-proj { background: rgba(160,140,212,0.12); color: var(--warm); border: 1px dashed var(--warm); }
    .cal-event.email { background: var(--yellow-bg); color: var(--yellow); }
    .cal-event.note { background: var(--green-bg); color: var(--green); }

    /* Search */
    .search-bar { position: relative; margin-bottom: 24px; }
    .search-bar input { width: 100%; padding: 12px 16px 12px 40px; font-size: 14px; font-family: inherit;
                        background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
                        color: var(--text); outline: none; transition: border-color 0.2s; }
    .search-bar input:focus { border-color: var(--warm); }
    .search-bar .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
                               color: var(--text-muted); font-size: 16px; }
    .search-results .result-item { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.04);
                                   cursor: pointer; transition: background 0.15s; }
    .search-results .result-item:hover { background: var(--surface); }
    .search-results .result-type { font-size: 9px; text-transform: uppercase; letter-spacing: 1px;
                                   color: var(--text-muted); margin-bottom: 4px; }

    /* Drag and drop */
    .todo-item.dragging { opacity: 0.4; }
    .todo-item.drag-over { border-top: 2px solid var(--warm); }
    .drag-handle { cursor: grab; color: var(--text-muted); font-size: 14px; padding: 4px;
                   user-select: none; flex-shrink: 0; }
    .drag-handle:active { cursor: grabbing; }

    /* Keyboard shortcut hint */
    .kbd { display: inline-block; padding: 2px 6px; background: var(--surface-2); border: 1px solid var(--border);
           border-radius: 4px; font-size: 10px; font-family: monospace; color: var(--text-muted); }

    /* Recurring badge */
    .badge.recurring { background: rgba(212,165,116,0.1); color: var(--warm); }
    .badge.streak { background: rgba(76,175,80,0.1); color: var(--green); }
    .badge.blocked { background: rgba(239,83,80,0.1); color: var(--red); }
    .badge.blocking { background: rgba(255,193,7,0.1); color: var(--yellow); }
    .todo-blocked { opacity: 0.65; }

    @media (max-width: 768px) {
      .topnav { flex-direction: column; gap: 12px; align-items: flex-start; }
      .topnav .nav-links { display: none; gap: 16px; flex-wrap: wrap; }
      .topnav .nav-links.mobile-open { display: flex; }
      .topnav .mobile-toggle { display: block; }
      h1 { font-size: 28px; }
      .top-cards { grid-template-columns: repeat(2, 1fr); }
      .notes-grid { grid-template-columns: 1fr; }
      .modal { width: 95%; padding: 24px; }
      .cal-day { min-height: 50px; }
      .cal-event { font-size: 8px; }
      .container { padding: 16px 12px; }
      .todo-item { padding: 14px; }
      .filters button { padding: 8px 16px; font-size: 12px; }
      .subtask-list { padding-left: 16px; }
      .drag-handle { display: none; }
      .dash-two-col { grid-template-columns: 1fr !important; }
      .mobile-fab { display: flex !important; }
      .bottom-nav { display: flex !important; }
      body { padding-bottom: 70px; }
    }
    @media (max-width: 480px) {
      .topnav .nav-links { gap: 12px; font-size: 12px; }
      .topnav .nav-links a { padding: 6px 0; }
      h1 { font-size: 22px; }
      .top-cards { grid-template-columns: 1fr; }
      .modal { width: 98%; padding: 16px; }
      .section { padding: 16px; }
      .todo-meta { gap: 8px; }
      .badge { font-size: 9px; padding: 2px 6px; }
      .filters { gap: 6px; overflow-x: auto; flex-wrap: nowrap; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 4px; }
      .filters::-webkit-scrollbar { display: none; }
      .filters button { padding: 6px 12px; font-size: 11px; white-space: nowrap; }
      .cal-grid { font-size: 10px; }
      .cal-day { min-height: 40px; padding: 3px; }
      .actions { gap: 6px; }
      .actions button, .actions .btn { padding: 8px 14px; font-size: 11px; }
    }
    @media (max-width: 360px) {
      .container { padding: 12px 8px; }
      h1 { font-size: 20px; }
      .topnav .nav-links { gap: 10px; font-size: 11px; }
      .modal { padding: 12px; }
    }

    /* Mobile bottom navigation */
    .bottom-nav { display: none; position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg);
                  border-top: 1px solid var(--border); z-index: 99; justify-content: space-around;
                  padding: 8px 0 env(safe-area-inset-bottom, 8px); backdrop-filter: blur(20px); }
    .bottom-nav a { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 12px;
                    font-size: 9px; color: var(--text-muted); text-decoration: none; letter-spacing: 0.5px;
                    text-transform: uppercase; font-weight: 500; transition: color 0.2s;
                    -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
    .bottom-nav a .nav-icon { font-size: 18px; }
    .bottom-nav a.active { color: var(--warm); }
    .bottom-nav a:hover { color: var(--text); }

    /* Mobile FAB (floating action button) */
    .mobile-fab { display: none !important; position: fixed; bottom: 80px; right: 20px; width: 52px; height: 52px;
                  border-radius: 50%; background: var(--warm); color: #fff; border: none; font-size: 26px;
                  cursor: pointer; z-index: 98; box-shadow: 0 4px 16px rgba(0,0,0,0.3); align-items: center;
                  justify-content: center; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
    .mobile-fab:active { transform: scale(0.92); }

    /* Mobile hamburger */
    .topnav .mobile-toggle { display: none; background: none; border: none; color: var(--text); font-size: 22px;
                              cursor: pointer; padding: 8px; -webkit-tap-highlight-color: transparent; }

    /* Swipe gesture hint */
    .swipe-hint { display: none; }
    @media (max-width: 768px) {
      .swipe-hint { display: block; font-size: 10px; color: var(--text-muted); text-align: center; padding: 4px; }
    }

    /* ============================================================ */
    /* Enhanced glassmorphism & glow effects                        */
    /* ============================================================ */

    /* Glow border on hover for cards and sections */
    .card { position: relative; overflow: hidden; }
    .card::before {
      content: ''; position: absolute; top: -1px; left: -1px; right: -1px; bottom: -1px;
      border-radius: var(--radius); opacity: 0; transition: opacity 0.4s ease;
      background: linear-gradient(135deg, rgba(230,164,74,0.3), rgba(77,184,199,0.3), rgba(92,201,138,0.2));
      z-index: -1; filter: blur(8px);
    }
    .card:hover::before { opacity: 1; }

    .section { position: relative; overflow: hidden; }
    .section::before {
      content: ''; position: absolute; top: -1px; left: -1px; right: -1px; bottom: -1px;
      border-radius: var(--radius); opacity: 0; transition: opacity 0.4s ease;
      background: linear-gradient(135deg, rgba(230,164,74,0.15), rgba(77,184,199,0.15));
      z-index: -1; filter: blur(12px);
    }
    .section:hover::before { opacity: 1; }

    /* Enhanced modal glassmorphism */
    .modal { backdrop-filter: blur(24px); background: rgba(11,14,24,0.85); }
    [data-theme="light"] .modal { background: rgba(245,241,235,0.9); }

    /* Glowing focus states */
    input:focus, select:focus, textarea:focus {
      box-shadow: 0 0 0 3px rgba(230,164,74,0.15), 0 0 20px rgba(91,168,230,0.1);
    }
    .search-bar input:focus { box-shadow: 0 0 0 3px rgba(230,164,74,0.15), 0 0 30px rgba(91,168,230,0.08); }

    /* Subtle glow on primary buttons */
    .actions button.primary { box-shadow: 0 0 12px rgba(230,164,74,0.15); }
    .actions button.primary:hover:not(:disabled) { box-shadow: 0 0 20px rgba(230,164,74,0.25); }

    /* ============================================================ */
    /* Productivity Tree — Isometric 3D animated SVG                */
    /* ============================================================ */

    .tree-widget {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 32px 24px 24px; position: relative; overflow: visible;
    }
    .tree-container {
      position: relative; width: 280px; height: 280px;
      perspective: 800px; transform-style: preserve-3d;
      overflow: hidden;
    }
    .tree-svg {
      width: 100%; height: 100%;
      filter: drop-shadow(0 20px 40px rgba(77,184,199,0.2)) drop-shadow(0 8px 16px rgba(230,164,74,0.15));
      animation: treeFloat 6s ease-in-out infinite;
    }
    @keyframes treeFloat {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-8px); }
    }

    /* Tree glow ring beneath */
    .tree-glow {
      position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);
      width: 160px; height: 40px; border-radius: 50%;
      background: radial-gradient(ellipse, rgba(255,150,180,0.25) 0%, rgba(255,200,210,0.15) 40%, transparent 70%);
      filter: blur(10px); animation: glowPulse 4s ease-in-out infinite;
    }
    @keyframes glowPulse {
      0%, 100% { opacity: 0.6; transform: translateX(-50%) scale(1); }
      50% { opacity: 1; transform: translateX(-50%) scale(1.1); }
    }

    /* Tree leaf shimmer */
    @keyframes leafShimmer {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }
    .tree-leaf { animation: leafShimmer 3s ease-in-out infinite; }
    .tree-leaf:nth-child(2n) { animation-delay: -1s; }
    .tree-leaf:nth-child(3n) { animation-delay: -2s; }

    /* Particle effect around tree */
    @keyframes particleFloat {
      0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
      20% { opacity: 1; }
      80% { opacity: 1; }
      100% { transform: translateY(-60px) translateX(20px) scale(0); opacity: 0; }
    }
    .tree-particle {
      position: absolute; width: 4px; height: 4px; border-radius: 50%;
      background: var(--green); animation: particleFloat 4s ease-out infinite;
    }
    .tree-particle:nth-child(1) { left: 35%; bottom: 40%; animation-delay: 0s; }
    .tree-particle:nth-child(2) { left: 55%; bottom: 45%; animation-delay: -1.3s; background: var(--teal); }
    .tree-particle:nth-child(3) { left: 45%; bottom: 35%; animation-delay: -2.6s; background: var(--warm); }

    /* Falling cherry blossom petals */
    @keyframes petalFall {
      0% { transform: translateY(-20px) translateX(0) rotate(0deg) scale(1); opacity: 0; }
      10% { opacity: 0.8; }
      50% { transform: translateY(120px) translateX(30px) rotate(180deg) scale(0.8); opacity: 0.6; }
      100% { transform: translateY(260px) translateX(-10px) rotate(360deg) scale(0.5); opacity: 0; }
    }
    .falling-petal {
      position: absolute; width: 6px; height: 8px; border-radius: 50% 50% 50% 0;
      background: rgba(255,180,200,0.7); z-index: 2;
      animation: petalFall 6s ease-in-out infinite;
      pointer-events: none;
    }
    .falling-petal:nth-child(4) { left: 40%; top: 25%; animation-delay: 0s; background: rgba(255,200,215,0.6); width: 5px; height: 7px; }
    .falling-petal:nth-child(5) { left: 55%; top: 20%; animation-delay: -1.2s; background: rgba(255,160,185,0.7); width: 7px; height: 9px; }
    .falling-petal:nth-child(6) { left: 35%; top: 30%; animation-delay: -2.5s; background: rgba(255,220,230,0.5); width: 5px; height: 6px; }
    .falling-petal:nth-child(7) { left: 60%; top: 22%; animation-delay: -3.8s; background: rgba(255,170,195,0.65); width: 6px; height: 8px; }
    .falling-petal:nth-child(8) { left: 45%; top: 28%; animation-delay: -4.5s; background: rgba(255,190,210,0.55); width: 4px; height: 6px; }
    .falling-petal:nth-child(9) { left: 50%; top: 18%; animation-delay: -5.2s; background: rgba(255,210,220,0.6); width: 6px; height: 7px; }

    /* Energy pulse traveling up the tree */
    @keyframes energyPulseUp {
      0% { stroke-dashoffset: 120; opacity: 0; }
      10% { opacity: 1; }
      80% { opacity: 0.8; }
      100% { stroke-dashoffset: 0; opacity: 0; }
    }
    .energy-pulse {
      stroke-dasharray: 15 105;
      animation: energyPulseUp 3s ease-in-out infinite;
      filter: url(#energy-glow);
    }
    .energy-pulse:nth-child(2) { animation-delay: -1s; }
    .energy-pulse:nth-child(3) { animation-delay: -2s; }

    @keyframes energyBranchPulse {
      0% { stroke-dashoffset: 60; opacity: 0; }
      15% { opacity: 0.9; }
      85% { opacity: 0.6; }
      100% { stroke-dashoffset: 0; opacity: 0; }
    }
    .energy-branch-pulse {
      stroke-dasharray: 10 50;
      animation: energyBranchPulse 2.5s ease-in-out infinite;
      filter: url(#energy-glow);
    }

    /* Stats beneath tree */
    .tree-stats {
      display: flex; gap: 24px; justify-content: center; margin-top: 16px;
      font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;
    }
    .tree-stat-value { font-size: 20px; font-weight: 300; color: var(--text); display: block;
                       margin-top: 4px; font-variant-numeric: tabular-nums; }
    .tree-stat-value.glow-green { color: var(--green); text-shadow: 0 0 12px rgba(92,201,138,0.4); }
    .tree-stat-value.glow-warm { color: var(--warm); text-shadow: 0 0 12px rgba(230,164,74,0.4); }
    .tree-stat-value.glow-teal { color: var(--teal); text-shadow: 0 0 12px rgba(77,184,199,0.4); }

    .tree-status-msg {
      text-align: center; margin-top: 12px; font-size: 12px; font-weight: 300;
      color: var(--text-muted); font-style: italic;
    }

    /* Light theme tree adjustments */
    [data-theme="light"] .tree-glow {
      background: radial-gradient(ellipse, rgba(220,100,140,0.2) 0%, rgba(200,120,150,0.12) 40%, transparent 70%);
    }
    [data-theme="light"] .tree-particle { opacity: 0.6; }

    @media (max-width: 480px) {
      .tree-container { width: 200px; height: 200px; }
      .tree-stats { gap: 16px; font-size: 10px; }
      .tree-stat-value { font-size: 16px; }
      .tree-widget { padding: 20px 16px 16px; }
    }
`;

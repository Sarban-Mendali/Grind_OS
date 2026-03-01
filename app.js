'use strict';

// ── CONSTANTS ──────────────────────────────────────────────
const SUBJECTS = ['DSA', 'OS', 'CN', 'DBMS', 'DiscreteMaths'];
const SUBJECT_LABELS = { DSA: 'DSA', OS: 'OS', CN: 'CN', DBMS: 'DBMS', DiscreteMaths: 'Disc. Maths' };
const TOPIC_MAP = {
  DSA: ['Arrays', 'LinkedList', 'Trees', 'Graphs', 'DP', 'Sorting', 'Heaps', 'Tries', 'Backtracking'],
  OS: ['Processes', 'Threads', 'Scheduling', 'Deadlocks', 'Memory', 'FileSystem', 'Sync', 'Paging', 'IPC'],
  CN: ['TCP/IP', 'DNS', 'HTTP/S', 'Routing', 'OSI Model', 'Security', 'Sockets', 'UDP', 'Subnetting'],
  DBMS: ['SQL', 'Normalization', 'Transactions', 'Indexing', 'ACID', 'ER Model', 'Joins', 'NoSQL', 'Query Opt'],
  DiscreteMaths: ['Logic', 'Sets', 'Relations', 'Graphs', 'Counting', 'Probability', 'Groups', 'Proofs', 'Recurrence'],
};
const SUBJECT_COLORS = { DSA: '#00cfff', OS: '#bf5fff', CN: '#ffe600', DBMS: '#ff7b00', DiscreteMaths: '#00ff87', Other: '#8b949e' };
const SCORE_TIERS = [
  { min: 90, label: 'GRANDMASTER', color: '#ffe600' },
  { min: 75, label: 'ELITE', color: '#00cfff' },
  { min: 60, label: 'ADVANCED', color: '#bf5fff' },
  { min: 45, label: 'PROFICIENT', color: '#00ff87' },
  { min: 30, label: 'DEVELOPING', color: '#ff7b00' },
  { min: 15, label: 'ROOKIE', color: '#ff3d5a' },
  { min: 0, label: 'BEGINNER', color: '#8b949e' },
];
const CONF_LABELS = ['', 'Barely know it', 'Getting there', 'Understand it', 'Confident', 'Mastered it!'];
const PANELS = ['dashboard', 'study', 'streak', 'subjects', 'focus', 'journal', 'analytics', 'settings'];
const BREADCRUMBS = { dashboard: '/ dashboard', study: '/ study-tracker', streak: '/ coding-streak', subjects: '/ subjects-mastery', focus: '/ focus-mode', journal: '/ mistake-journal', analytics: '/ analytics', settings: '/ settings' };

// ── DEFAULT STATE ──────────────────────────────────────────
const DEFAULT_STATE = () => ({
  profile: { name: 'Grind_OS', targetScore: 80, dailyGoal: 4, streakGoal: 30, projectProgress: 0 },
  studyLog: [],
  streak: { currentDays: 0, longestDays: 0, totalDays: 0, log: {} },
  topics: Object.fromEntries(SUBJECTS.map(s => [s, { mastery: 20, cells: Object.fromEntries((TOPIC_MAP[s] || []).map(t => [t, 0])) }])),
  focusSessions: [],
  focusSettings: { workMin: 25, breakMin: 5 },
  mistakes: [],
  scoreHistory: [],
});

let state = loadState();
let chartInstances = {};
let selectedConf = 0;
let selectedRating = 0;

function loadState() {
  try {
    const raw = localStorage.getItem('grindboard_v4');
    if (raw) {
      const p = JSON.parse(raw);
      const d = DEFAULT_STATE();
      return { ...d, ...p, profile: { ...d.profile, ...(p.profile || {}) }, streak: { ...d.streak, ...(p.streak || {}) }, focusSettings: { ...d.focusSettings, ...(p.focusSettings || {}) }, topics: p.topics || d.topics };
    }
  } catch (e) { }
  return DEFAULT_STATE();
}
function saveState() { localStorage.setItem('grindboard_v4', JSON.stringify(state)); }

// ── POWER SCORE (0–100) ────────────────────────────────────
function computePowerScore() {
  const totalHours = state.studyLog.reduce((s, e) => s + e.hours, 0);
  const streakDays = state.streak.currentDays;
  const avgMastery = SUBJECTS.reduce((s, sub) => s + (state.topics[sub]?.mastery || 0), 0) / SUBJECTS.length;
  const focusCount = state.focusSessions.filter(s => s.type === 'work').length;
  const proj = state.profile.projectProgress || 0;

  // Weights: Study 30, Streak 20, Mastery 20, Focus 15, Project 15 = 100
  const studyPts = Math.min((totalHours / 200) * 30, 30);
  const streakPts = Math.min((streakDays / 30) * 20, 20);
  const masteryPts = Math.min((avgMastery / 100) * 20, 20);
  const focusPts = Math.min((focusCount / 50) * 15, 15);
  const projPts = Math.min((proj / 100) * 15, 15);
  const total = Math.min(Math.round(studyPts + streakPts + masteryPts + focusPts + projPts), 100);
  return { total, studyPts, streakPts, masteryPts, focusPts, projPts, totalHours, avgMastery, focusCount, streakDays, proj };
}

function updateScoreUI() {
  const sc = computePowerScore();
  const circumference = 534;
  const offset = circumference - (sc.total / 100) * circumference;
  const ring = document.getElementById('ring-fill');
  if (ring) ring.style.strokeDashoffset = offset;

  setText('score-num', sc.total);
  setText('topbar-score', sc.total);
  setText('greeting-score-num', sc.total);

  const tier = SCORE_TIERS.find(t => sc.total >= t.min) || SCORE_TIERS[SCORE_TIERS.length - 1];
  ['score-badge', 'greeting-score-badge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = tier.label; el.style.color = tier.color; el.style.borderColor = tier.color + '55'; el.style.background = tier.color + '15'; }
  });

  // Breakdown bars (show as % of max for that metric)
  setBar('br-study', sc.studyPts, 30); setText('br-pts-study', Math.round(sc.studyPts));
  setBar('br-streak', sc.streakPts, 20); setText('br-pts-streak', Math.round(sc.streakPts));
  setBar('br-mastery', sc.masteryPts, 20); setText('br-pts-mastery', Math.round(sc.masteryPts));
  setBar('br-focus', sc.focusPts, 15); setText('br-pts-focus', Math.round(sc.focusPts));
  setBar('br-project', sc.projPts, 15); setText('br-pts-project', Math.round(sc.projPts));

  // Stat cards
  setText('stat-val-study', Math.round(sc.totalHours * 10) / 10 + 'h');
  setText('stat-val-streak', state.streak.currentDays);
  setText('stat-val-mastery', Math.round(sc.avgMastery) + '%');
  setText('stat-val-focus', state.focusSessions.filter(s => s.type === 'work').length);
  setText('stat-val-mistakes', state.mistakes.length);
  const proj = state.profile.projectProgress || 0;
  setText('stat-val-project', proj + '%');
  const pb = document.getElementById('stat-pb-project');
  if (pb) pb.style.width = proj + '%';
  setText('stat-trend-streak', 'Longest: ' + state.streak.longestDays);
  const todayHrs = state.studyLog.filter(l => l.date === todayStr()).reduce((s, e) => s + e.hours, 0);
  setText('stat-trend-study', '+' + todayHrs.toFixed(1) + 'h today');

  // Daily status row
  setText('dsc-today-hours', todayHrs.toFixed(1) + 'h');
  setText('dsc-streak', state.streak.currentDays);
  setText('dsc-mastery', Math.round(sc.avgMastery) + '%');
  setText('dsc-focus', state.focusSessions.filter(s => s.type === 'work' && s.date === todayStr()).length);
  // Weakest subject
  const weakest = SUBJECTS.reduce((w, s) => ((state.topics[s]?.mastery || 0) < (state.topics[w]?.mastery || 100) ? s : w), SUBJECTS[0]);
  setText('dsc-weak', SUBJECT_LABELS[weakest]);

  // Greeting
  const name = state.profile.name || 'Grinder';
  const greetingName = document.getElementById('greeting-name');
  if (greetingName) greetingName.textContent = name;
  setText('profile-name-chip', name);
  const avatar = document.getElementById('profile-avatar-top');
  if (avatar) avatar.textContent = name[0].toUpperCase();

  // Focus launcher stats
  const workSessions = state.focusSessions.filter(s => s.type === 'work');
  setText('fl-sessions', workSessions.length);
  setText('fl-total-min', workSessions.reduce((a, e) => a + (e.duration || 0), 0));
  setText('fl-today-sessions', workSessions.filter(s => s.date === todayStr()).length);
}

function setBar(id, val, max) { const el = document.getElementById(id); if (el) el.style.width = Math.min((val / max) * 100, 100) + '%'; }
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function todayStr() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function fmtDate(s) { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; }
function masteryColor(v) { if (v >= 71) return '#00ff87'; if (v >= 41) return '#ffe600'; return '#ff3d5a'; }
function masteryClass(v) { if (v >= 71) return 'strong'; if (v >= 41) return 'avg'; return 'weak'; }

// ── ROUTER ─────────────────────────────────────────────────
function showPanel(id) {
  PANELS.forEach(p => {
    document.getElementById('panel-' + p)?.classList.remove('active');
    document.querySelector(`[data-panel="${p}"]`)?.classList.remove('active');
  });
  document.getElementById('panel-' + id)?.classList.add('active');
  document.querySelector(`[data-panel="${id}"]`)?.classList.add('active');
  setText('topbar-breadcrumb', BREADCRUMBS[id] || '/' + id);
  if (id === 'dashboard') renderDashboard();
  if (id === 'study') renderStudyPanel();
  if (id === 'streak') renderStreakGrid();
  if (id === 'subjects') renderSubjects();
  if (id === 'journal') renderMistakes();
  if (id === 'analytics') renderAnalytics();
  if (id === 'focus') renderFocusHistory();
  if (id === 'settings') renderSettings();
}

function showToast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show' + (type === 'error' ? ' error' : '');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 3000);
}

// ── CLOCK ──────────────────────────────────────────────────
function updateClock() {
  const n = new Date();
  setText('topbar-time', String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0') + ':' + String(n.getSeconds()).padStart(2, '0'));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  setText('sidebar-date', `${days[n.getDay()]} ${n.getDate()} ${months[n.getMonth()]} ${n.getFullYear()}`);
}

// ── DASHBOARD ──────────────────────────────────────────────
function renderDashboard() {
  updateScoreUI();
  renderRecentLog();
  injectRingGradient();
  const slider = document.getElementById('project-progress-slider');
  if (slider) { slider.value = state.profile.projectProgress || 0; setText('project-progress-val', slider.value + '%'); }
}
function injectRingGradient() {
  const svg = document.querySelector('.score-ring');
  if (!svg || svg.querySelector('defs')) return;
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `<linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#00ff87"/><stop offset="100%" stop-color="#00cfff"/></linearGradient>`;
  svg.insertBefore(defs, svg.firstChild);
  const fill = svg.querySelector('.ring-fill');
  if (fill) fill.setAttribute('stroke', 'url(#ring-gradient)');
}
function renderRecentLog() {
  const c = document.getElementById('recent-log-list');
  if (!c) return;
  const logs = [...state.studyLog].reverse().slice(0, 8);
  if (!logs.length) { c.innerHTML = '<div class="empty-state">No logs yet. Start tracking! 🚀</div>'; return; }
  c.innerHTML = logs.map((l, i) => `
    <div class="log-item">
      <span class="log-subject-tag tag-${l.subject}">${l.subject}</span>
      <span class="log-hours">${l.hours}h</span>
      <span class="log-note">${l.note || '—'}</span>
      <span class="log-date">${fmtDate(l.date)}</span>
      <button class="log-del" data-idx="${state.studyLog.length - 1 - i}">✕</button>
    </div>`).join('');
  c.querySelectorAll('.log-del').forEach(btn => btn.addEventListener('click', () => {
    state.studyLog.splice(+btn.dataset.idx, 1); saveState(); renderDashboard(); renderStudyPanel();
    showToast('Log deleted');
  }));
}

// ── STUDY PANEL ────────────────────────────────────────────
function renderStudyPanel() {
  renderStudyBarChart(); renderSubjectBreakdown(); renderStudyLogTable();
}
function renderStudyBarChart() {
  const ctx = document.getElementById('chart-study-bar'); if (!ctx) return;
  const labels = [], data = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    labels.push(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()] + ' ' + d.getDate());
    data.push(state.studyLog.filter(l => l.date === key).reduce((s, e) => s + e.hours, 0));
  }
  destroyChart('study-bar');
  chartInstances['study-bar'] = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ data, backgroundColor: data.map(v => v > 0 ? 'rgba(0,255,135,.6)' : 'rgba(255,255,255,.04)'), borderColor: 'rgba(0,255,135,.9)', borderWidth: 1, borderRadius: 4 }] }, options: chartDefaults({ scales: { y: { beginAtZero: true, ticks: { callback: v => v + 'h' } } } }) });
}
function renderSubjectBreakdown() {
  const c = document.getElementById('subject-bars'); if (!c) return;
  const totals = {}; let maxT = 0;
  SUBJECTS.concat(['Other']).forEach(s => { totals[s] = state.studyLog.filter(l => l.subject === s).reduce((a, e) => a + e.hours, 0); if (totals[s] > maxT) maxT = totals[s]; });
  const entries = Object.entries(totals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!entries.length) { c.innerHTML = '<div class="empty-state">No data yet</div>'; return; }
  c.innerHTML = entries.map(([s, v]) => `<div class="subject-bar-row"><div class="sbr-header"><span class="sbr-name">${SUBJECT_LABELS[s] || s}</span><span class="sbr-val">${v.toFixed(1)}h</span></div><div class="sbr-bar-wrap"><div class="sbr-bar" style="width:${(v / maxT) * 100}%;background:${SUBJECT_COLORS[s] || '#8b949e'}"></div></div></div>`).join('');
}
function renderStudyLogTable() {
  const filter = document.getElementById('log-filter-subject')?.value || 'all';
  const tbody = document.getElementById('study-log-tbody'); if (!tbody) return;
  let logs = [...state.studyLog].reverse();
  if (filter !== 'all') logs = logs.filter(l => l.subject === filter);
  if (!logs.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No logs match filter.</td></tr>'; return; }
  tbody.innerHTML = logs.map((l, i) => {
    const idx = state.studyLog.length - 1 - [...state.studyLog].reverse().indexOf(l);
    return `<tr><td style="font-family:var(--font-mono);font-size:11px;color:var(--t4)">${fmtDate(l.date)}</td><td><span class="log-subject-tag tag-${l.subject}" style="font-size:10px;padding:2px 8px">${l.subject}</span></td><td style="font-family:var(--font-mono);color:var(--g1)">${l.hours}h</td><td style="color:var(--t3)">${l.note || '—'}</td><td><button class="log-del" data-idx="${idx}">✕</button></td></tr>`;
  }).join('');
  tbody.querySelectorAll('.log-del').forEach(btn => btn.addEventListener('click', () => {
    state.studyLog.splice(+btn.dataset.idx, 1); saveState(); renderStudyPanel(); updateScoreUI(); showToast('Deleted');
  }));
}

// ── STREAK ─────────────────────────────────────────────────
function renderStreakGrid() {
  setText('streak-current', state.streak.currentDays);
  setText('streak-longest', state.streak.longestDays);
  setText('streak-total-days', state.streak.totalDays || 0);
  const grid = document.getElementById('streak-grid'); if (!grid) return;
  const today = new Date(); const weeks = 52; const cells = [];
  for (let w = weeks - 1; w >= 0; w--) {
    for (let d = 6; d >= 0; d--) {
      const date = new Date(today); date.setDate(today.getDate() - (w * 7 + d));
      const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
      const coded = state.streak.log[key] || 0; const isToday = (key === todayStr());
      const level = coded >= 4 ? 4 : coded >= 3 ? 3 : coded >= 2 ? 2 : coded >= 1 ? 1 : 0;
      cells.push({ key, level, isToday, date });
    }
  }
  grid.innerHTML = cells.map(c => `<div class="sc l${c.level}${c.isToday ? ' today' : ''}" title="${c.key}" data-date="${c.key}"></div>`).join('');
  const ml = document.getElementById('streak-month-labels');
  if (ml) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const seen = new Set(); let h = '';
    cells.filter((_, i) => i % 7 === 0).forEach(c => { const m = c.date.getMonth(); h += seen.has(m) ? `<span style="flex:0 0 1.9%"></span>` : `<span class="streak-month-label" style="flex:0 0 1.9%">${months[m]}</span>`; seen.add(m); });
    ml.innerHTML = h;
  }
}
function markCodedToday() {
  const key = todayStr();
  if (state.streak.log[key]) { showToast('Already marked today! 💪'); return; }
  state.streak.log[key] = (state.streak.log[key] || 0) + 1;
  let cur = 0; let d = new Date();
  while (true) { const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); if (state.streak.log[k]) { cur++; d.setDate(d.getDate() - 1); } else break; }
  state.streak.currentDays = cur; state.streak.longestDays = Math.max(state.streak.longestDays || 0, cur);
  state.streak.totalDays = Object.values(state.streak.log).filter(v => v > 0).length;
  saveState(); saveScoreSnapshot(); renderStreakGrid(); updateScoreUI(); showToast('🔥 Streak updated! Keep grinding!');
}

// ── SUBJECTS & MASTERY ─────────────────────────────────────
function renderSubjects() {
  const grid = document.getElementById('subjects-grid');
  const slidersWrap = document.getElementById('mastery-sliders-wrap');
  if (!grid) return;
  grid.innerHTML = SUBJECTS.map(sub => {
    const mastery = state.topics[sub]?.mastery ?? 20;
    const color = masteryColor(mastery);
    const topics = (TOPIC_MAP[sub] || []).map(t => {
      const val = state.topics[sub]?.cells?.[t] ?? 0;
      const cls = masteryClass(val);
      return `<span class="topic-pill ${cls}" data-sub="${sub}" data-topic="${t}">${t}</span>`;
    }).join('');
    return `<div class="subject-mastery-card" style="border-color:${color}22">
      <div class="smc-header"><span class="smc-name">${sub === 'DiscreteMaths' ? 'Discrete Maths' : sub}</span><span class="smc-pct" style="color:${color}">${mastery}%</span></div>
      <div class="smc-bar-wrap"><div class="smc-bar" style="width:${mastery}%;background:${color}"></div></div>
      <div class="smc-topics">${topics}</div>
    </div>`;
  }).join('');
  grid.querySelectorAll('.topic-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const sub = pill.dataset.sub; const topic = pill.dataset.topic;
      const cur = state.topics[sub].cells[topic] ?? 0;
      const next = cur < 41 ? 55 : cur < 71 ? 85 : 0;
      state.topics[sub].cells[topic] = next;
      const vals = Object.values(state.topics[sub].cells);
      state.topics[sub].mastery = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      saveState(); renderSubjects(); updateScoreUI();
    });
  });
  if (slidersWrap) {
    slidersWrap.innerHTML = SUBJECTS.map(sub => `
      <div class="mastery-slider-row">
        <span class="mastery-slider-label">${sub === 'DiscreteMaths' ? 'Disc. Maths' : sub}</span>
        <input type="range" class="slider mastery-slider-input" min="0" max="100" value="${state.topics[sub]?.mastery ?? 20}" data-sub="${sub}"/>
        <span class="mastery-slider-val" style="color:${masteryColor(state.topics[sub]?.mastery ?? 20)}" id="msv-${sub}">${state.topics[sub]?.mastery ?? 20}%</span>
      </div>`).join('');
    slidersWrap.querySelectorAll('.mastery-slider-input').forEach(slider => {
      slider.addEventListener('input', () => {
        const sub = slider.dataset.sub; const val = +slider.value;
        state.topics[sub].mastery = val;
        setText('msv-' + sub, val + '%');
        const el = document.getElementById('msv-' + sub); if (el) el.style.color = masteryColor(val);
        saveState(); updateScoreUI(); renderSubjects();
      });
    });
  }
}

// ── FOCUS MODE ─────────────────────────────────────────────
let focusTimer = null, focusSecondsLeft = 0, focusTotalSeconds = 0, focusIsWork = true, focusSessionNum = 1, focusRunning = false;

function initFocusTimer() {
  const s = state.focusSettings;
  focusSecondsLeft = s.workMin * 60; focusTotalSeconds = s.workMin * 60; focusIsWork = true; focusSessionNum = 1; focusRunning = false;
  selectedRating = 0; updateStarUI('star-btn');
  updateFocusDisplay();
}
function updateFocusDisplay() {
  const mm = String(Math.floor(focusSecondsLeft / 60)).padStart(2, '0');
  const ss = String(focusSecondsLeft % 60).padStart(2, '0');
  setText('focus-timer', `${mm}:${ss}`);
  setText('focus-session-num', focusSessionNum);
  const badge = document.getElementById('focus-mode-badge');
  if (badge) { badge.textContent = focusIsWork ? 'WORK SESSION' : 'BREAK TIME'; badge.className = 'focus-mode-badge' + (focusIsWork ? '' : ' break'); }
  const elapsed = focusTotalSeconds - focusSecondsLeft;
  const pct = (elapsed / focusTotalSeconds) * 100;
  const pb = document.getElementById('focus-progress-bar'); if (pb) pb.style.width = pct + '%';
  if (focusRunning) document.title = `[${mm}:${ss}] GrindBoard`;
  else document.title = 'GrindBoard – Academic Performance OS';
}
function focusTick() { if (focusSecondsLeft <= 0) { focusComplete(); return; } focusSecondsLeft--; updateFocusDisplay(); }
function focusComplete() {
  clearInterval(focusTimer); focusRunning = false; document.title = 'GrindBoard – Academic Performance OS';
  const notes = document.getElementById('focus-notes')?.value.trim() || '';
  const session = { type: focusIsWork ? 'work' : 'break', duration: focusIsWork ? state.focusSettings.workMin : state.focusSettings.breakMin, date: todayStr(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), notes, rating: selectedRating };
  state.focusSessions.push(session); saveState();
  addFocusLogChip(session);
  focusIsWork = !focusIsWork; if (focusIsWork) focusSessionNum++;
  const s = state.focusSettings; focusTotalSeconds = (focusIsWork ? s.workMin : s.breakMin) * 60; focusSecondsLeft = focusTotalSeconds;
  selectedRating = 0; updateStarUI('star-btn');
  if (document.getElementById('focus-notes')) document.getElementById('focus-notes').value = '';
  updateFocusDisplay(); updateScoreUI();
  if (!focusIsWork) setTimeout(() => startFocusTimer(), 800);
}
function addFocusLogChip(session) {
  const log = document.getElementById('focus-session-log'); if (!log) return;
  const empty = log.querySelector('.focus-log-empty'); if (empty) empty.remove();
  const chip = document.createElement('div');
  chip.className = 'focus-log-chip' + (session.type === 'break' ? ' break' : '');
  const stars = session.rating ? '★'.repeat(session.rating) : '';
  chip.textContent = `${session.type === 'work' ? '🎯' : '☕'} ${session.duration}min${stars ? ` ${stars}` : ''}`;
  log.appendChild(chip);
}
function startFocusTimer() { if (focusRunning) return; focusRunning = true; focusTimer = setInterval(focusTick, 1000); const s = document.getElementById('focus-start-btn'), p = document.getElementById('focus-pause-btn'); if (s) s.classList.add('hidden'); if (p) p.classList.remove('hidden'); }
function pauseFocusTimer() { if (!focusRunning) return; clearInterval(focusTimer); focusRunning = false; document.title = 'GrindBoard – Academic Performance OS'; const s = document.getElementById('focus-start-btn'), p = document.getElementById('focus-pause-btn'); if (s) { s.textContent = '▶ RESUME'; s.classList.remove('hidden'); } if (p) p.classList.add('hidden'); }
function renderFocusHistory() {
  const c = document.getElementById('focus-history-list'); if (!c) return;
  const sessions = [...state.focusSessions].reverse().slice(0, 12);
  if (!sessions.length) { c.innerHTML = '<div class="empty-state">No focus sessions logged yet.</div>'; return; }
  c.innerHTML = sessions.map(s => `
    <div class="focus-history-item">
      <span class="fhi-type ${s.type === 'work' ? 'fhi-work' : 'fhi-break'}">${s.type.toUpperCase()}</span>
      <div class="fhi-body">
        <div style="font-size:13px;color:var(--t2)">${s.duration} min${s.rating ? ` · ${'★'.repeat(s.rating)}` : ''}</div>
        ${s.notes ? `<div class="fhi-note">${s.notes}</div>` : ''}
      </div>
      <span class="fhi-date">${fmtDate(s.date)}</span>
    </div>`).join('');
  updateScoreUI();
}

// ── MISTAKE JOURNAL ────────────────────────────────────────
function renderMistakes() {
  const filter = document.getElementById('mj-filter')?.value || 'all';
  const search = (document.getElementById('mj-search')?.value || '').toLowerCase();
  const c = document.getElementById('mistake-entries'); if (!c) return;
  let entries = [...state.mistakes].reverse();
  if (filter !== 'all') entries = entries.filter(m => m.subject === filter);
  if (search) entries = entries.filter(m => (m.topic || '').toLowerCase().includes(search) || (m.desc || '').toLowerCase().includes(search) || (m.rule || '').toLowerCase().includes(search));

  // Recurring mistakes analytics
  renderRecurringMistakes();

  if (!entries.length) { c.innerHTML = '<div class="empty-state">No mistakes logged yet. That\'s suspicious… 👀</div>'; return; }
  c.innerHTML = entries.map(m => `
    <div class="mistake-card">
      <div class="mistake-card-header">
        <span class="mj-subject-tag tag-${m.subject}">${m.subject}</span>
        <span class="mj-topic-text">${m.topic || '—'}</span>
        ${m.confidence ? `<span class="mj-conf-stars" title="Confidence: ${CONF_LABELS[m.confidence]}">${'★'.repeat(m.confidence)}${'☆'.repeat(5 - m.confidence)}</span>` : ''}
        <span class="mj-date">${fmtDate(m.date)}</span>
        <button class="mj-del-btn" data-id="${m.id}">🗑</button>
      </div>
      <div class="mistake-detail-grid">
        <div class="mj-field"><div class="mj-field-label">MISTAKE</div><div class="mj-field-val">${m.desc || '—'}</div></div>
        <div class="mj-field"><div class="mj-field-label">WHY IT HAPPENED</div><div class="mj-field-val">${m.rootCause || '—'}</div></div>
        <div class="mj-field"><div class="mj-field-label">CORRECT SOLUTION</div><div class="mj-field-val">${m.correction || '—'}</div></div>
        <div class="mj-prevention-rule"><div class="mj-field-label">PREVENTION RULE</div><div class="mj-field-val">${m.rule || '—'}</div></div>
      </div>
    </div>`).join('');
  c.querySelectorAll('.mj-del-btn').forEach(btn => btn.addEventListener('click', () => {
    state.mistakes = state.mistakes.filter(m => m.id !== btn.dataset.id);
    saveState(); renderMistakes(); updateScoreUI(); showToast('Entry deleted');
  }));
}
function renderRecurringMistakes() {
  const section = document.getElementById('recurring-section');
  const grid = document.getElementById('recurring-grid');
  if (!section || !grid) return;
  if (state.mistakes.length < 2) { section.style.display = 'none'; return; }
  const map = {};
  state.mistakes.forEach(m => { const k = m.subject + (m.topic ? ':' + m.topic : ''); map[k] = (map[k] || { count: 0, subject: m.subject, topic: m.topic }); map[k].count++; });
  const hot = Object.values(map).filter(e => e.count >= 2).sort((a, b) => b.count - a.count).slice(0, 6);
  if (!hot.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  grid.innerHTML = hot.map(e => `
    <div class="recurring-card">
      <div class="rc-count">${e.count}×</div>
      <div class="rc-subject tag-${e.subject}" style="display:inline-block;border-radius:4px;padding:2px 8px;font-size:10px;margin-top:4px">${e.subject}</div>
      <div class="rc-topic">${e.topic || 'Various topics'}</div>
    </div>`).join('');
}

// ── ANALYTICS ──────────────────────────────────────────────
function renderAnalytics() {
  renderCompetitionChart(); renderRadarChart(); renderScoreHistoryChart(); renderDoughnutChart(); renderWeeklyTrend();
}
function renderCompetitionChart() {
  const ctx = document.getElementById('chart-competition'); if (!ctx) return;
  destroyChart('competition');
  const labels = [], todayData = [], avg7 = [];
  const todayDate = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(todayDate); d.setDate(todayDate.getDate() - i);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    labels.push(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()] + ' ' + d.getDate());
    const val = state.studyLog.filter(l => l.date === key).reduce((s, e) => s + e.hours, 0);
    todayData.push(val);
    let sum = 0, cnt = 0;
    for (let k = 1; k <= 7; k++) { const pd = new Date(d); pd.setDate(d.getDate() - k); const pk = pd.getFullYear() + '-' + String(pd.getMonth() + 1).padStart(2, '0') + '-' + String(pd.getDate()).padStart(2, '0'); sum += state.studyLog.filter(l => l.date === pk).reduce((s, e) => s + e.hours, 0); cnt++; }
    avg7.push(+(sum / cnt).toFixed(2));
  }
  chartInstances['competition'] = new Chart(ctx, { type: 'line', data: { labels, datasets: [{ label: 'Today', data: todayData, borderColor: '#00ff87', backgroundColor: 'rgba(0,255,135,.08)', borderWidth: 2, pointRadius: 3, tension: .4, fill: true }, { label: '7-Day Avg', data: avg7, borderColor: '#00cfff', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [4, 4], pointRadius: 0, tension: .4 }] }, options: chartDefaults({}) });
}
function renderRadarChart() {
  const ctx = document.getElementById('chart-radar'); if (!ctx) return;
  destroyChart('radar');
  chartInstances['radar'] = new Chart(ctx, { type: 'radar', data: { labels: SUBJECTS.map(s => SUBJECT_LABELS[s]), datasets: [{ label: 'Mastery %', data: SUBJECTS.map(s => state.topics[s]?.mastery ?? 0), borderColor: '#00ff87', backgroundColor: 'rgba(0,255,135,.15)', pointBackgroundColor: '#00ff87', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: true, scales: { r: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,.08)' }, pointLabels: { color: '#8b949e', font: { family: 'JetBrains Mono', size: 11 } }, ticks: { color: '#484f58', backdropColor: 'transparent', stepSize: 25 }, angleLines: { color: 'rgba(255,255,255,.08)' } } }, plugins: { legend: { display: false } } } });
}
function renderScoreHistoryChart() {
  const ctx = document.getElementById('chart-score-history'); if (!ctx) return;
  destroyChart('score-history');
  const hist = state.scoreHistory.slice(-10);
  const cur = computePowerScore().total;
  const labels = hist.length >= 2 ? hist.map(h => fmtDate(h.date)) : ['Start', 'Now'];
  const data = hist.length >= 2 ? hist.map(h => h.score) : [0, cur];
  chartInstances['score-history'] = new Chart(ctx, { type: 'line', data: { labels, datasets: [{ label: 'Score', data, borderColor: '#bf5fff', backgroundColor: 'rgba(191,95,255,.1)', borderWidth: 2, tension: .4, fill: true, pointBackgroundColor: '#bf5fff' }] }, options: chartDefaults({}) });
}
function renderDoughnutChart() {
  const ctx = document.getElementById('chart-subject-doughnut'); if (!ctx) return;
  destroyChart('doughnut');
  const data = SUBJECTS.concat(['Other']).map(s => state.studyLog.filter(l => l.subject === s).reduce((a, e) => a + e.hours, 0));
  const labels = SUBJECTS.concat(['Other']).map(s => SUBJECT_LABELS[s] || s);
  const colors = SUBJECTS.concat(['Other']).map(s => SUBJECT_COLORS[s] || '#8b949e');
  const total = data.reduce((a, b) => a + b, 0);
  const legend = document.getElementById('subject-legend');
  if (legend) legend.innerHTML = labels.map((l, i) => data[i] > 0 ? `<div class="legend-item"><div class="legend-dot" style="background:${colors[i]}"></div><span>${l}: ${data[i].toFixed(1)}h</span></div>` : '').join('');
  chartInstances['doughnut'] = new Chart(ctx, { type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: colors.map(c => c + 'b3'), borderColor: colors, borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: true, cutout: '65%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw.toFixed(1)}h (${total > 0 ? ((ctx.raw / total) * 100).toFixed(0) : 0}%)` }, ...tooltipStyle() } } } });
}
function renderWeeklyTrend() {
  const c = document.getElementById('weekly-trend-row'); if (!c) return;
  const today = new Date(); const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const dayData = []; let maxH = 0;
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const hrs = state.studyLog.filter(l => l.date === key).reduce((s, e) => s + e.hours, 0);
    if (hrs > maxH) maxH = hrs;
    dayData.push({ label: days[d.getDay()], hrs, isToday: i === 0 });
  }
  c.innerHTML = dayData.map(({ label, hrs, isToday }) => `
    <div class="weekly-day">
      <div class="weekly-bar-wrap">
        <div class="weekly-bar" style="height:${maxH > 0 ? (hrs / maxH) * 100 : 0}%;background:${isToday ? 'var(--grad-main)' : 'rgba(0,255,135,.4)'}"></div>
      </div>
      <div class="weekly-lbl" style="color:${isToday ? 'var(--g1)' : 'var(--t4)'}">${label}</div>
      <div class="weekly-val">${hrs > 0 ? hrs.toFixed(1) : ''}</div>
    </div>`).join('');
}

function destroyChart(key) { if (chartInstances[key]) { chartInstances[key].destroy(); delete chartInstances[key]; } }
function chartDefaults(extra = {}) {
  return { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8b949e', font: { family: 'JetBrains Mono', size: 11 }, boxWidth: 12 } }, tooltip: tooltipStyle() }, scales: { x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#484f58', font: { family: 'JetBrains Mono', size: 10 } } }, y: { grid: { color: 'rgba(255,255,255,.06)' }, ticks: { color: '#484f58', font: { family: 'JetBrains Mono', size: 10 } }, beginAtZero: true, ...(extra.scales?.y || {}) }, ...(extra.scales || {}) }, ...extra };
}
function tooltipStyle() { return { backgroundColor: '#161b22', borderColor: '#30363d', borderWidth: 1, titleColor: '#f0f6fc', bodyColor: '#8b949e', titleFont: { family: 'JetBrains Mono', size: 12 }, bodyFont: { family: 'JetBrains Mono', size: 11 }, padding: 10 }; }

// ── SETTINGS ───────────────────────────────────────────────
function renderSettings() {
  const n = document.getElementById('settings-name'); if (n) n.value = state.profile.name || '';
  const t = document.getElementById('settings-target'); if (t) t.value = state.profile.targetScore || 80;
  const dg = document.getElementById('settings-daily-goal'); if (dg) dg.value = state.profile.dailyGoal || 4;
  const sg = document.getElementById('settings-streak-goal'); if (sg) sg.value = state.profile.streakGoal || 30;
}

// ── STAR UI HELPER ─────────────────────────────────────────
function updateStarUI(cls) {
  document.querySelectorAll('.' + cls).forEach(s => { s.classList.toggle('active', +s.dataset.star <= selectedRating || +s.dataset.conf <= selectedConf); });
}

// ── SCORE SNAPSHOT ─────────────────────────────────────────
function saveScoreSnapshot() {
  const sc = computePowerScore();
  const today = todayStr();
  const last = state.scoreHistory[state.scoreHistory.length - 1];
  if (last && last.date === today) last.score = sc.total;
  else state.scoreHistory.push({ date: today, score: sc.total });
  if (state.scoreHistory.length > 60) state.scoreHistory.shift();
}

// ── SEED DATA ──────────────────────────────────────────────

function seedDataIfEmpty() {
  // Check for a specific flag in localStorage instead of just an empty study log
  if (localStorage.getItem('grindboard_seeded') === 'true') return; 

  const today = new Date(); const subs = ['DSA', 'OS', 'CN', 'DBMS', 'DiscreteMaths'];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    state.studyLog.push({ date: key, subject: subs[Math.floor(Math.random() * subs.length)], hours: +(Math.random() * 3 + 0.5).toFixed(1), note: 'Seed data' });
    if (Math.random() > 0.25) state.streak.log[key] = 1;
  }
  let cur = 0; let d = new Date(today);
  while (true) { const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); if (state.streak.log[k]) { cur++; d.setDate(d.getDate() - 1); } else break; }
  state.streak.currentDays = cur; state.streak.longestDays = cur + 5; state.streak.totalDays = Object.values(state.streak.log).filter(v => v > 0).length;
  subs.forEach(s => {
    state.topics[s].mastery = 20 + Math.floor(Math.random() * 60);
    Object.keys(state.topics[s].cells || {}).forEach(t => { state.topics[s].cells[t] = Math.floor(Math.random() * 100); });
  });
  for (let i = 9; i >= 0; i--) { const dd = new Date(today); dd.setDate(today.getDate() - i); const k = dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0'); state.scoreHistory.push({ date: k, score: 10 + Math.floor(Math.random() * 65) }); }
  state.profile.projectProgress = 35;
  
  // Set the flag so it never runs again
  localStorage.setItem('grindboard_seeded', 'true'); 
  saveState();
}


// ── EVENTS ─────────────────────────────────────────────────
function initEvents() {
  // Nav
  document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', e => { e.preventDefault(); showPanel(item.dataset.panel); }));
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => document.getElementById('sidebar')?.classList.toggle('collapsed'));

  // Quick log
  document.getElementById('btn-quick-log')?.addEventListener('click', () => {
    const sub = document.getElementById('ql-subject')?.value;
    const hrs = parseFloat(document.getElementById('ql-hours')?.value);
    const note = document.getElementById('ql-note')?.value.trim();
    if (!sub || isNaN(hrs) || hrs <= 0) { showToast('Enter valid subject and hours', 'error'); return; }
    state.studyLog.push({ date: todayStr(), subject: sub, hours: hrs, note });
    document.getElementById('ql-hours').value = ''; document.getElementById('ql-note').value = '';
    saveState(); saveScoreSnapshot(); renderDashboard(); renderStudyPanel(); updateScoreUI();
    showToast(`📚 Logged ${hrs}h of ${sub}!`);
  });

  // Project slider
  document.getElementById('project-progress-slider')?.addEventListener('input', e => {
    const val = +e.target.value; state.profile.projectProgress = val;
    setText('project-progress-val', val + '%'); saveState(); updateScoreUI();
  });

  // Study filter
  document.getElementById('log-filter-subject')?.addEventListener('change', renderStudyLogTable);

  // Streak
  document.getElementById('btn-coded-today')?.addEventListener('click', markCodedToday);

  // Focus overlay
  document.getElementById('btn-launch-focus')?.addEventListener('click', () => {
    document.getElementById('focus-overlay')?.classList.remove('hidden');
    initFocusTimer();
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  });
  document.getElementById('focus-exit-btn')?.addEventListener('click', () => {
    clearInterval(focusTimer); focusRunning = false;
    document.getElementById('focus-overlay')?.classList.add('hidden');
    document.title = 'GrindBoard – Academic Performance OS';
    renderFocusHistory(); updateScoreUI();
  });
  document.getElementById('focus-start-btn')?.addEventListener('click', startFocusTimer);
  document.getElementById('focus-pause-btn')?.addEventListener('click', pauseFocusTimer);
  document.getElementById('focus-reset-btn')?.addEventListener('click', () => {
    clearInterval(focusTimer); focusRunning = false; initFocusTimer();
    const s = document.getElementById('focus-start-btn'), p = document.getElementById('focus-pause-btn');
    if (s) { s.textContent = '▶ START'; s.classList.remove('hidden'); } if (p) p.classList.add('hidden');
  });
  document.getElementById('focus-skip-btn')?.addEventListener('click', () => { clearInterval(focusTimer); focusRunning = false; focusSecondsLeft = 0; focusComplete(); });
  document.getElementById('work-inc')?.addEventListener('click', () => { state.focusSettings.workMin = Math.min(state.focusSettings.workMin + 5, 90); saveState(); setText('work-min-display', state.focusSettings.workMin); if (!focusRunning && focusIsWork) initFocusTimer(); });
  document.getElementById('work-dec')?.addEventListener('click', () => { state.focusSettings.workMin = Math.max(state.focusSettings.workMin - 5, 5); saveState(); setText('work-min-display', state.focusSettings.workMin); if (!focusRunning && focusIsWork) initFocusTimer(); });
  document.getElementById('break-inc')?.addEventListener('click', () => { state.focusSettings.breakMin = Math.min(state.focusSettings.breakMin + 1, 30); saveState(); setText('break-min-display', state.focusSettings.breakMin); });
  document.getElementById('break-dec')?.addEventListener('click', () => { state.focusSettings.breakMin = Math.max(state.focusSettings.breakMin - 1, 1); saveState(); setText('break-min-display', state.focusSettings.breakMin); });

  // Focus rating stars
  document.querySelectorAll('.star-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRating = +btn.dataset.star;
      document.querySelectorAll('.star-btn').forEach(s => s.classList.toggle('active', +s.dataset.star <= selectedRating));
    });
  });

  // Mistake journal
  document.getElementById('btn-new-mistake')?.addEventListener('click', () => {
    selectedConf = 0; document.querySelectorAll('.conf-star').forEach(s => s.classList.remove('active'));
    setText('conf-label-text', 'Not set');
    document.getElementById('mistake-form-card')?.classList.remove('hidden');
  });
  document.getElementById('btn-cancel-mistake')?.addEventListener('click', () => document.getElementById('mistake-form-card')?.classList.add('hidden'));

  // Confidence stars
  document.querySelectorAll('.conf-star').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedConf = +btn.dataset.conf;
      document.querySelectorAll('.conf-star').forEach(s => s.classList.toggle('active', +s.dataset.conf <= selectedConf));
      setText('conf-label-text', CONF_LABELS[selectedConf] || '');
    });
  });

  document.getElementById('btn-save-mistake')?.addEventListener('click', () => {
    const sub = document.getElementById('mj-subject')?.value;
    const topic = document.getElementById('mj-topic')?.value.trim();
    const desc = document.getElementById('mj-desc')?.value.trim();
    const root = document.getElementById('mj-root')?.value.trim();
    const corr = document.getElementById('mj-correction')?.value.trim();
    const rule = document.getElementById('mj-rule')?.value.trim();
    if (!topic || !desc) { showToast('Topic and description required', 'error'); return; }
    state.mistakes.push({ id: Date.now().toString(), date: todayStr(), subject: sub, topic, desc, rootCause: root, correction: corr, rule, confidence: selectedConf });
    saveState(); renderMistakes(); updateScoreUI();
    ['mj-topic', 'mj-desc', 'mj-root', 'mj-correction', 'mj-rule'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    selectedConf = 0; document.querySelectorAll('.conf-star').forEach(s => s.classList.remove('active'));
    document.getElementById('mistake-form-card')?.classList.add('hidden');
    showToast('📝 Mistake logged!');
  });
  document.getElementById('mj-filter')?.addEventListener('change', renderMistakes);
  document.getElementById('mj-search')?.addEventListener('input', renderMistakes);

  // Settings save
  document.getElementById('btn-save-settings')?.addEventListener('click', () => {
    const name = document.getElementById('settings-name')?.value.trim();
    const target = +document.getElementById('settings-target')?.value;
    const daily = +document.getElementById('settings-daily-goal')?.value;
    const streakGoal = +document.getElementById('settings-streak-goal')?.value;
    if (name) state.profile.name = name;
    if (target) state.profile.targetScore = target;
    if (daily) state.profile.dailyGoal = daily;
    if (streakGoal) state.profile.streakGoal = streakGoal;
    saveState(); updateScoreUI(); showToast('✅ Settings saved!');
  });

  // Reset
  document.getElementById('btn-reset-data')?.addEventListener('click', () => {
    if (confirm('Reset ALL GrindBoard data? This cannot be undone.')) {
      localStorage.removeItem('grindboard_v4'); 
      // Ensure the seed flag stays so we get a truly empty board upon reload
      localStorage.setItem('grindboard_seeded', 'true'); 
      
      // Force a hard refresh to wipe the UI and chart memory clean
      window.location.reload(); 
    }
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const ov = document.getElementById('focus-overlay');
      if (ov && !ov.classList.contains('hidden')) { clearInterval(focusTimer); focusRunning = false; ov.classList.add('hidden'); document.title = 'GrindBoard – Academic Performance OS'; renderFocusHistory(); updateScoreUI(); }
    }
  });
}

// ── INIT ───────────────────────────────────────────────────
function init() {
  seedDataIfEmpty();
  initEvents();
  updateClock(); setInterval(updateClock, 1000);
  setText('work-min-display', state.focusSettings.workMin);
  setText('break-min-display', state.focusSettings.breakMin);
  showPanel('dashboard');
}
document.addEventListener('DOMContentLoaded', init);

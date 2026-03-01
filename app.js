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

const PANELS = ['dashboard', 'study', 'streak', 'subjects', 'focus', 'journal', 'analytics', 'settings'];
const BREADCRUMBS = { dashboard: '/ dashboard', study: '/ study-tracker', streak: '/ coding-streak', subjects: '/ subjects-mastery', focus: '/ focus-mode', journal: '/ mistake-journal', analytics: '/ analytics', settings: '/ settings' };

// ── DEFAULT STATE ──────────────────────────────────────────
const DEFAULT_STATE = () => ({
  profile: { name: 'Grinder', targetScore: 80, dailyGoal: 4, streakGoal: 30, projectProgress: 0 },
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

function loadState() {
  try {
    const raw = localStorage.getItem('grindboard_v2_core');
    if (raw) return JSON.parse(raw);
  } catch (e) { console.error("Load failed", e); }
  return DEFAULT_STATE();
}
function saveState() { localStorage.setItem('grindboard_v2_core', JSON.stringify(state)); }

// ── SNAPSHOT LOGIC ─────────────────────────────────────────
function saveScoreSnapshot() {
    const score = computePowerScore().total;
    const today = todayStr();
    // Only save once per day or if score changed significantly
    const last = state.scoreHistory[state.scoreHistory.length - 1];
    if (!last || last.date !== today || last.score !== score) {
        state.scoreHistory.push({ date: today, score });
        if (state.scoreHistory.length > 50) state.scoreHistory.shift();
        saveState();
    }
}

// ── POWER SCORE ────────────────────────────────────────────
function computePowerScore() {
  const totalHours = state.studyLog.reduce((s, e) => s + e.hours, 0);
  const streakDays = state.streak.currentDays || 0;
  const avgMastery = SUBJECTS.reduce((s, sub) => s + (state.topics[sub]?.mastery || 0), 0) / SUBJECTS.length;
  const proj = state.profile.projectProgress || 0;

  // Optimized Logic Weights
  const studyPts = Math.min((totalHours / 150) * 40, 40);
  const masteryPts = Math.min((avgMastery / 100) * 30, 30);
  const projPts = Math.min((proj / 100) * 30, 30);
  
  const total = Math.min(Math.round(studyPts + masteryPts + projPts), 100);
  return { total, studyPts, masteryPts, projPts, totalHours, avgMastery };
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
  const badge = document.getElementById('score-badge');
  if (badge) { badge.textContent = tier.label; badge.style.color = tier.color; }

  // Stat updates
  setText('stat-val-study', sc.totalHours.toFixed(1) + 'h');
  setText('stat-val-mastery', Math.round(sc.avgMastery) + '%');
  setText('stat-val-project', (state.profile.projectProgress || 0) + '%');
  setText('dsc-mastery', Math.round(sc.avgMastery) + '%');
  
  const todayHrs = state.studyLog.filter(l => l.date === todayStr()).reduce((s, e) => s + e.hours, 0);
  setText('dsc-today-hours', todayHrs.toFixed(1) + 'h');
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function todayStr() { return new Date().toISOString().split('T')[0]; }

// ── ROUTER & NAV ───────────────────────────────────────────
function showPanel(id) {
  PANELS.forEach(p => {
    document.getElementById('panel-' + p)?.classList.remove('active');
    document.querySelector(`[data-panel="${p}"]`)?.classList.remove('active');
  });
  document.getElementById('panel-' + id)?.classList.add('active');
  document.querySelector(`[data-panel="${id}"]`)?.classList.add('active');
  
  // Refresh data for the specific panel
  if (id === 'subjects') renderSubjects();
  if (id === 'analytics') renderAnalytics();
  if (id === 'study') renderStudyPanel();
}

// ── ANALYTICS OPTIMIZATION ─────────────────────────────────
function renderAnalytics() {
    renderCompetitionChart();
    renderScoreHistoryChart();
}

function renderCompetitionChart() {
    const ctx = document.getElementById('chart-competition'); if (!ctx) return;
    if (chartInstances['competition']) chartInstances['competition'].destroy();

    // PERFORMANCE FIX: Pre-map hours for O(1) lookup
    const hoursMap = {};
    state.studyLog.forEach(log => {
        hoursMap[log.date] = (hoursMap[log.date] || 0) + log.hours;
    });

    const labels = [], dailyData = [], avg7 = [];
    const today = new Date();

    for (let i = 29; i >= 0; i--) {
        const d = new Date(today); d.setDate(today.getDate() - i);
        const key = d.toISOString().split('T')[0];
        labels.push(d.getDate() + '/' + (d.getMonth()+1));
        dailyData.push(hoursMap[key] || 0);

        // 7-day rolling average
        let sum = 0;
        for (let k = 0; k < 7; k++) {
            const pd = new Date(d); pd.setDate(d.getDate() - k);
            sum += hoursMap[pd.toISOString().split('T')[0]] || 0;
        }
        avg7.push(+(sum / 7).toFixed(2));
    }

    chartInstances['competition'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Hours', data: dailyData, borderColor: '#00ff87', tension: 0.4, fill: true, backgroundColor: 'rgba(0,255,135,0.1)' },
                { label: '7d Avg', data: avg7, borderColor: '#00cfff', borderDash: [5,5], pointRadius: 0, tension: 0.4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderScoreHistoryChart() {
    const ctx = document.getElementById('chart-score-history'); if (!ctx) return;
    if (chartInstances['score']) chartInstances['score'].destroy();

    let hist = [...state.scoreHistory];
    if (hist.length === 0) hist = [{date: 'Start', score: 0}, {date: todayStr(), score: computePowerScore().total}];

    chartInstances['score'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: hist.map(h => h.date),
            datasets: [{ label: 'Power Score', data: hist.map(h => h.score), borderColor: '#bf5fff', fill: true, backgroundColor: 'rgba(191,95,255,0.1)', tension: 0.4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }
    });
}

// ── SUBJECTS & EVENT DELEGATION FIX ────────────────────────
function renderSubjects() {
  const grid = document.getElementById('subject-grid');
  if (!grid) return;
  grid.innerHTML = SUBJECTS.map(sub => {
    const data = state.topics[sub];
    return `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${SUBJECT_LABELS[sub]}</h3>
          <span class="mastery-pct">${data.mastery}%</span>
        </div>
        <div class="topic-pills">
          ${TOPIC_MAP[sub].map(t => `
            <button class="topic-pill ${data.cells[t] === 100 ? 'active' : ''}" 
                    data-sub="${sub}" data-topic="${t}">${t}</button>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// ── INITIALIZATION ─────────────────────────────────────────
function initEvents() {
  // 1. Mobile Toggle
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    document.querySelector('.sidebar-nav').classList.toggle('active');
  });

  // 2. Navigation
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      showPanel(btn.dataset.panel);
      if (window.innerWidth <= 900) document.querySelector('.sidebar-nav').classList.remove('active');
    });
  });

  // 3. EVENT DELEGATION for Topic Pills (Fixes the "Dead Button" bug)
  document.getElementById('subject-grid')?.addEventListener('click', e => {
    const btn = e.target.closest('.topic-pill');
    if (!btn) return;

    const { sub, topic } = btn.dataset;
    state.topics[sub].cells[topic] = state.topics[sub].cells[topic] === 100 ? 0 : 100;
    
    // Recalculate mastery
    const vals = Object.values(state.topics[sub].cells);
    state.topics[sub].mastery = Math.round(vals.reduce((a,b) => a+b, 0) / vals.length);
    
    saveState();
    saveScoreSnapshot();
    updateScoreUI();
    renderSubjects(); // Redraw UI
  });

  // 4. Project Slider
  document.getElementById('project-progress-slider')?.addEventListener('input', e => {
    state.profile.projectProgress = +e.target.value;
    setText('project-progress-val', e.target.value + '%');
    saveState();
    saveScoreSnapshot();
    updateScoreUI();
  });

  // 5. Reset Data
  document.getElementById('btn-reset-data')?.addEventListener('click', () => {
    if (confirm("Clear all data? This cannot be undone.")) {
        localStorage.removeItem('grindboard_v2_core');
        location.reload(); // Refresh to default
    }
  });

  // 6. Study Form
  document.getElementById('study-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const entry = {
        date: document.getElementById('study-date').value,
        subject: document.getElementById('study-subject').value,
        hours: +document.getElementById('study-hours').value,
        note: document.getElementById('study-note').value
    };
    state.studyLog.push(entry);
    saveState();
    saveScoreSnapshot();
    updateScoreUI();
    showPanel('dashboard');
  });
}

function init() {
  initEvents();
  updateScoreUI();
  showPanel('dashboard');
}

window.onload = init;
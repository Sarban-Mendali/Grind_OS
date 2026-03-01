'use strict';

// ── CONFIG & STATE ─────────────────────────────────────────
const SUBJECTS = ['DSA', 'OS', 'CN', 'DBMS', 'DiscreteMaths'];
const TOPIC_MAP = {
  DSA: ['Arrays', 'LinkedList', 'Trees', 'Graphs', 'DP'],
  OS: ['Processes', 'Threads', 'Scheduling', 'Memory', 'FileSystem'],
  // Add others as needed...
};

const DEFAULT_STATE = () => ({
  profile: { name: 'Grinder', projectProgress: 0 },
  studyLog: [],
  topics: Object.fromEntries(SUBJECTS.map(s => [s, { mastery: 0, cells: Object.fromEntries((TOPIC_MAP[s] || []).map(t => [t, 0])) }])),
  scoreHistory: [],
  seeded: false
});

let state = JSON.parse(localStorage.getItem('grindboard_v2')) || DEFAULT_STATE();
let charts = {};

function saveState() { 
    localStorage.setItem('grindboard_v2', JSON.stringify(state)); 
}

// ── CORE LOGIC ─────────────────────────────────────────────
function computePowerScore() {
    const hours = state.studyLog.reduce((acc, curr) => acc + curr.hours, 0);
    const mastery = SUBJECTS.reduce((acc, s) => acc + (state.topics[s]?.mastery || 0), 0) / SUBJECTS.length;
    const proj = state.profile.projectProgress || 0;
    
    const total = Math.min(Math.round((hours * 0.5) + (mastery * 0.3) + (proj * 0.2)), 100);
    return { total, hours, mastery };
}

function saveScoreSnapshot() {
    const score = computePowerScore().total;
    const date = new Date().toISOString().split('T')[0];
    if (state.scoreHistory.length === 0 || state.scoreHistory[state.scoreHistory.length-1].date !== date) {
        state.scoreHistory.push({ date, score });
        saveState();
    }
}

// ── UI RENDERING ───────────────────────────────────────────
function showPanel(id) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('panel-' + id).classList.add('active');
    document.querySelector(`[data-panel="${id}"]`).classList.add('active');
    
    if (id === 'subjects') renderSubjects();
    if (id === 'analytics') renderAnalytics();
    updateUI();
}

function updateUI() {
    const score = computePowerScore();
    document.getElementById('topbar-score').textContent = score.total;
    document.getElementById('greeting-score-num').textContent = score.total;
    document.getElementById('stat-val-study').textContent = score.hours + 'h';
    document.getElementById('greeting-name').textContent = state.profile.name;
}

function renderSubjects() {
    const grid = document.getElementById('subject-grid');
    grid.innerHTML = SUBJECTS.map(s => `
        <div class="card">
            <h3>${s} (${state.topics[s].mastery}%)</h3>
            <div class="topic-pills">
                ${TOPIC_MAP[s].map(t => `
                    <button class="topic-pill ${state.topics[s].cells[t] === 100 ? 'active' : ''}" 
                            data-sub="${s}" data-topic="${t}">${t}</button>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function renderAnalytics() {
    // Competition Chart (Optimized O(n))
    const ctxComp = document.getElementById('chart-competition').getContext('2d');
    if (charts.comp) charts.comp.destroy();
    
    const hoursMap = {};
    state.studyLog.forEach(l => hoursMap[l.date] = (hoursMap[l.date] || 0) + l.hours);
    
    const labels = Object.keys(hoursMap).slice(-7);
    const data = labels.map(l => hoursMap[l]);

    charts.comp = new Chart(ctxComp, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Daily Hours', data, backgroundColor: '#00ff87' }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// ── EVENT INITIALIZATION ───────────────────────────────────
function initEvents() {
    // Mobile Nav
    document.getElementById('mobile-nav-toggle').onclick = () => {
        document.getElementById('sidebar-nav').classList.toggle('active');
    };

    // Nav Switcher
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            showPanel(btn.dataset.panel);
            if (window.innerWidth < 850) document.getElementById('sidebar-nav').classList.remove('active');
        };
    });

    // EVENT DELEGATION (Topic Pills)
    document.getElementById('subject-grid').onclick = (e) => {
        if (!e.target.classList.contains('topic-pill')) return;
        const { sub, topic } = e.target.dataset;
        
        state.topics[sub].cells[topic] = state.topics[sub].cells[topic] === 100 ? 0 : 100;
        
        // Mastery Calc
        const vals = Object.values(state.topics[sub].cells);
        state.topics[sub].mastery = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        
        saveState();
        saveScoreSnapshot();
        renderSubjects();
        updateUI();
    };

    // Reset Button
    document.getElementById('btn-reset-data').onclick = () => {
        if (confirm("Reset everything?")) {
            localStorage.removeItem('grindboard_v2');
            location.reload();
        }
    };

    // Study Form
    document.getElementById('study-form').onsubmit = (e) => {
        e.preventDefault();
        state.studyLog.push({
            date: document.getElementById('study-date').value,
            subject: document.getElementById('study-subject').value,
            hours: parseFloat(document.getElementById('study-hours').value)
        });
        saveState();
        saveScoreSnapshot();
        showPanel('dashboard');
    };
}

// ── INIT ───────────────────────────────────────────────────
window.onload = () => {
    initEvents();
    updateUI();
    // Clock
    setInterval(() => {
        document.getElementById('topbar-time').textContent = new Date().toLocaleTimeString();
    }, 1000);
};
import { meditationData } from './data.js';
import {
  escapeHtml,
  normalizeProgress as normalizeProgressBase,
  computeStreak as computeStreakBase,
  prettyWeekTitle,
  formatText
} from './lib.js';

// --- Derived constants (no hardcoded day/week counts) ---
const ALL_DAYS = meditationData.weeks
  .filter(Boolean)
  .flatMap(w => (w.days || []))
  .sort((a, b) => a.day - b.day);
const TOTAL_DAYS = ALL_DAYS.length;
const DAY_BY_NUM = new Map(ALL_DAYS.map(d => [d.day, d]));
const MIN_DAY = ALL_DAYS.length ? ALL_DAYS[0].day : 1;
const MAX_DAY = ALL_DAYS.length ? ALL_DAYS[ALL_DAYS.length - 1].day : 1;

// State
const state = {
  progress: {
    completed: {}, // dayNum -> timestamp
    notes: {},     // dayNum -> string
    lastActiveDay: MIN_DAY
  },
  userId: null
};

// --- Utilities ---

function debounce(fn, wait) {
  let t;
  const debounced = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
  debounced.flush = (...args) => {
    clearTimeout(t);
    fn(...args);
  };
  return debounced;
}

// --- Storage & API ---

function getUserId() {
  let id = localStorage.getItem('mfm_user_id');
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) ||
      `mfm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('mfm_user_id', id);
  }
  return id;
}

function normalizeProgress(p) {
  return normalizeProgressBase(p, MIN_DAY);
}

async function loadProgress() {
  state.userId = getUserId();

  // Try local storage first for speed.
  const local = localStorage.getItem('mfm_progress');
  if (local) {
    try {
      state.progress = normalizeProgress({ ...state.progress, ...JSON.parse(local) });
      updateUI();
    } catch (e) {
      console.error('Local storage parse error', e);
    }
  }

  // Then fetch from server to sync (if Netlify functions exist).
  try {
    const res = await fetch(`/.netlify/functions/loadProgress?userId=${encodeURIComponent(state.userId)}`);
    if (res.ok) {
      const body = await res.json();
      // Server wraps payload as { progressData: {...} }.
      const remote = body && body.progressData;
      if (remote && Object.keys(remote).length > 0) {
        state.progress = normalizeProgress({ ...state.progress, ...remote });
        localStorage.setItem('mfm_progress', JSON.stringify(state.progress));
        updateUI();
      }
    }
  } catch (e) {
    console.warn('Server sync failed, running locally', e);
  }
}

// Network sync is debounced so rapid edits (typing) don't spam the function.
const syncToServer = debounce(() => {
  if (!state.userId) return;
  try {
    fetch('/.netlify/functions/saveProgress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Field name MUST match the function: progressData.
      body: JSON.stringify({ userId: state.userId, progressData: state.progress })
    }).catch(e => console.warn('Server save failed', e));
  } catch (e) {
    console.warn('Server save failed', e);
  }
}, 800);

function saveProgress({ immediate = false } = {}) {
  localStorage.setItem('mfm_progress', JSON.stringify(state.progress));
  if (immediate) {
    syncToServer.flush();
  } else {
    syncToServer();
  }
}

async function clearProgress() {
  const ok = window.confirm(
    'Reset all progress and notes? This cannot be undone. ' +
    'Consider exporting your notes first.'
  );
  if (!ok) return;

  state.progress = normalizeProgress(null);
  localStorage.removeItem('mfm_progress');

  try {
    await fetch('/.netlify/functions/clearProgress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: state.userId })
    });
  } catch (e) {
    console.warn('Server clear failed', e);
  }

  showView('main-view');
  updateUI();
  showToast('Progress reset');
}

// --- Streak calculation ---

function computeStreak() {
  return computeStreakBase(state.progress.completed, DAY_BY_NUM.keys());
}

// --- Export / Import ---

function buildMarkdownExport() {
  const lines = [];
  lines.push('# Meditations for Mortals — My Journey');
  lines.push('');
  const completedCount = Object.keys(state.progress.completed).length;
  lines.push(`Progress: ${completedCount} of ${TOTAL_DAYS} days completed.`);
  lines.push(`Longest streak: ${computeStreak()} days.`);
  lines.push(`Exported: ${new Date().toLocaleString()}`);
  lines.push('');

  ALL_DAYS.forEach(day => {
    const done = !!state.progress.completed[day.day];
    const note = (state.progress.notes[day.day] || '').trim();
    if (!done && !note) return; // Only export days the user engaged with.
    lines.push(`## Day ${day.day}: ${day.title}`);
    lines.push(done ? '_Status: ✓ Completed_' : '_Status: In progress_');
    if (note) {
      lines.push('');
      lines.push(note);
    }
    lines.push('');
  });

  return lines.join('\n');
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportData() {
  const stamp = new Date().toISOString().slice(0, 10);
  const payload = {
    app: 'meditations-for-mortals',
    version: 1,
    exportedAt: new Date().toISOString(),
    userId: state.userId,
    progress: state.progress
  };
  download(`mfm-backup-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json');
  download(`mfm-notes-${stamp}.md`, buildMarkdownExport(), 'text/markdown');
  showToast('Exported backup (JSON) + notes (Markdown)');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const incoming = parsed && (parsed.progress || parsed);
      const merged = normalizeProgress(incoming);
      // Merge rather than overwrite so we never silently destroy local data.
      state.progress = normalizeProgress({
        completed: { ...state.progress.completed, ...merged.completed },
        notes: { ...state.progress.notes, ...merged.notes },
        lastActiveDay: merged.lastActiveDay
      });
      saveProgress({ immediate: true });
      showView('main-view');
      updateUI();
      showToast('Backup imported');
    } catch (e) {
      console.error('Import failed', e);
      showToast('Import failed: invalid file', true);
    }
  };
  reader.readAsText(file);
}

// --- Toast notifications ---

function showToast(message, isError = false) {
  const el = document.createElement('div');
  el.className = 'notification' + (isError ? ' error' : '');
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.appendChild(el);
  // Force reflow then show, so the transition runs.
  // eslint-disable-next-line no-unused-expressions
  el.offsetHeight;
  el.classList.add('show');
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 350);
  }, 2500);
}

// --- Text formatting (imported from lib.js; single source of truth) ---

// --- UI Rendering ---

function renderApp() {
  const container = document.getElementById('app-content');
  container.innerHTML = '';

  const introSummary = document.createElement('div');
  introSummary.className = 'intro-summary';
  introSummary.innerHTML = `<p>A ${TOTAL_DAYS}-day journey to embrace your limitations.</p>`;
  container.appendChild(introSummary);

  meditationData.weeks.filter(Boolean).forEach(week => {
    const weekSection = document.createElement('div');
    weekSection.className = 'week-section';

    const weekHeader = document.createElement('h2');
    weekHeader.className = 'week-header';
    weekHeader.textContent = prettyWeekTitle(week);
    weekSection.appendChild(weekHeader);

    if (week.intro) {
      const wIntroBtn = document.createElement('button');
      wIntroBtn.className = 'btn-text-small';
      wIntroBtn.type = 'button';
      wIntroBtn.textContent = 'Read Week Intro';
      wIntroBtn.onclick = () => showTextPage(prettyWeekTitle(week), week.intro);
      weekSection.appendChild(wIntroBtn);
    }

    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    (week.days || []).forEach(day => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'calendar-day';
      card.dataset.day = day.day;
      card.setAttribute('aria-label', `Day ${day.day}: ${day.title}`);

      const isCompleted = !!state.progress.completed[day.day];
      if (isCompleted) card.classList.add('completed');

      card.innerHTML = `
        <div class="day-number">${day.day}</div>
        <div class="day-info">
          <div class="day-title">${escapeHtml(day.title)}</div>
          ${day.subtitle ? `<div class="day-subtitle">${escapeHtml(day.subtitle)}</div>` : ''}
        </div>
        ${isCompleted ? '<span class="check-mark" aria-hidden="true">✓</span>' : ''}
      `;

      card.onclick = () => openDay(day);
      grid.appendChild(card);
    });

    weekSection.appendChild(grid);
    container.appendChild(weekSection);
  });
}

function updateUI() {
  const completedCount = Object.keys(state.progress.completed).length;
  const percent = TOTAL_DAYS ? Math.min(100, Math.round((completedCount / TOTAL_DAYS) * 100)) : 0;

  const fill = document.getElementById('progress-fill');
  const text = document.getElementById('progress-text');
  if (fill) fill.style.width = `${percent}%`;
  if (text) text.textContent = `${completedCount} of ${TOTAL_DAYS} days completed`;

  const streakEl = document.getElementById('streak-text');
  if (streakEl) {
    const streak = computeStreak();
    streakEl.textContent = streak > 1 ? `🔥 ${streak}-day streak` : '';
  }

  // Resume button.
  const resumeBtn = document.getElementById('resume-btn');
  if (resumeBtn) {
    const next = nextIncompleteDay();
    if (next && completedCount > 0 && completedCount < TOTAL_DAYS) {
      resumeBtn.style.display = '';
      resumeBtn.textContent = `Resume · Day ${next.day}`;
      resumeBtn.onclick = () => openDay(next);
    } else {
      resumeBtn.style.display = 'none';
    }
  }

  // Update day cards without a full re-render.
  document.querySelectorAll('.calendar-day').forEach(card => {
    const d = card.dataset.day;
    const completed = !!state.progress.completed[d];
    card.classList.toggle('completed', completed);
    const existing = card.querySelector('.check-mark');
    if (completed && !existing) {
      const span = document.createElement('span');
      span.className = 'check-mark';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = '✓';
      card.appendChild(span);
    } else if (!completed && existing) {
      existing.remove();
    }
  });
}

function nextIncompleteDay() {
  // Prefer the day after lastActiveDay, else the first incomplete day.
  const fromLast = ALL_DAYS.find(
    d => d.day >= state.progress.lastActiveDay && !state.progress.completed[d.day]
  );
  if (fromLast) return fromLast;
  return ALL_DAYS.find(d => !state.progress.completed[d.day]) || null;
}

// --- View switching & focus management ---

let lastFocusedEl = null;

function showView(viewId) {
  const main = document.getElementById('main-view');
  const detail = document.getElementById('detail-view');
  const showingDetail = viewId === 'detail-view';

  main.style.display = showingDetail ? 'none' : 'block';
  detail.style.display = showingDetail ? 'block' : 'none';
  detail.setAttribute('aria-hidden', showingDetail ? 'false' : 'true');

  if (showingDetail) {
    lastFocusedEl = document.activeElement;
    const back = document.getElementById('back-btn');
    if (back) back.focus();
  } else {
    window.scrollTo(0, 0);
    updateUI();
    if (lastFocusedEl && document.contains(lastFocusedEl)) {
      lastFocusedEl.focus();
      lastFocusedEl = null;
    }
  }
}

function showTextPage(title, text) {
  const content = document.getElementById('detail-content');
  content.innerHTML = `
    <div class="text-page">
      <h2>${escapeHtml(title)}</h2>
      <div class="text-body">${formatText(text)}</div>
    </div>
  `;
  showView('detail-view');
  window.scrollTo(0, 0);
}

function openDay(dayData) {
  state.progress.lastActiveDay = dayData.day;
  saveProgress();

  const content = document.getElementById('detail-content');
  const isCompleted = !!state.progress.completed[dayData.day];
  const userNotes = state.progress.notes[dayData.day] || '';
  const htmlContent = formatText(dayData.fullText);

  const prevDay = DAY_BY_NUM.get(dayData.day - 1);
  const nextDay = DAY_BY_NUM.get(dayData.day + 1);

  content.innerHTML = `
    <div class="day-detail">
      <h2>Day ${dayData.day}: ${escapeHtml(dayData.title)}</h2>

      <div class="meditation-content">
        ${htmlContent}
      </div>

      <div class="interaction-area">
        <div class="notes-section">
          <h3>Your Notes</h3>
          <textarea id="note-input" placeholder="Reflect on today's practice...">${escapeHtml(userNotes)}</textarea>
          <p id="note-saved" class="note-saved" aria-live="polite"></p>
        </div>

        <button id="complete-btn" type="button" class="btn-primary ${isCompleted ? 'completed-state' : ''}">
          ${isCompleted ? 'Completed ✓' : 'Mark as Complete'}
        </button>
      </div>

      <div class="navigation-footer">
        ${prevDay ? `<button id="prev-btn" type="button" class="nav-btn">← Day ${prevDay.day}</button>` : '<div></div>'}
        ${nextDay ? `<button id="next-btn" type="button" class="nav-btn">Day ${nextDay.day} →</button>` : '<div></div>'}
      </div>
    </div>
  `;

  document.getElementById('complete-btn').onclick = () => toggleComplete(dayData.day);

  const noteInput = document.getElementById('note-input');
  const savedMsg = document.getElementById('note-saved');
  noteInput.oninput = () => {
    state.progress.notes[dayData.day] = noteInput.value;
    saveProgress();
    if (savedMsg) {
      savedMsg.textContent = 'Saving…';
      clearTimeout(noteInput._savedTimer);
      noteInput._savedTimer = setTimeout(() => { savedMsg.textContent = 'Saved ✓'; }, 900);
    }
  };

  if (prevDay) document.getElementById('prev-btn').onclick = () => openDay(prevDay);
  if (nextDay) document.getElementById('next-btn').onclick = () => openDay(nextDay);

  showView('detail-view');
  window.scrollTo(0, 0);
}

function toggleComplete(dayNum) {
  const wasComplete = !!state.progress.completed[dayNum];
  if (wasComplete) {
    delete state.progress.completed[dayNum];
  } else {
    state.progress.completed[dayNum] = Date.now();
  }
  saveProgress({ immediate: true });

  const btn = document.getElementById('complete-btn');
  if (btn) {
    const isCompleted = !!state.progress.completed[dayNum];
    btn.textContent = isCompleted ? 'Completed ✓' : 'Mark as Complete';
    btn.classList.toggle('completed-state', isCompleted);
  }

  // Celebrate finishing the whole journey.
  if (!wasComplete && Object.keys(state.progress.completed).length === TOTAL_DAYS) {
    celebrateCompletion();
  }
}

function celebrateCompletion() {
  const overlay = document.createElement('div');
  overlay.className = 'celebrate-overlay';
  overlay.innerHTML = `
    <div class="celebrate-card" role="dialog" aria-modal="true" aria-label="Journey complete">
      <div class="celebrate-emoji" aria-hidden="true">🎉</div>
      <h2>Journey Complete</h2>
      <p>You finished all ${TOTAL_DAYS} days. The art of imperfect living is a lifelong practice — well done.</p>
      <div class="celebrate-actions">
        <button id="celebrate-export" type="button" class="btn-secondary">Export my notes</button>
        <button id="celebrate-close" type="button" class="btn-primary">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('#celebrate-close').onclick = close;
  overlay.querySelector('#celebrate-export').onclick = () => { exportData(); close(); };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('btn-intro').onclick = () => showTextPage('Introduction', meditationData.introduction);
  document.getElementById('btn-howto').onclick = () => showTextPage('How to Use', meditationData.howToUse);

  document.getElementById('link-about').onclick = (e) => { e.preventDefault(); showTextPage('About', meditationData.about); };
  document.getElementById('link-references').onclick = (e) => { e.preventDefault(); showTextPage('References', meditationData.references); };
  document.getElementById('link-conclusion').onclick = (e) => { e.preventDefault(); showTextPage('Conclusion', meditationData.conclusion); };

  document.getElementById('back-btn').onclick = () => showView('main-view');

  // Data management controls.
  const exportBtn = document.getElementById('btn-export');
  if (exportBtn) exportBtn.onclick = exportData;
  const resetBtn = document.getElementById('btn-reset');
  if (resetBtn) resetBtn.onclick = clearProgress;
  const importInput = document.getElementById('import-input');
  const importBtn = document.getElementById('btn-import');
  if (importBtn && importInput) {
    importBtn.onclick = () => importInput.click();
    importInput.onchange = () => {
      if (importInput.files && importInput.files[0]) importData(importInput.files[0]);
      importInput.value = '';
    };
  }

  // Escape closes the detail view.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('detail-view').style.display === 'block') {
      showView('main-view');
    }
  });

  // Flush pending sync before the tab is hidden/closed.
  window.addEventListener('beforeunload', () => saveProgress({ immediate: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveProgress({ immediate: true });
  });

  renderApp();
  await loadProgress();

  // Register service worker for offline use.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW registration failed', e));
  }
});

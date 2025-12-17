import { meditationData } from './data.js';

// State
const state = {
  progress: {
    completed: {}, // dayNum -> timestamp
    notes: {},      // dayNum -> string
    lastActiveDay: 1
  },
  userId: null
};

// --- Storage & API ---

function getUserId() {
  let id = localStorage.getItem('mfm_user_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('mfm_user_id', id);
  }
  return id;
}

async function loadProgress() {
  state.userId = getUserId();

  // Try local storage first for speed
  const local = localStorage.getItem('mfm_progress');
  if (local) {
    try {
      state.progress = { ...state.progress, ...JSON.parse(local) };
      updateUI(); // Immediate render
    } catch (e) {
      console.error("Local storage parse error", e);
    }
  }

  // Then fetch from server to sync (if Netlify functions exist)
  try {
    const res = await fetch(`/.netlify/functions/loadProgress?userId=${state.userId}`);
    if (res.ok) {
      const remoteData = await res.json();
      if (remoteData && Object.keys(remoteData).length > 0) {
        state.progress = { ...state.progress, ...remoteData };
        localStorage.setItem('mfm_progress', JSON.stringify(state.progress));
        updateUI();
      }
    }
  } catch (e) {
    console.warn("Server sync failed, running locally", e);
  }
}

async function saveProgress() {
  localStorage.setItem('mfm_progress', JSON.stringify(state.progress));

  // Sync to server
  try {
    fetch('/.netlify/functions/saveProgress', {
      method: 'POST',
      body: JSON.stringify({ userId: state.userId, data: state.progress })
    });
  } catch (e) {
    console.warn("Server save failed", e);
  }
}

// --- UI Rendering ---

function renderApp() {
  const container = document.getElementById('app-content');
  container.innerHTML = '';

  // 1. Introduction Snippet (Collapsible or just a header?)
  // Let's make the main view the "Map" of the journey

  // 1. Introduction Snippet
  const introParams = document.createElement('div');
  introParams.className = 'intro-summary';
  introParams.innerHTML = `<p>A 28-day journey to embrace your limitations.</p>`;
  container.appendChild(introParams);

  // 2. Weeks
  meditationData.weeks.forEach(week => {
    const weekSection = document.createElement('div');
    weekSection.className = 'week-section';

    const weekHeader = document.createElement('h2');
    weekHeader.className = 'week-header';
    weekHeader.innerText = week.title; // "Week 1", etc.
    // We might want accurate titles "Week 1: Embracing Reality"
    // The parser put "Week 1" as title but often the text has "WEEK 1: EMBRACING REALITY"

    // Let's see if we can extract a better title from the first day's fullText or intro?
    // Actually, let's just use what we have, or maybe the intro text has the title.
    // The parser extracted "Week 1". Let's stick with that for now, or improve parser later.

    weekSection.appendChild(weekHeader);

    // If there is a week intro, maybe a button to read it?
    if (week.intro) {
      const wIntroBtn = document.createElement('button');
      wIntroBtn.className = 'btn-text-small';
      wIntroBtn.innerText = "Read Week Intro";
      wIntroBtn.onclick = () => showTextPage(week.title, week.intro);
      weekSection.appendChild(wIntroBtn);
    }

    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    week.days.forEach(day => {
      const card = document.createElement('div');
      card.className = 'calendar-day';
      card.dataset.day = day.day;

      // Check status
      const isCompleted = !!state.progress.completed[day.day];
      if (isCompleted) card.classList.add('completed');

      // Locked logic? Maybe unlock all for now, or strictly sequential?
      // User requested "Populate Content", didn't specify strict locking.
      // Let's leave unlocked for easy testing.

      card.innerHTML = `
                <div class="day-number">${day.day}</div>
                <div class="day-info">
                    <div class="day-title">${day.title}</div>
                    ${day.subtitle ? `<div class="day-subtitle">${day.subtitle}</div>` : ''}
                </div>
                ${isCompleted ? '<span class="check-mark">✓</span>' : ''}
            `;

      card.onclick = () => openDay(day);
      grid.appendChild(card);
    });

    weekSection.appendChild(grid);
    container.appendChild(weekSection);
  });
}

function updateUI() {
  // Update progress bars and checkmarks without full re-render
  const completedCount = Object.keys(state.progress.completed).length;
  const totalDays = 28; // Hardcoded or dynamic
  const percent = Math.min(100, Math.round((completedCount / totalDays) * 100));

  document.getElementById('progress-fill').style.width = `${percent}%`;
  document.getElementById('progress-text').innerText = `${completedCount} of ${totalDays} days completed`;

  // Update day cards
  document.querySelectorAll('.calendar-day').forEach(card => {
    const d = card.dataset.day;
    if (state.progress.completed[d]) {
      card.classList.add('completed');
      if (!card.querySelector('.check-mark')) {
        card.innerHTML += '<span class="check-mark">✓</span>';
      }
    } else {
      card.classList.remove('completed');
      const check = card.querySelector('.check-mark');
      if (check) check.remove();
    }
  });
}

// --- Detail View Logic ---

function showView(viewId) {
  document.getElementById('main-view').style.display = viewId === 'main-view' ? 'block' : 'none';
  document.getElementById('detail-view').style.display = viewId === 'detail-view' ? 'block' : 'none';
  if (viewId === 'main-view') {
    window.scrollTo(0, 0); // Reset scroll
    updateUI();
  }
}

function formatText(text) {
  if (!text) return '';

  // 1. Convert * Bullet points
  // Split by newline
  const lines = text.split('\n');
  let html = '';
  let inList = false;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      return;
    }

    if (trimmed.startsWith('*')) {
      if (!inList) {
        html += '<ul class="content-list">';
        inList = true;
      }
      html += `<li>${trimmed.substring(1).trim()}</li>`;
    } else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }

      // 2. Bold specific "Headers" (lines ending in colon or specific keywords)
      // e.g. "Core Insight:", "Today's Objective:", "Reflection Questions:"
      // Also apply paragraph tags
      const boldPrefixes = [
        "Core Insight:", "Today's Objective:", "Today's Task:",
        "Real-World Example:", "Netflix Example:", "Movie Example:",
        "Reflection Questions:", "Notes Space:", "Weekly Integration Questions:"
      ];

      let processedLine = trimmed;

      // Check if line starts with any bold prefix
      for (const prefix of boldPrefixes) {
        if (processedLine.startsWith(prefix)) {
          // Wrap the prefix in strong
          // Or if the whole line is just the prefix?
          // The text usually follows: "Core Insight: Life..."
          // Let's bold the prefix part only? or the whole line if it's a header?
          // User said "bold section headers". 
          // Usually in this text "Core Insight:" is the header for the paragraph.
          const parts = processedLine.split(prefix);
          processedLine = `<strong class="section-header">${prefix}</strong>` + parts.slice(1).join(prefix);
          break;
        }
      }

      html += `<p>${processedLine}</p>`;
    }
  });

  if (inList) {
    html += '</ul>';
  }

  return html;
}

function showTextPage(title, text) {
  const content = document.getElementById('detail-content');
  // Simple regex to make formatted text look decent (newlines to paragraphs)
  const formattedText = formatText(text);

  content.innerHTML = `
        <div class="text-page">
            <h2>${title}</h2>
            <div class="text-body">${formattedText}</div>
        </div>
    `;
  showView('detail-view');
}

function openDay(dayData) {
  const content = document.getElementById('detail-content');
  const isCompleted = !!state.progress.completed[dayData.day];
  const userNotes = state.progress.notes[dayData.day] || '';

  // Parse Full Text significantly better
  // The fullText contains headers like "Core Insight:", "Today's Task:", etc.
  // We can just format newline -> p for now, maybe bolding "Header:" patterns.

  let htmlContent = dayData.fullText
    .replace(/(Core Insight:|Today's Objective:|Today's Task:|Reflection Questions:|Matrix Example:|Netflix Example:|Movie Example:|Example:|Real-World Example:)/g, '<strong>$1</strong>')
    .split('\n').map(l => l.trim() ? `<p>${l}</p>` : '').join('');

  content.innerHTML = `
        <div class="day-detail">
            <h2>Day ${dayData.day}: ${dayData.title}</h2>
            
            <div class="meditation-content">
                ${htmlContent}
            </div>
            
            <div class="interaction-area">
                <div class="notes-section">
                    <h3>Your Notes</h3>
                    <textarea id="note-input" placeholder="Reflect on today's practice...">${userNotes}</textarea>
                </div>
                
                <button id="complete-btn" class="btn-primary ${isCompleted ? 'completed-state' : ''}">
                    ${isCompleted ? 'Completed ✓' : 'Mark as Complete'}
                </button>
            </div>
            
            <div class="navigation-footer">
                ${dayData.day > 1 ? `<button id="prev-btn" class="nav-btn">← Day ${dayData.day - 1}</button>` : '<div></div>'}
                ${dayData.day < 28 ? `<button id="next-btn" class="nav-btn">Day ${dayData.day + 1} →</button>` : '<div></div>'}
            </div>
        </div>
    `;

  // Bind Events
  document.getElementById('complete-btn').onclick = () => toggleComplete(dayData.day);

  const noteInput = document.getElementById('note-input');
  noteInput.oninput = () => {
    state.progress.notes[dayData.day] = noteInput.value;
    saveProgress();
  };

  const prevBtn = document.getElementById('prev-btn');
  if (prevBtn) prevBtn.onclick = () => {
    // Find prev day data
    // Need flat list or lookup
    // Doing simple look up by finding day in appropriate week
    const prevDayNum = dayData.day - 1;
    const prevWeek = meditationData.weeks[Math.ceil(prevDayNum / 7) - 1];
    const prevDay = prevWeek?.days.find(d => d.day === prevDayNum);
    if (prevDay) openDay(prevDay);
  };

  const nextBtn = document.getElementById('next-btn');
  if (nextBtn) nextBtn.onclick = () => {
    const nextDayNum = dayData.day + 1;
    const nextWeek = meditationData.weeks[Math.ceil(nextDayNum / 7) - 1];
    const nextDay = nextWeek?.days.find(d => d.day === nextDayNum);
    if (nextDay) openDay(nextDay);
  };

  showView('detail-view');
  window.scrollTo(0, 0);
}

function toggleComplete(dayNum) {
  if (state.progress.completed[dayNum]) {
    delete state.progress.completed[dayNum];
  } else {
    state.progress.completed[dayNum] = Date.now();
  }
  saveProgress();

  // Update button state immediately
  const btn = document.getElementById('complete-btn');
  const isCompleted = !!state.progress.completed[dayNum];
  btn.textContent = isCompleted ? 'Completed ✓' : 'Mark as Complete';
  btn.classList.toggle('completed-state', isCompleted);
}


// --- Initialization ---

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation Links
  document.getElementById('btn-intro').onclick = () => showTextPage("Introduction", meditationData.introduction);
  document.getElementById('btn-howto').onclick = () => showTextPage("How to Use", meditationData.howToUse);

  document.getElementById('link-about').onclick = (e) => { e.preventDefault(); showTextPage("About", meditationData.about); };
  document.getElementById('link-references').onclick = (e) => { e.preventDefault(); showTextPage("References", meditationData.references); };
  document.getElementById('link-conclusion').onclick = (e) => { e.preventDefault(); showTextPage("Conclusion", meditationData.conclusion); };

  document.getElementById('back-btn').onclick = () => showView('main-view');

  renderApp();
  await loadProgress();
});

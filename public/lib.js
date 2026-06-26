// Pure, framework-free helpers shared by the app and tests.
// Kept dependency-free and DOM-free so they can be unit-tested in Node.

export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeProgress(p, minDay = 1) {
  return {
    completed: (p && typeof p.completed === 'object' && p.completed) || {},
    notes: (p && typeof p.notes === 'object' && p.notes) || {},
    lastActiveDay: (p && Number(p.lastActiveDay)) || minDay
  };
}

// Longest run of consecutive completed day numbers.
export function computeStreak(completed, validDayNums) {
  const valid = new Set(validDayNums);
  const nums = Object.keys(completed || {})
    .map(Number)
    .filter(n => valid.has(n))
    .sort((a, b) => a - b);
  if (nums.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === nums[i - 1] + 1) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

export function prettyWeekTitle(week) {
  const raw = (week && week.title) || `Week ${week && week.number}`;
  const m = raw.match(/^WEEK\s+(\d+):\s*(.*)$/i);
  if (!m) return raw;
  const subtitle = m[2].toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  return `Week ${m[1]}: ${subtitle}`;
}

const SECTION_PREFIXES = [
  "Core Insight:", "Today's Objective:", "Today's Task:",
  "Real-World Example:", "Netflix Example:", "Movie Example:",
  "Matrix Example:", "Example:",
  "Reflection Questions:", "Notes Space:", "Weekly Integration Questions:"
];

export function formatText(text) {
  if (!text) return '';
  const lines = text.split('\n');
  let html = '';
  let inList = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };

  lines.forEach(rawLine => {
    const trimmed = rawLine.trim();
    if (!trimmed) { closeList(); return; }
    if (trimmed.startsWith('*')) {
      if (!inList) { html += '<ul class="content-list">'; inList = true; }
      html += `<li>${escapeHtml(trimmed.substring(1).trim())}</li>`;
      return;
    }
    closeList();
    const safe = escapeHtml(trimmed);
    const matched = SECTION_PREFIXES.find(p => trimmed.startsWith(p));
    if (matched) {
      const safePrefix = escapeHtml(matched);
      html += `<p><strong class="section-header">${safePrefix}</strong>${safe.slice(safePrefix.length)}</p>`;
    } else {
      html += `<p>${safe}</p>`;
    }
  });
  closeList();
  return html;
}

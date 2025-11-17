// Meditations for Mortals - Main App Logic

// UUID generation for userId
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Get or create userId
function getUserId() {
  let userId = localStorage.getItem('meditationsUserId');
  if (!userId) {
    userId = generateUUID();
    localStorage.setItem('meditationsUserId', userId);
  }
  return userId;
}

const userId = getUserId();

// Meditation data structure (Days 1-28)
const meditationData = {
  weeks: [
    {
      number: 1,
      theme: "Being Finite (Facing the fact of our finitude)",
      days: [
        {
          day: 1,
          title: "It's Worse Than You Think",
          subtitle: "On the Liberation of Defeat",
          keyPhrase: "When you stop trying to win an unwinnable game, you become free to play a different game.",
          meditation: `The first step toward freedom is accepting a fundamental truth: you will never get on top of everything. Not in six months, not in a year, not ever. There is no finish line. This isn't pessimism—it's realism.

Productivity culture has sold us a lie: that with the right system, enough discipline, and proper time management, we could someday achieve a state of perfect control where all tasks are completed and we can finally relax. That state does not exist.

Once you accept that the game itself is unwinnable, you can stop playing by those rules. You can stop measuring your worth by an impossible metric. You can start asking the real question: Given that I have limited time and can only do a fraction of what's available to do, what actually matters?

This is the liberation of defeat—not the defeat of accomplishment, but the defeat of the illusion that perfect control is possible. When you stop trying to win an unwinnable game, you become free to play a different game entirely.`,
          reflections: [
            "What would change if you truly accepted that you'll never get on top of everything?",
            "How might the 'liberation of defeat' free you to act differently today?",
            "What are you postponing until you've 'dealt with everything'?",
            "Who told you that perfect control was possible?",
            "If you accepted that you can only do a fraction of what's available, what would you choose?"
          ]
        }
        // Additional days would follow the same structure...
      ]
    }
    // Additional weeks...
  ]
};

// State management
let currentDay = 1;
let progressData = {
  completed: {},
  notes: {},
  lastAccessed: null
};

// Load progress from server
async function loadProgress() {
  try {
    console.log('Loading progress for userId:', userId);
    const response = await fetch(`/.netlify/functions/loadProgress?userId=${userId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Loaded data:', data);
    
    if (data.progressData && Object.keys(data.progressData).length > 0) {
      progressData = data.progressData;
      console.log('Progress data loaded:', progressData);
    } else {
      console.log('No existing progress data found, starting fresh');
    }
    
    updateUI();
  } catch (error) {
    console.error('Error loading progress:', error);
    showNotification('Failed to load progress', 'error');
  }
}

// Save progress to server
async function saveProgress() {
  try {
    progressData.lastAccessed = new Date().toISOString();
    console.log('Saving progress for userId:', userId, 'Data:', progressData);
    
    const response = await fetch('/.netlify/functions/saveProgress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, progressData })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Save result:', result);
    showNotification('Progress saved ✓');
  } catch (error) {
    console.error('Error saving progress:', error);
    showNotification('Save failed', 'error');
  }
}

// Clear all progress
async function clearProgress() {
  if (!confirm('Are you sure you want to clear all your progress and notes?')) {
    return;
  }

  try {
    await fetch('/.netlify/functions/clearProgress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });

    progressData = { completed: {}, notes: {}, lastAccessed: null };
    updateUI();
    showNotification('Progress cleared');
  } catch (error) {
    console.error('Error clearing progress:', error);
  }
}

// Mark day as complete/incomplete
function toggleComplete(day) {
  progressData.completed[day] = !progressData.completed[day];
  saveProgress();
  updateUI();
}

// Save notes for a day
function saveNotes(day, notes) {
  progressData.notes[day] = notes;
  saveProgress();
}

// Get completion percentage
function getCompletionPercentage() {
  const completed = Object.values(progressData.completed).filter(Boolean).length;
  return Math.round((completed / 28) * 100);
}

// Show notification
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// Update UI with current progress
function updateUI() {
  // Update calendar view
  const calendarDays = document.querySelectorAll('.calendar-day');
  calendarDays.forEach(dayEl => {
    const day = parseInt(dayEl.dataset.day);
    if (progressData.completed[day]) {
      dayEl.classList.add('completed');
    } else {
      dayEl.classList.remove('completed');
    }
  });

  // Update progress bar
  const progressBar = document.querySelector('.progress-fill');
  if (progressBar) {
    progressBar.style.width = `${getCompletionPercentage()}%`;
  }

  // Update progress text
  const progressText = document.querySelector('.progress-text');
  if (progressText) {
    const completed = Object.values(progressData.completed).filter(Boolean).length;
    progressText.textContent = `${completed} of 28 days completed`;
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  console.log('App initializing with userId:', userId);
  
  // Load progress first
  await loadProgress();
  
  // Set up event listeners
  document.getElementById('clearProgress')?.addEventListener('click', clearProgress);
  
  console.log('App initialized, current progress:', progressData);
});

// Export functions for use in HTML
window.meditationApp = {
  toggleComplete,
  saveNotes,
  loadProgress,
  saveProgress,
  clearProgress,
  getUserId: () => userId,
  progressData  // Export progressData so it can be accessed
};

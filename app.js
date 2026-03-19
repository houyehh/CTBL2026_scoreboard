/* ========================================================
   Basketball Scoreboard — Application Logic (v2)
   ======================================================== */

// ---- State ----
let teamsData = {};
let selectedRole = null;
let selectedTeamLeft = '';
let selectedTeamRight = '';

// Page A state
let scoreLeft = 0;
let scoreRight = 0;
let mainTimerMs = 600000; // 10:00 in ms
let mainTimerRunning = false;
let mainTimerInterval = null;
let quarterA = 1;

// Page B state
let shotClockMs = 24000; // 24.0s in ms
let shotClockRunning = false;
let shotClockInterval = null;
let quarterB = 1;
let playerFouls = {}; // { key: totalCount } — persists across quarters
let playerFoulsByQuarter = {}; // { quarter: { key: count } } — resets per quarter for team foul display
let possession = null; // 'left' or 'right'

// Timer edit mode
let timerEditTarget = null; // 'main' or 'shot'

const ROLE_PAGE_MAP = {
  A: 'page-a',
  A_PRIME: 'page-a-prime',
  B: 'page-b',
  B_PRIME: 'page-b-prime'
};

function setTextIfExists(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setTexts(ids, value) {
  ids.forEach(id => setTextIfExists(id, value));
}

function renderScoreDisplays() {
  setTexts(['score-left', 'score-left-a-prime'], scoreLeft);
  setTexts(['score-right', 'score-right-a-prime'], scoreRight);
}

function renderQuarterDisplays() {
  setTexts(['quarter-a-num', 'quarter-a-prime-num'], quarterA);
  setTexts(['quarter-b-num', 'quarter-b-prime-num'], quarterB);
}

function getRolePageId(role) {
  return ROLE_PAGE_MAP[role] || 'page-home';
}

// ---- Initialization ----
document.addEventListener('DOMContentLoaded', async () => {
  await loadTeams();
  restoreState();
  setupBeforeUnload();
  registerServiceWorker();
  setupKeyboard();
});

async function loadTeams() {
  try {
    const resp = await fetch('teams.json');
    teamsData = await resp.json();
    // Sort all rosters by player number (numeric)
    for (const teamName in teamsData) {
      teamsData[teamName].sort((a, b) => {
        const numA = parseInt(a.number) || 0;
        const numB = parseInt(b.number) || 0;
        return numA - numB;
      });
    }
  } catch (e) {
    console.warn('Could not load teams.json:', e);
    teamsData = {};
  }
  populateDropdowns();
}

function populateDropdowns() {
  const selLeft = document.getElementById('select-team-left');
  const selRight = document.getElementById('select-team-right');
  const teamNames = Object.keys(teamsData);
  teamNames.forEach(name => {
    selLeft.appendChild(new Option(name, name));
    selRight.appendChild(new Option(name, name));
  });

  selLeft.addEventListener('change', () => {
    selectedTeamLeft = selLeft.value;
    saveState();
  });
  selRight.addEventListener('change', () => {
    selectedTeamRight = selRight.value;
    saveState();
  });
}

// ---- Role Selection ----
function selectRole(role) {
  selectedRole = role;
  document.querySelectorAll('.btn-role').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.role === role);
  });
  saveState();
}

function enterRole() {
  if (!selectedRole) {
    alert('請先選擇角色！');
    return;
  }
  if (!selectedTeamLeft || !selectedTeamRight) {
    alert('請先選擇兩支隊伍！');
    return;
  }
  updateTeamNames();
  const pageId = getRolePageId(selectedRole);
  if (pageId === 'page-b' || pageId === 'page-b-prime') {
    buildPlayerLists();
  }
  showPage(pageId);
  saveState();
}

function updateTeamNames() {
  setTexts(['team-name-left-a', 'team-name-left-a-prime'], selectedTeamLeft);
  setTexts(['team-name-right-a', 'team-name-right-a-prime'], selectedTeamRight);
  setTexts(['panel-header-left', 'panel-header-left-b-prime'], selectedTeamLeft);
  setTexts(['panel-header-right', 'panel-header-right-b-prime'], selectedTeamRight);
}

// ---- New Game ----
function newGame() {
  if (!confirm('確定要開始新比賽嗎？所有紀錄將歸零！')) return;
  scoreLeft = 0;
  scoreRight = 0;
  mainTimerMs = 600000;
  quarterA = 1;
  shotClockMs = 24000;
  quarterB = 1;
  playerFouls = {};
  playerFoulsByQuarter = {};
  possession = null;
  pauseMainTimer();
  pauseShotClock();

  // Update displays
  renderScoreDisplays();
  renderMainTimer();
  renderShotClock();
  renderQuarterDisplays();
  updateTeamFoulDisplays();
  updatePossessionUI();
  if (selectedTeamLeft && selectedTeamRight) buildPlayerLists();
  saveState();
}

// ---- Page Navigation ----
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  saveState();
}

function goHome() {
  pauseMainTimer();
  pauseShotClock();
  showPage('page-home');
}

// ---- Keyboard ----
function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const modal = document.getElementById('timer-edit-modal');
      if (modal.style.display !== 'none') {
        confirmTimerEdit();
        return;
      }
      const activePage = document.querySelector('.page.active');
      if (activePage.id === 'page-home') {
        enterRole();
      }
    }
  });
}


// ============================================================
// PAGE A — Main Timer & Scoring
// ============================================================

function toggleMainTimer() {
  if (mainTimerRunning) {
    pauseMainTimer();
  } else {
    startMainTimer();
  }
}

function startMainTimer() {
  if (mainTimerMs <= 0) return;
  mainTimerRunning = true;
  setTexts(['btn-timer-a-toggle', 'btn-timer-a-prime-toggle'], '⏸');
  const tick = mainTimerMs <= 60000 ? 100 : 1000; // 0.1s precision in last minute
  mainTimerInterval = setInterval(() => {
    mainTimerMs -= tick;
    if (mainTimerMs <= 0) {
      mainTimerMs = 0;
      pauseMainTimer();
    }
    // Switch to 100ms ticks when entering last minute
    if (mainTimerMs <= 60000 && tick === 1000) {
      clearInterval(mainTimerInterval);
      mainTimerInterval = null;
      renderMainTimer();
      if (mainTimerMs > 0) startMainTimer(); // restart with 100ms ticks
      return;
    }
    renderMainTimer();
    // Save less frequently when using fast ticks
    if (tick === 1000 || mainTimerMs % 1000 === 0) saveState();
  }, tick);
}

function pauseMainTimer() {
  mainTimerRunning = false;
  clearInterval(mainTimerInterval);
  mainTimerInterval = null;
  setTexts(['btn-timer-a-toggle', 'btn-timer-a-prime-toggle'], '▶');
}

function renderMainTimer() {
  const totalSec = mainTimerMs / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;

  if (mainTimerMs <= 60000 && mainTimerMs > 0) {
    // Last minute: show MM:SS.T format
    setTexts(['timer-a-min', 'timer-a-prime-min'], String(min).padStart(2, '0'));
    setTexts(['timer-a-sec', 'timer-a-prime-sec'], sec.toFixed(1).padStart(4, '0'));
  } else {
    setTexts(['timer-a-min', 'timer-a-prime-min'], String(min).padStart(2, '0'));
    setTexts(['timer-a-sec', 'timer-a-prime-sec'], String(Math.floor(sec)).padStart(2, '0'));
  }
}

function editMainTimer() {
  pauseMainTimer();
  timerEditTarget = 'main';
  const totalMs = mainTimerMs;
  const min = Math.floor(totalMs / 60000);
  const sec = Math.floor((totalMs % 60000) / 1000);
  const tenth = Math.floor((totalMs % 1000) / 100);
  document.getElementById('modal-title').textContent = '編輯比賽時間';
  buildPicker(min, sec, tenth, true);
  document.getElementById('timer-edit-modal').style.display = '';
}

// ---- Scoring ----
function addScore(side, amount) {
  if (side === 'left') {
    scoreLeft = Math.max(0, scoreLeft + amount);
  } else {
    scoreRight = Math.max(0, scoreRight + amount);
  }
  renderScoreDisplays();
  saveState();
}

function swapScores() {
  // Swap scores
  const temp = scoreLeft;
  scoreLeft = scoreRight;
  scoreRight = temp;
  renderScoreDisplays();

  // Swap the internal selected teams
  const tempTeam = selectedTeamLeft;
  selectedTeamLeft = selectedTeamRight;
  selectedTeamRight = tempTeam;
  document.getElementById('select-team-left').value = selectedTeamLeft;
  document.getElementById('select-team-right').value = selectedTeamRight;
  updateTeamNames();
  updateTeamFoulDisplays();
  buildPlayerLists();

  saveState();
}

// ---- Quarter ----
function cycleQuarter(page) {
  if (page === 'a' || page === 'a-prime') {
    quarterA = (quarterA % 4) + 1;
    renderQuarterDisplays();
  } else {
    quarterB = (quarterB % 4) + 1;
    renderQuarterDisplays();
    // Clear this quarter's per-quarter foul counts (new quarter starts fresh team foul count)
    playerFoulsByQuarter[quarterB] = {};
    // Rebuild lists to show updated per-quarter counts
    buildPlayerLists();
  }
  saveState();
}

// ============================================================
// PAGE B — Shot Clock & Fouls
// ============================================================

function toggleShotClock() {
  if (shotClockRunning) {
    pauseShotClock();
  } else {
    startShotClock();
  }
}

function startShotClock() {
  if (shotClockMs <= 0) return;
  shotClockRunning = true;
  setTexts(['btn-shot-toggle', 'btn-shot-a-prime-toggle'], '⏸');
  shotClockInterval = setInterval(() => {
    shotClockMs -= 100;
    if (shotClockMs <= 0) {
      shotClockMs = 0;
      pauseShotClock();
    }
    renderShotClock();
    if (shotClockMs % 1000 === 0) saveState();
  }, 100);
}

function pauseShotClock() {
  shotClockRunning = false;
  clearInterval(shotClockInterval);
  shotClockInterval = null;
  setTexts(['btn-shot-toggle', 'btn-shot-a-prime-toggle'], '▶');
}

function renderShotClock() {
  const totalSec = shotClockMs / 1000;
  setTexts(['shot-clock-val', 'shot-clock-a-prime-val'], totalSec.toFixed(1));
}

function resetShotClock(seconds) {
  pauseShotClock();
  shotClockMs = seconds * 1000;
  renderShotClock();
  saveState();
  // Auto-start after reset
  startShotClock();
}

function editShotClock() {
  pauseShotClock();
  timerEditTarget = 'shot';
  const totalMs = shotClockMs;
  const sec = Math.floor(totalMs / 1000);
  const tenth = Math.floor((totalMs % 1000) / 100);
  document.getElementById('modal-title').textContent = '編輯進攻時間';
  buildPicker(0, sec, tenth, false);
  document.getElementById('timer-edit-modal').style.display = '';
}

// ---- Possession ----
function togglePossession(side) {
  possession = (possession === side) ? null : side;
  updatePossessionUI();
  saveState();
}

function updatePossessionUI() {
  const btnL = document.getElementById('btn-poss-left');
  const btnR = document.getElementById('btn-poss-right');
  if (btnL) btnL.classList.toggle('active', possession === 'left');
  if (btnR) btnR.classList.toggle('active', possession === 'right');
}

// ============================================================
// iPhone-style Scroll Picker
// ============================================================

/*
  3-column picker:
  - minutes (0-20, step 1) — hidden for shot clock
  - seconds (0-59 for main, 0-30 for shot clock, step 1)
  - tenths  (0-9, step 1)
*/

function buildPicker(minVal, secVal, tenthVal, showMin) {
  const colMin = document.getElementById('picker-col-min');
  const colonSep = document.getElementById('picker-colon-sep');
  const dotSep = document.getElementById('picker-dot-sep');

  // Always show dot + tenth column
  dotSep.style.display = '';
  document.getElementById('picker-col-tenth').style.display = '';

  if (showMin) {
    colMin.style.display = '';
    colonSep.style.display = '';
    buildPickerColumn('picker-col-min', 0, 20, 1, minVal);
    buildPickerColumn('picker-col-sec', 0, 59, 1, secVal);
  } else {
    colMin.style.display = 'none';
    colonSep.style.display = 'none';
    buildPickerColumn('picker-col-sec', 0, 30, 1, secVal);
  }
  buildPickerColumn('picker-col-tenth', 0, 9, 1, tenthVal);
}

function buildPickerColumn(colId, min, max, step, currentVal) {
  const col = document.getElementById(colId);
  const scrollEl = col.querySelector('.picker-scroll');
  scrollEl.innerHTML = '';

  // Top spacer so first item can be centered
  const topSpacer = document.createElement('div');
  topSpacer.className = 'picker-spacer';
  scrollEl.appendChild(topSpacer);

  const items = [];
  for (let v = min; v <= max + step * 0.01; v = Math.round((v + step) * 10) / 10) {
    const val = Math.round(v * 10) / 10;
    const item = document.createElement('div');
    item.className = 'picker-item';
    item.textContent = step < 1 ? val.toFixed(1) : String(Math.round(val)).padStart(2, '0');
    item.dataset.value = val;
    scrollEl.appendChild(item);
    items.push({ el: item, val });
  }

  // Bottom spacer so last item can be centered
  const botSpacer = document.createElement('div');
  botSpacer.className = 'picker-spacer';
  scrollEl.appendChild(botSpacer);

  // Find closest index to currentVal
  const nearest = Math.round(Math.round(currentVal / step) * step * 10) / 10;
  const idx = items.findIndex(it => Math.abs(it.val - nearest) < step * 0.5);
  const targetIdx = idx >= 0 ? idx : 0;

  requestAnimationFrame(() => {
    scrollEl.scrollTop = targetIdx * 40;
    const liveEl = setupPickerScroll(scrollEl);
    updatePickerSelection(liveEl);
  });
}

function setupPickerScroll(scrollEl) {
  // Clone to remove any stale listeners
  const newEl = scrollEl.cloneNode(true);
  scrollEl.parentNode.replaceChild(newEl, scrollEl);
  newEl.scrollTop = scrollEl.scrollTop; // restore position

  let scrollTimeout;
  newEl.addEventListener('scroll', () => {
    updatePickerSelection(newEl);
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => snapPicker(newEl), 80);
  }, { passive: true });

  return newEl; // return the live element
}

function updatePickerSelection(scrollEl) {
  const itemHeight = 40;
  // scrollTop = idx * 40 means item[idx] is centered (spacers handle first/last item)
  const selectedIdx = scrollEl.scrollTop / itemHeight;
  const items = scrollEl.querySelectorAll('.picker-item');
  items.forEach((item, i) => {
    item.classList.toggle('selected', Math.abs(i - selectedIdx) < 0.5);
  });
}

function snapPicker(scrollEl) {
  const itemHeight = 40;
  const idx = Math.round(scrollEl.scrollTop / itemHeight);
  scrollEl.scrollTo({ top: idx * itemHeight, behavior: 'smooth' });
}

function getPickerValue(colId) {
  const scrollEl = document.querySelector('#' + colId + ' .picker-scroll');
  if (!scrollEl) return 0;
  const itemHeight = 40;
  const items = scrollEl.querySelectorAll('.picker-item');
  const idx = Math.round(scrollEl.scrollTop / itemHeight);
  const clamped = Math.max(0, Math.min(idx, items.length - 1));
  return parseFloat(items[clamped].dataset.value) || 0;
}

function confirmTimerEdit() {
  if (timerEditTarget === 'main') {
    const min = getPickerValue('picker-col-min');
    const sec = getPickerValue('picker-col-sec');
    const tenth = getPickerValue('picker-col-tenth');
    mainTimerMs = Math.max(0, (min * 60 + sec) * 1000 + tenth * 100);
    renderMainTimer();
  } else if (timerEditTarget === 'shot') {
    const sec = getPickerValue('picker-col-sec');
    const tenth = getPickerValue('picker-col-tenth');
    shotClockMs = Math.max(0, sec * 1000 + tenth * 100);
    renderShotClock();
  }
  closeTimerModal();
  saveState();
}

function closeTimerModal() {
  document.getElementById('timer-edit-modal').style.display = 'none';
  timerEditTarget = null;
}

function onModalOverlayClick(e) {
  if (e.target === e.currentTarget) closeTimerModal();
}

// ============================================================
// Player Fouls — Both teams on separate panels
// ============================================================

function buildPlayerLists() {
  renderPlayerList('left', selectedTeamLeft, 'player-list-left');
  renderPlayerList('right', selectedTeamRight, 'player-list-right');
  renderPlayerList('left', selectedTeamLeft, 'player-list-left-b-prime');
  renderPlayerList('right', selectedTeamRight, 'player-list-right-b-prime');
  updateTeamFoulDisplays();
}

function renderPlayerList(side, teamName, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  const players = teamsData[teamName] || [];
  if (!playerFoulsByQuarter[quarterB]) playerFoulsByQuarter[quarterB] = {};

  players.forEach(player => {
    const key = teamName + '-' + player.number;
    if (!(key in playerFouls)) playerFouls[key] = 0;
    playerFouls[key] = parseInt(playerFouls[key]) || 0; // sanitize
    if (!(key in playerFoulsByQuarter[quarterB])) playerFoulsByQuarter[quarterB][key] = 0;
    playerFoulsByQuarter[quarterB][key] = parseInt(playerFoulsByQuarter[quarterB][key]) || 0; // sanitize

    const total = playerFouls[key];
    const row = document.createElement('div');
    row.className = 'player-row';
    applyFoulWarning(row, total);

    row.innerHTML = `
      <div class="player-info">
        <span class="player-number">${player.number}</span>
        <span class="player-name">${player.name}</span>
      </div>
      <div class="player-foul-controls">
        <button class="btn-foul" onclick="changePlayerFoul('${key}', -1, this)">−</button>
        <span class="player-foul-total">${total}</span>
        <button class="btn-foul" onclick="changePlayerFoul('${key}', 1, this)">+</button>
      </div>
    `;
    container.appendChild(row);
  });
}

function changePlayerFoul(key, delta, btnEl) {
  if (!(key in playerFouls)) playerFouls[key] = 0;
  if (!playerFoulsByQuarter[quarterB]) playerFoulsByQuarter[quarterB] = {};
  if (!(key in playerFoulsByQuarter[quarterB])) playerFoulsByQuarter[quarterB][key] = 0;

  const newTotal = Math.max(0, playerFouls[key] + delta);
  const actualDelta = newTotal - playerFouls[key];
  playerFouls[key] = newTotal;
  playerFoulsByQuarter[quarterB][key] = Math.max(0, playerFoulsByQuarter[quarterB][key] + actualDelta);

  buildPlayerLists();
  updateTeamFoulDisplays();
  saveState();
}

function applyFoulWarning(row, count) {
  row.classList.remove('foul-3', 'foul-4', 'foul-5');
  if (count >= 5) row.classList.add('foul-5');
  else if (count >= 4) row.classList.add('foul-4');
  else if (count >= 3) row.classList.add('foul-3');
}

function updateTeamFoulDisplays() {
  const qData = playerFoulsByQuarter[quarterB] || {};

  let leftTotal = 0;
  (teamsData[selectedTeamLeft] || []).forEach(p => {
    leftTotal += (qData[selectedTeamLeft + '-' + p.number] || 0);
  });

  let rightTotal = 0;
  (teamsData[selectedTeamRight] || []).forEach(p => {
    rightTotal += (qData[selectedTeamRight + '-' + p.number] || 0);
  });

  ['team-foul-left', 'team-foul-left-b-prime'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = leftTotal;
    el.classList.toggle('foul-red-bg', leftTotal >= 5);
  });

  ['team-foul-right', 'team-foul-right-b-prime'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = rightTotal;
    el.classList.toggle('foul-red-bg', rightTotal >= 5);
  });
}

// ============================================================
// State Persistence (localStorage)
// ============================================================
function saveState() {
  const state = {
    selectedRole,
    selectedTeamLeft,
    selectedTeamRight,
    scoreLeft,
    scoreRight,
    mainTimerMs,
    quarterA,
    quarterB,
    shotClockMs,
    playerFouls,
    playerFoulsByQuarter,
    possession,
    activePage: document.querySelector('.page.active')?.id || 'page-home'
  };
  try {
    localStorage.setItem('scoreboard-state', JSON.stringify(state));
  } catch (e) { /* ignore */ }
}

function restoreState() {
  try {
    const raw = localStorage.getItem('scoreboard-state');
    if (!raw) return;
    const state = JSON.parse(raw);

    selectedRole = state.selectedRole || null;
    selectedTeamLeft = state.selectedTeamLeft || '';
    selectedTeamRight = state.selectedTeamRight || '';
    scoreLeft = state.scoreLeft || 0;
    scoreRight = state.scoreRight || 0;
    // Support old format (mainTimerSeconds) as well as new (mainTimerMs)
    if (state.mainTimerMs !== undefined) {
      mainTimerMs = state.mainTimerMs;
    } else if (state.mainTimerSeconds !== undefined) {
      mainTimerMs = state.mainTimerSeconds * 1000;
    }
    quarterA = state.quarterA || 1;
    quarterB = state.quarterB || 1;
    shotClockMs = state.shotClockMs ?? 24000;
    playerFouls = state.playerFouls || {};
    // Sanitize playerFoulsByQuarter: ensure it's a plain { quarter: { key: int } } structure
    const rawPFBQ = state.playerFoulsByQuarter || {};
    playerFoulsByQuarter = {};
    for (const q of Object.keys(rawPFBQ)) {
      if (typeof rawPFBQ[q] === 'object' && rawPFBQ[q] !== null && !Array.isArray(rawPFBQ[q])) {
        playerFoulsByQuarter[q] = {};
        for (const k of Object.keys(rawPFBQ[q])) {
          playerFoulsByQuarter[q][k] = parseInt(rawPFBQ[q][k]) || 0;
        }
      }
    }
    possession = state.possession || null;

    // Restore UI
    if (selectedRole) {
      document.querySelectorAll('.btn-role').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.role === selectedRole);
      });
    }
    if (selectedTeamLeft) document.getElementById('select-team-left').value = selectedTeamLeft;
    if (selectedTeamRight) document.getElementById('select-team-right').value = selectedTeamRight;

    // Restore displays
    renderScoreDisplays();
    renderMainTimer();
    renderShotClock();
    renderQuarterDisplays();
    updatePossessionUI();

    if (selectedTeamLeft && selectedTeamRight) {
      updateTeamNames();
      updateTeamFoulDisplays();
    }

    // Show the page that was active
    const activePage = state.activePage || 'page-home';
    if (activePage !== 'page-home' && selectedTeamLeft && selectedTeamRight) {
      if (activePage === 'page-b' || activePage === 'page-b-prime') buildPlayerLists();
      showPage(activePage);
    }
  } catch (e) {
    console.warn('Failed to restore state:', e);
  }
}

// ---- Before Unload Warning ----
function setupBeforeUnload() {
  window.addEventListener('beforeunload', (e) => {
    e.preventDefault();
    e.returnValue = '確定要離開嗎？計分資料可能會遺失！';
    return e.returnValue;
  });
}

// ---- Service Worker Registration ----
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('Service Worker registration failed:', err);
    });
  }
}

// ---- Orientation and Auto-Scaling ----
function updateLayout() {
  const pages = document.querySelectorAll('.page');
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isPortrait = vh > vw;
  
  const longEdge = Math.max(vw, vh);
  const shortEdge = Math.min(vw, vh);

  // Reserve ~12px padding on all sides (0.3cm = ~11-12px) = 24px total
  const availableWidth = longEdge - 24;
  const availableHeight = shortEdge - 24;

  const baseWidth = 1100;
  // Calculate scale based on available width against original base width 1100.
  // We only scale down (so scale <= 1) to fit the display parts. Key buttons stay unscaled.
  let scaleW = availableWidth / baseWidth;
  let scaleH = availableHeight / 600; // rough baseline for height
  
  // We take the minimum scale needed to ensure we don't overflow either W or H.
  let scale = Math.min(scaleW, scaleH);
  if (scale > 1) scale = 1;

  document.documentElement.style.setProperty('--app-scale', scale);

  pages.forEach(page => {
    // Force overrides in JS to ensure clean rotation and fill
    if (isPortrait) {
      page.style.width = `${vh}px`;
      page.style.height = `${vw}px`;
      page.style.transform = `translate(-50%, -50%) rotate(90deg)`;
      page.style.top = `50%`;
      page.style.left = `50%`;
    } else {
      page.style.width = `100vw`;
      page.style.height = `100vh`;
      page.style.transform = `none`;
      page.style.top = `0`;
      page.style.left = `0`;
    }
  });
}

window.addEventListener('resize', updateLayout);
window.addEventListener('orientationchange', () => setTimeout(updateLayout, 200));
window.addEventListener('load', updateLayout);
updateLayout();

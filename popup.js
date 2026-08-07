let currentDuration = 5;
let statsRangeDays = 7;

const viewSetup = document.getElementById("view-setup");
const viewProgress = document.getElementById("view-progress");
const viewDashboard = document.getElementById("view-dashboard");

const navTimer = document.getElementById("navTimer");
const navDashboard = document.getElementById("navDashboard");

const range7Btn = document.getElementById("range7Btn");
const range30Btn = document.getElementById("range30Btn");
const rangeCaretBtn = document.getElementById("rangeCaretBtn");
const rangeDropdown = document.getElementById("rangeDropdown");
range7Btn.style.backgroundColor = "#b81d18";
range7Btn.style.color = "#ffffff";
const dashboardList = document.getElementById("dashboardList");

// Current range mode: number (days) or string (this-week, last-week, this-month, last-month)
let currentRangeMode = 7;

const timerDisplay = document.getElementById("timerDisplay");
const timerProgressFill = document.getElementById("timerProgressFill");
const progressNotice = document.getElementById("progressNotice");

const dropdownTrigger = document.getElementById("dropdownTrigger");
const dropdownMenu = document.getElementById("dropdownMenu");
const dropdownSearch = document.getElementById("dropdownSearch");
const recentContainer = document.getElementById("recent-options-container");

const startBtn = document.getElementById("startBtn");
const endBtn = document.getElementById("endBtn");
const pauseBtn = document.getElementById("pauseBtn");
const closeBtn = document.getElementById("closeBtn");

// Blocking toggle elements
const blockingToggleBtn = document.getElementById("blockingToggleBtn");
const blockingSection = document.getElementById("blockingSection");
const blockingToggleCaret = document.getElementById("blockingToggleCaret");

// Edit section toggle handler
const editToggleBtn = document.getElementById("editToggleBtn");
const editSection = document.getElementById("editSection");

if (editToggleBtn && editSection) {
  editToggleBtn.addEventListener("click", () => {
    const isOpen = editSection.style.display === "block";
    editSection.style.display = isOpen ? "none" : "block";
    // Load data when opened
    if (!isOpen) {
      loadBlockedPatterns();
      loadYouTubeChannels();
      loadBlockedKeywords();
      loadPauseSettings();
    }
  });
}

// Blocking section toggle handler
if (blockingToggleBtn && blockingSection && blockingToggleCaret) {
  blockingToggleBtn.addEventListener("click", () => {
    const isOpen = blockingSection.style.display === "block";
    blockingSection.style.display = isOpen ? "none" : "block";
    blockingToggleCaret.textContent = isOpen ? "▾" : "▴";
  });
}

// Dashboard progress elements
const progressWorked = document.getElementById("progressWorked");
const progressAvailable = document.getElementById("progressAvailable");
const progressRemaining = document.getElementById("progressRemaining");
const dashboardProgressFill = document.getElementById("dashboardProgressFill");
const marker12 = document.getElementById("marker12");
const marker14 = document.getElementById("marker14");
const marker16 = document.getElementById("marker16");

// Pause timer elements
const pauseDurationSelector = document.getElementById("pauseDurationSelector");
const pauseDurationOptions = document.querySelectorAll(
  ".pause-duration-option",
);
const customPauseMins = document.getElementById("customPauseMins");
const customPauseBtn = document.getElementById("customPauseBtn");
const pauseOptionsBtn = document.getElementById("pauseOptionsBtn");

// Pause settings elements
const maxPausesInput = document.getElementById("maxPausesInput");
const defaultPauseDurationInput = document.getElementById(
  "defaultPauseDurationInput",
);
const savePauseSettingsBtn = document.getElementById("savePauseSettingsBtn");
const pauseSettingsSavedMsg = document.getElementById("pauseSettingsSavedMsg");

// ===== ANALYTICS ELEMENT =====
const analyticsBtn = document.getElementById("analyticsBtn");

// ===== ACCOMPLISHMENTS / ACHIEVEMENTS ELEMENTS =====
const accomplishmentBtn = document.getElementById("accomplishmentBtn");
const achievementsSection = document.getElementById("achievementsSection");
const closeAchievementsBtn = document.getElementById("closeAchievementsBtn");
const achievementsList = document.getElementById("achievementsList");

// ===== DATA MANAGEMENT ELEMENTS =====
const exportDataBtn = document.getElementById("exportDataBtn");
const importDataBtn = document.getElementById("importDataBtn");
const importFileInput = document.getElementById("importFileInput");
const clearDataBtn = document.getElementById("clearDataBtn");
const dataStatusMsg = document.getElementById("dataStatusMsg");
const dataManagementSection = document.getElementById("dataManagementSection");

// Dashboard click counter for data management reveal
let dashboardClickCount = 0;
const DATA_MANAGEMENT_REVEAL_COUNT = 5;

function getLabelForMins(mins) {
  const m = parseFloat(mins);
  if (m === 0) return "0 minutes";
  if (m < 60) return `${m} minutes`;
  const hours = Math.floor(m / 60);
  const remainingMins = m % 60;
  if (remainingMins === 0) {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }
  return `${hours} hour${hours > 1 ? "s" : ""} ${remainingMins} minutes`;
}

// Navigation View Triggers
navTimer.addEventListener("click", () => {
  navTimer.classList.add("active");
  navDashboard.classList.remove("active");
  viewDashboard.classList.remove("active");
  viewSetup.classList.add("active");
  hideAchievements(); // Ensure achievements is hidden when switching to timer
  checkTimerState();
});

navDashboard.addEventListener("click", () => {
  navDashboard.classList.add("active");
  navTimer.classList.remove("active");
  viewSetup.classList.remove("active");
  viewProgress.classList.remove("active");
  viewDashboard.classList.add("active");
  startDashboardRefresh();
  renderAnalytics();

  // Increment dashboard click counter and reveal data management after 5 clicks
  dashboardClickCount++;
  if (
    dashboardClickCount >= DATA_MANAGEMENT_REVEAL_COUNT &&
    dataManagementSection
  ) {
    dataManagementSection.style.display = "block";
  }

  // Don't load streak/badge inline displays anymore - use Accomplishment button instead
});

// ===== ACCOMPLISHMENTS ACHIEVEMENTS UI =====
function showAchievements() {
  // Hide dashboard elements that should not show when achievements is open
  const progressEl = document.querySelector(".dashboard-progress");
  const rangeBtns = document.querySelector(
    "[id*='range7Btn'], [id*='range30Btn']",
  );
  const rangeCaret = document.getElementById("rangeCaretBtn");
  const dashboardListView = document.getElementById("dashboardList");
  const scheduleToggleArea = document.querySelector("[style*='Edit Schedule']");

  if (progressEl) progressEl.style.display = "none";
  if (rangeBtns) rangeBtns.style.display = "none";
  if (rangeCaret) rangeCaret.style.display = "none";
  if (dashboardListView) dashboardListView.style.display = "none";
  if (scheduleToggleArea) scheduleToggleArea.style.display = "none";

  achievementsSection.style.display = "block";
  loadAchievementsData();
}

function hideAchievements() {
  achievementsSection.style.display = "none";

  // Restore dashboard elements
  const progressEl = document.querySelector(".dashboard-progress");
  const rangeBtns = document.querySelector(
    "[id*='range7Btn'], [id*='range30Btn']",
  );
  const rangeCaret = document.getElementById("rangeCaretBtn");
  const dashboardListView = document.getElementById("dashboardList");
  const scheduleToggleArea = document.querySelector(
    "[style*='Edit Schedule'], [style*='gap: 8px; align-items: center']",
  );

  if (progressEl) progressEl.style.display = "block";
  if (rangeBtns) rangeBtns.style.display = "flex";
  if (rangeCaret) rangeCaret.style.display = "block";
  if (dashboardListView) dashboardListView.style.display = "block";
  if (scheduleToggleArea && !dashboardListView)
    scheduleToggleArea.style.display = "flex";

  // Resume dashboard refresh
  startDashboardRefresh();
}

// loadAchievementsData and renderAchievementHonors are now in achievements.js (shared file)

// Click handler for Accomplishment button
accomplishmentBtn.addEventListener("click", () => {
  showAchievements();
});

// Click handler for Close/Back button
closeAchievementsBtn.addEventListener("click", () => {
  hideAchievements();
});

// ===== END ACCOMPLISHMENTS ACHIEVEMENTS UI =====

// Analytics button click handler
if (analyticsBtn) {
  analyticsBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_ANALYTICS" });
  });
}

// Helper to reset all range buttons to default style
function resetRangeButtons() {
  const btns = [range7Btn, range30Btn];
  btns.forEach((b) => {
    b.style.backgroundColor = "#f0f0f0";
    b.style.color = "#333333";
  });
}

// Helper to get the date range for a mode
function getDateRangeForMode(mode) {
  const now = new Date();
  if (typeof mode === "number") {
    // Simple N-day lookback
    const start = new Date(now);
    start.setDate(start.getDate() - mode);
    return { start, end: now, days: mode };
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay(); // 0=Sun

  switch (mode) {
    case "this-week": {
      // Start from Sunday of this week
      const start = new Date(today);
      start.setDate(start.getDate() - dayOfWeek);
      const diffMs = today - start;
      const days = Math.round(diffMs / 86400000) + 1;
      return { start, end: today, days };
    }
    case "last-week": {
      const end = new Date(today);
      end.setDate(end.getDate() - dayOfWeek - 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      return { start, end, days: 7 };
    }
    case "this-month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const diffMs = today - start;
      const days = Math.round(diffMs / 86400000) + 1;
      return { start, end: today, days };
    }
    case "last-month": {
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      const start = new Date(end.getFullYear(), end.getMonth(), 1);
      return { start, end, days: end.getDate() };
    }
    default:
      return {
        start: new Date(today.getTime() - 7 * 86400000),
        end: today,
        days: 7,
      };
  }
}

// Get date keys for a range
function getDateKeysForRange(mode) {
  const range = getDateRangeForMode(mode);
  const keys = [];
  const current = new Date(range.start);
  while (current <= range.end) {
    keys.push(getDateKey(current));
    current.setDate(current.getDate() + 1);
  }
  return keys;
}

function setRangeMode(mode) {
  currentRangeMode = mode;
  resetRangeButtons();
  rangeDropdown.style.display = "none";

  if (typeof mode === "number") {
    statsRangeDays = mode;
    const btn = mode === 7 ? range7Btn : range30Btn;
    btn.style.backgroundColor = "#b81d18";
    btn.style.color = "#ffffff";
  } else {
    // For named ranges, use the date keys approach
    statsRangeDays = getDateRangeForMode(mode).days;
  }
  renderAnalytics();
}

range7Btn.addEventListener("click", () => setRangeMode(7));
range30Btn.addEventListener("click", () => setRangeMode(30));

// Range caret dropdown toggle
rangeCaretBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  rangeDropdown.style.display =
    rangeDropdown.style.display === "block" ? "none" : "block";
});

// Range dropdown options
document.querySelectorAll(".range-dropdown-option").forEach((opt) => {
  opt.addEventListener("click", () => {
    setRangeMode(opt.getAttribute("data-range"));
  });
});

// Close range dropdown when clicking outside
document.addEventListener("click", (e) => {
  if (
    !e.target.closest("#rangeCaretBtn") &&
    !e.target.closest("#rangeDropdown")
  ) {
    rangeDropdown.style.display = "none";
  }
  if (
    !e.target.closest("#accomplishmentBtn") &&
    !e.target.closest("#achievementsSection")
  ) {
    // Clicking outside achievements section doesn't close it (it has a Back button)
  }
});

function formatDate(date) {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

// Returns date key with 6-hour offset (matching background.js logic)
function getDateKey(date) {
  const d = new Date(date);
  d.setHours(d.getHours() - 6);
  return d.toISOString().split("T")[0];
}

// Render the progress bar on the dashboard (24h as max, with tiered goals)
function renderProgressBar() {
  const todayStr = getDateKey(new Date());

  chrome.storage.local.get(["workHistory"], (res) => {
    const history = res.workHistory || {};
    let minutesLogged = history[todayStr] || 0;

    // Add in-progress timer time
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (timerRes) => {
      if (
        timerRes &&
        (timerRes.state === "RUNNING" ||
          timerRes.state === "PAUSED" ||
          timerRes.state === "PAUSED_OVERTIME")
      ) {
        const elapsedMins =
          timerRes.totalDurationMins - Math.ceil(timerRes.remainingTime / 60);
        if (elapsedMins > 0) {
          minutesLogged += elapsedMins;
        }
      }

      const hoursLogged = minutesLogged / 60;
      const maxHours = 16;
      const progressPercent = Math.min(100, (hoursLogged / maxHours) * 100);

      // Determine which goal to show remaining for
      let goalHours = 12;
      if (hoursLogged >= 12) goalHours = 14;
      if (hoursLogged >= 14) goalHours = 16;
      if (hoursLogged >= 16) goalHours = 16;

      const remainingHours = Math.max(0, goalHours - hoursLogged);

      // Update header
      const workedH = Math.floor(hoursLogged);
      const workedM = Math.round((hoursLogged - workedH) * 60);
      const remainH = Math.floor(remainingHours);
      const remainM = Math.round((remainingHours - remainH) * 60);
      progressWorked.textContent = `Worked: ${workedH}h ${String(workedM).padStart(2, "0")}m`;

      if (hoursLogged >= 14) {
        progressRemaining.textContent = `Remaining: ${remainH}h ${String(remainM).padStart(2, "0")}m to 16h`;
      } else if (hoursLogged >= 12) {
        progressRemaining.textContent = `Remaining: ${remainH}h ${String(remainM).padStart(2, "0")}m to 14h`;
      } else {
        progressRemaining.textContent = `Remaining: ${remainH}h ${String(remainM).padStart(2, "0")}m to 12h`;
      }

      // Update bar
      dashboardProgressFill.style.width = `${progressPercent}%`;

      // Update bar color
      dashboardProgressFill.classList.remove("partial", "good", "excellent");
      if (hoursLogged < 12) {
        dashboardProgressFill.classList.add("partial");
      } else if (hoursLogged < 14) {
        dashboardProgressFill.classList.add("good");
      } else {
        dashboardProgressFill.classList.add("excellent");
      }

      // Always show markers at fixed positions based on 16h
      marker12.style.display = "inline";
      marker12.style.left = `${(12 / 16) * 100}%`;
      marker14.style.display = "inline";
      marker14.style.left = `${(14 / 16) * 100}%`;
      marker16.style.display = "inline";
      marker16.style.left = "99%";
    });
  });
}

// Calculate average hours for a given range
function calculateAverageHours(history, inProgressMins, rangeMode) {
  let totalMinutes = 0;
  let daysWithData = 0;
  let daysCount = rangeMode;

  const dateKeys = getDateKeysForRange(rangeMode);
  daysCount = dateKeys.length;

  for (let i = 0; i < dateKeys.length; i++) {
    const dateString = dateKeys[i];
    let minutesLogged = history[dateString] || 0;

    // Add in-progress timer time to "Today" row
    if (i === dateKeys.length - 1) {
      minutesLogged += inProgressMins;
    }

    totalMinutes += minutesLogged;
    if (minutesLogged > 0) {
      daysWithData++;
    }
  }

  const totalHours = totalMinutes / 60;
  const averageHours = totalHours / daysCount;

  return {
    totalHours,
    averageHours,
    daysWithData,
    daysCount,
  };
}

function renderAnalytics() {
  chrome.storage.local.get(["workHistory"], (res) => {
    const history = res.workHistory || {};
    dashboardList.innerHTML = "";
    let totalMinutesCalculated = 0;

    // Also render the progress bar
    renderProgressBar();

    // Get in-progress timer time for "Today" row
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (timerRes) => {
      let inProgressMins = 0;
      if (
        timerRes &&
        (timerRes.state === "RUNNING" ||
          timerRes.state === "PAUSED" ||
          timerRes.state === "PAUSED_OVERTIME")
      ) {
        inProgressMins =
          timerRes.totalDurationMins - Math.ceil(timerRes.remainingTime / 60);
        if (inProgressMins < 0) inProgressMins = 0;
      }

      // Calculate date keys for the current range mode
      const dateKeys = getDateKeysForRange(currentRangeMode);

      // Calculate averages
      const avgData = calculateAverageHours(
        history,
        inProgressMins,
        currentRangeMode,
      );

      // Reverse the dateKeys so Today is at top, then Yesterday, then older days
      const reversedKeys = [...dateKeys].reverse();

      for (let i = 0; i < reversedKeys.length; i++) {
        const dateString = reversedKeys[i];
        let minutesLogged = history[dateString] || 0;
        // Add in-progress timer time to "Today" row
        if (i === 0) {
          minutesLogged += inProgressMins;
        }
        totalMinutesCalculated += minutesLogged;

        const metricRow = document.createElement("div");
        metricRow.style.display = "flex";
        metricRow.style.justifyContent = "space-between";
        metricRow.style.padding = "7px 4px";
        metricRow.style.borderBottom = "1px solid #f2f2f7";
        metricRow.style.fontSize = "13px";

        const dateLabel = document.createElement("span");
        const labelDate = new Date(dateString + "T06:00:00");
        let displayText;
        if (i === 0) {
          displayText = "Today";
        } else if (i === 1) {
          displayText = "Yesterday";
        } else {
          displayText = formatDate(labelDate);
        }
        dateLabel.textContent = displayText;
        dateLabel.style.color = "#555";

        // Goal thresholds: <12hrs = red (but not for 1-day streaks), 12-14hrs = light green, >=14hrs = dark green
        const hoursLogged = minutesLogged / 60;
        let goalColor;
        if (minutesLogged === 0) {
          goalColor = "#8e8e93";
        } else if (hoursLogged < 1) {
          // Less than 1 hour - neutral/blue for just starting
          goalColor = "#5c6bc0";
        } else if (hoursLogged < 12) {
          goalColor = "#e74c3c"; // red
        } else if (hoursLogged < 14) {
          goalColor = "#2ecc71"; // light green
        } else {
          goalColor = "#1a7a5a"; // dark green
        }

        const allocationValue = document.createElement("span");
        allocationValue.style.fontWeight = "600";
        allocationValue.style.color = goalColor;
        if (minutesLogged === 0) {
          allocationValue.textContent = "00:00";
        } else {
          const h = Math.floor(minutesLogged / 60);
          const m = minutesLogged % 60;
          allocationValue.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        }

        metricRow.appendChild(dateLabel);
        metricRow.appendChild(allocationValue);
        dashboardList.appendChild(metricRow);
      }

      // Add average row at the end with color coding
      const avgSummaryRow = document.createElement("div");
      avgSummaryRow.style.display = "flex";
      avgSummaryRow.style.justifyContent = "space-between";
      avgSummaryRow.style.padding = "10px 4px";
      avgSummaryRow.style.borderTop = "2px solid #f2f2f7";
      avgSummaryRow.style.fontSize = "13px";
      avgSummaryRow.style.backgroundColor = "#f9f9f9";
      avgSummaryRow.style.fontWeight = "600";

      const avgLabel = document.createElement("span");
      const avgHours = avgData.averageHours.toFixed(1);

      // Color based on total hours vs 12 hour target
      if (avgData.totalHours >= 12) {
        avgLabel.style.color = "#2ecc71"; // green
      } else {
        avgLabel.style.color = "#e74c3c"; // red
      }

      avgLabel.textContent = `Average: ${avgHours} hours`;

      avgSummaryRow.appendChild(avgLabel);
      dashboardList.appendChild(avgSummaryRow);
    });
  });
}

dropdownTrigger.addEventListener("click", (e) => {
  e.stopPropagation();
  dropdownMenu.classList.toggle("open");
});

document.addEventListener("click", () => dropdownMenu.classList.remove("open"));

dropdownSearch.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  dropdownMenu.querySelectorAll(".dropdown-option").forEach((opt) => {
    opt.style.display = opt.textContent.toLowerCase().includes(query)
      ? "block"
      : "none";
  });
});

function checkTimerState() {
  if (navDashboard.classList.contains("active")) return;
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
    if (!response) return;

    if (
      response.state === "RUNNING" ||
      response.state === "PAUSED" ||
      response.state === "PAUSED_OVERTIME" ||
      response.state === "OVERTIME"
    ) {
      viewSetup.classList.remove("active");
      viewProgress.classList.add("active");

      if (response.state === "PAUSED" || response.state === "PAUSED_OVERTIME") {
        pauseBtn.style.display = "inline-block";
        pauseBtn.textContent = "Resume";
        progressNotice.textContent = "Session is paused.";
        progressNotice.className = "notice-box notice-progress";
        updateDisplayEngine(response.remainingTime, response.totalDurationMins);
      } else if (response.state === "OVERTIME") {
        pauseBtn.style.display = "none";
        updateOvertimeUI(response.overtimeSeconds);
      } else {
        pauseBtn.style.display = "inline-block";
        pauseBtn.textContent = "Pause";
        progressNotice.textContent =
          "A pomodoro session is currently in progress.";
        progressNotice.className = "notice-box notice-progress";
        updateDisplayEngine(response.remainingTime, response.totalDurationMins);
      }
      updatePauseOptionsBtn();
    } else {
      viewProgress.classList.remove("active");
      viewSetup.classList.add("active");
      loadRecentOptions();
      pauseOptionsBtn.style.display = "none";
    }
  });
}

function loadRecentOptions() {
  chrome.storage.local.get(["recentDurations"], (res) => {
    const list = res.recentDurations || [];
    recentContainer.innerHTML = "";
    if (list.length === 0) {
      recentContainer.innerHTML = `<div class="dropdown-option" style="color:#8e8e93; font-size:12px; cursor:default;">No recent selections</div>`;
      syncDropdownListeners();
      return;
    }
    list.forEach((mins) => {
      const opt = document.createElement("div");
      opt.className = "dropdown-option";
      opt.setAttribute("data-value", mins);
      opt.textContent = getLabelForMins(mins);
      recentContainer.appendChild(opt);
    });
    syncDropdownListeners();
  });
}

function syncDropdownListeners() {
  dropdownMenu.querySelectorAll(".dropdown-option").forEach((opt) => {
    if (opt.getAttribute("data-value")) {
      opt.onclick = () => {
        const val = parseFloat(opt.getAttribute("data-value"));
        selectDuration(val);
      };
    }
  });
}

function selectDuration(mins) {
  currentDuration = mins;
  dropdownTrigger.textContent = getLabelForMins(mins);
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    if (parseFloat(btn.getAttribute("data-mins")) === mins) {
      btn.classList.add("selected");
    } else {
      btn.classList.remove("selected");
    }
  });
}

document.querySelectorAll(".preset-btn").forEach((btn) => {
  btn.addEventListener("click", () =>
    selectDuration(parseFloat(btn.getAttribute("data-mins"))),
  );
});

function updateDisplayEngine(seconds, totalMins) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (num) => String(num).padStart(2, "0");
  timerDisplay.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;

  const totalSeconds = totalMins * 60;
  const percentageLeft = totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0;
  timerProgressFill.style.width = `${percentageLeft}%`;
}

function updateOvertimeUI(totalSecs) {
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const pad = (n) => String(n).padStart(2, "0");

  timerDisplay.textContent = `+${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  progressNotice.textContent =
    "Break period overshot! Time to get back to work.";
  progressNotice.className = "notice-box notice-progress";
  timerProgressFill.style.width = "100%";
}

startBtn.addEventListener("click", () => {
  chrome.storage.local.get(["recentDurations"], (res) => {
    let list = res.recentDurations || [];
    list = list.filter((x) => x !== currentDuration);
    list.unshift(currentDuration);
    if (list.length > 3) list.pop();
    chrome.storage.local.set({ recentDurations: list }, () => {
      chrome.runtime.sendMessage(
        { type: "START", minutes: currentDuration },
        checkTimerState,
      );
    });
  });
});

// Show/hide the options button based on state
function updatePauseOptionsBtn() {
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
    if (!response) return;
    if (
      response.state === "RUNNING" ||
      response.state === "PAUSED" ||
      response.state === "PAUSED_OVERTIME"
    ) {
      pauseOptionsBtn.style.display = "block";
    } else {
      pauseOptionsBtn.style.display = "none";
    }
  });
}

// Options button click - shows the duration selector
pauseOptionsBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  pauseDurationSelector.style.display =
    pauseDurationSelector.style.display === "block" ? "none" : "block";
});

// Pause duration option buttons (5m, 10m, 15m, 30m, 1h)
pauseDurationOptions.forEach((btn) => {
  btn.addEventListener("click", () => {
    const mins = parseInt(btn.getAttribute("data-mins"));
    pauseDurationSelector.style.display = "none";
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
      if (!response) return;
      if (response.state === "RUNNING") {
        chrome.runtime.sendMessage(
          { type: "PAUSE_WITH_DURATION", durationMinutes: mins },
          (res) => {
            if (res && res.success) {
              checkTimerState();
            } else if (res && res.reason === "Max pauses reached") {
              showMaxPauseReachedUI(
                response.pauseCount,
                response.maxPauses,
                mins,
              );
            }
          },
        );
      }
    });
  });
});

// Custom pause button
customPauseBtn.addEventListener("click", () => {
  const mins = parseInt(customPauseMins.value);
  if (!mins || mins < 1) return;
  pauseDurationSelector.style.display = "none";
  customPauseMins.value = "";
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
    if (!response) return;
    if (response.state === "RUNNING") {
      chrome.runtime.sendMessage(
        { type: "PAUSE_WITH_DURATION", durationMinutes: mins },
        (res) => {
          if (res && res.success) {
            checkTimerState();
          } else if (res && res.reason === "Max pauses reached") {
            showMaxPauseReachedUI(
              response.pauseCount,
              response.maxPauses,
              mins,
            );
          }
        },
      );
    }
  });
});

// Pause button - just pauses/resumes, no popup
pauseBtn.addEventListener("click", () => {
  pauseDurationSelector.style.display = "none";
  hideMaxPauseReachedUI();
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
    if (!response) return;
    if (response.state === "PAUSED" || response.state === "PAUSED_OVERTIME") {
      chrome.runtime.sendMessage({ type: "TOGGLE_PAUSE" }, checkTimerState);
    } else if (response.state === "RUNNING") {
      chrome.runtime.sendMessage({ type: "TOGGLE_PAUSE" }, (res) => {
        if (res && res.success) {
          checkTimerState();
        } else if (res && res.reason === "Max pauses reached") {
          showMaxPauseReachedUI(response.pauseCount, response.maxPauses, null);
        }
      });
    }
  });
});

// End Session button
endBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "END" }, (res) => {
    if (res && res.success) {
      pauseDurationSelector.style.display = "none";
      checkTimerState();
    }
  });
});

closeBtn.addEventListener("click", () => window.close());

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "STATE_CHANGED") {
    checkTimerState();
  }
});

// ===== DATA MANAGEMENT =====

function showDataStatus(message, isError = false) {
  if (!dataStatusMsg) return;
  dataStatusMsg.textContent = message;
  dataStatusMsg.style.display = "block";
  dataStatusMsg.style.backgroundColor = isError ? "#fee" : "#efe";
  dataStatusMsg.style.border = isError
    ? "1px solid #e74c3c"
    : "1px solid #2ecc71";
  dataStatusMsg.style.borderRadius = "4px";
  dataStatusMsg.style.padding = "8px";
  dataStatusMsg.style.marginTop = "8px";
  dataStatusMsg.style.fontSize = "12px";

  setTimeout(() => {
    dataStatusMsg.style.display = "none";
  }, 5000);
}

// Export data
exportDataBtn
  ? exportDataBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "EXPORT_DATA" }, (res) => {
        if (!res || !res.success) {
          showDataStatus("Failed to export data", true);
          return;
        }
        const dataStr = JSON.stringify(res.data, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const today = new Date();
        const filename = `pomodoro-data-${today.toISOString().split("T")[0]}.json`;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        showDataStatus("Data exported successfully!");
      });
    })
  : console.warn("exportDataBtn not found");

// Import data
importDataBtn
  ? importDataBtn.addEventListener("click", () => {
      if (importFileInput) {
        importFileInput.click();
      }
    })
  : console.warn("importDataBtn not found");

// Handle file input change for import
importFileInput
  ? importFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!file.name.endsWith(".json")) {
        showDataStatus("Please select a JSON file", true);
        importFileInput.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          chrome.runtime.sendMessage({ type: "IMPORT_DATA", data }, (res) => {
            if (res && res.success) {
              showDataStatus(`Imported ${res.count} data keys successfully!`);
              // Reload the popup to reflect changes
              setTimeout(() => window.close(), 1500);
            } else {
              showDataStatus(res?.reason || "Import failed", true);
            }
          });
        } catch (err) {
          showDataStatus("Invalid JSON file", true);
        }
      };
      reader.readAsText(file);
      importFileInput.value = "";
    })
  : console.warn("importFileInput not found");

// Clear all data
clearDataBtn
  ? clearDataBtn.addEventListener("click", () => {
      if (
        !confirm(
          "This will permanently delete ALL your data (work history, schedule, settings, badges, etc.). Are you sure?",
        )
      )
        return;

      chrome.runtime.sendMessage({ type: "CLEAR_DATA" }, (res) => {
        if (res && res.success) {
          showDataStatus("All data cleared! Reloading...", true);
          // Reload the popup to reflect changes
          setTimeout(() => window.close(), 1500);
        } else {
          showDataStatus("Failed to clear data", true);
        }
      });
    })
  : console.warn("clearDataBtn not found");

// ===== END DATA MANAGEMENT =====

// ===== BLOCKING UI =====

const blockedPatternInput = document.getElementById("blockedPatternInput");
const addBlockedPatternBtn = document.getElementById("addBlockedPatternBtn");
const blockedPatternsList = document.getElementById("blockedPatternsList");

const youtubeChannelInput = document.getElementById("youtubeChannelInput");
const youtubeChannelMaxMins = document.getElementById("youtubeChannelMaxMins");
const addYouTubeChannelBtn = document.getElementById("addYouTubeChannelBtn");
const youtubeChannelsList = document.getElementById("youtubeChannelsList");

// Load and render blocked patterns
function loadBlockedPatterns() {
  chrome.runtime.sendMessage({ type: "GET_BLOCKED_PATTERNS" }, (res) => {
    const patterns = (res && res.patterns) || [];
    renderBlockedPatterns(patterns);
  });
}

function renderBlockedPatterns(patterns) {
  blockedPatternsList.innerHTML = "";
  if (patterns.length === 0) {
    blockedPatternsList.innerHTML =
      '<div style="color:#999;font-size:12px;padding:8px 0;">No blocked sites added.</div>';
    return;
  }
  patterns.forEach((item) => {
    const pattern = typeof item === "string" ? item : item.pattern;
    const deleteClicks = typeof item === "string" ? 0 : item.deleteClicks || 0;

    const el = document.createElement("div");
    el.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border:1px solid #e5e5ea;border-radius:4px;margin-bottom:6px;background:#fafafa;";

    const label = document.createElement("span");
    label.textContent = pattern;
    label.style.fontSize = "13px";
    label.style.fontWeight = "500";

    const rightSection = document.createElement("div");
    rightSection.style.cssText = "display:flex;align-items:center;gap:8px;";

    const counter = document.createElement("span");
    counter.textContent = `${deleteClicks}/200`;
    counter.style.fontSize = "11px";
    counter.style.color = deleteClicks >= 200 ? "#2ecc71" : "#999";

    const actionBtn = document.createElement("button");
    if (deleteClicks >= 200) {
      actionBtn.textContent = "× Remove";
      actionBtn.style.cssText =
        "background:#b81d18;color:white;border:none;border-radius:4px;padding:4px 8px;font-size:12px;cursor:pointer;";
      actionBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage(
          { type: "REMOVE_BLOCKED_PATTERN", pattern },
          (res) => {
            if (res.success) loadBlockedPatterns();
          },
        );
      });
    } else {
      actionBtn.textContent = "🛡️";
      actionBtn.style.cssText =
        "background:none;border:1px solid #ddd;border-radius:4px;padding:4px 8px;font-size:14px;cursor:pointer;transition:all 0.1s;";
      actionBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage(
          { type: "INCREMENT_DELETE_CLICK", pattern },
          (res) => {
            if (res.success) loadBlockedPatterns();
          },
        );
      });
    }

    rightSection.appendChild(counter);
    rightSection.appendChild(actionBtn);
    el.appendChild(label);
    el.appendChild(rightSection);
    blockedPatternsList.appendChild(el);
  });
}

addBlockedPatternBtn.addEventListener("click", () => {
  const pattern = blockedPatternInput.value.trim().toLowerCase();
  if (!pattern) return;
  chrome.runtime.sendMessage({ type: "ADD_BLOCKED_PATTERN", pattern }, () => {
    blockedPatternInput.value = "";
    loadBlockedPatterns();
  });
});

blockedPatternInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addBlockedPatternBtn.click();
});

// Load and render YouTube channels
function loadYouTubeChannels() {
  chrome.runtime.sendMessage({ type: "GET_YOUTUBE_CHANNELS" }, (res) => {
    const channels = (res && res.channels) || {};
    renderYouTubeChannels(channels);
  });
}

function renderYouTubeChannels(channels) {
  youtubeChannelsList.innerHTML = "";
  const entries = Object.entries(channels);
  if (entries.length === 0) {
    youtubeChannelsList.innerHTML =
      '<div style="color:#999;font-size:12px;padding:8px 0;">No YouTube channels blocked.</div>';
    return;
  }
  entries.forEach(([key, data]) => {
    const deleteClicks = data.deleteClicks || 0;

    const item = document.createElement("div");
    item.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border:1px solid #e5e5ea;border-radius:4px;margin-bottom:6px;background:#fafafa;";

    const info = document.createElement("div");
    info.style.cssText = "display:flex;flex-direction:column;gap:2px;";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = key;
    nameSpan.style.fontSize = "13px";
    nameSpan.style.fontWeight = "500";

    const detailSpan = document.createElement("span");
    if (data.maxMinutes) {
      const used = Math.round((data.usedMinutes || 0) * 10) / 10;
      let text = `Max: ${data.maxMinutes} min/day (Used: ${used} min)`;
      if (data.bonusUsed) {
        text += " | Bonus: Used";
      }
      detailSpan.textContent = text;
      detailSpan.style.color = used >= data.maxMinutes ? "#e74c3c" : "#666";
    } else {
      detailSpan.textContent = "Permanently blocked";
      detailSpan.style.color = "#b81d18";
    }
    detailSpan.style.fontSize = "11px";

    info.appendChild(nameSpan);
    info.appendChild(detailSpan);

    const rightSection = document.createElement("div");
    rightSection.style.cssText = "display:flex;align-items:center;gap:8px;";

    const counter = document.createElement("span");
    counter.textContent = `${deleteClicks}/200`;
    counter.style.fontSize = "11px";
    counter.style.color = deleteClicks >= 200 ? "#2ecc71" : "#999";

    const actionBtn = document.createElement("button");
    if (deleteClicks >= 200) {
      actionBtn.textContent = "× Remove";
      actionBtn.style.cssText =
        "background:#b81d18;color:white;border:none;border-radius:4px;padding:4px 8px;font-size:12px;cursor:pointer;";
      actionBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage(
          { type: "REMOVE_YOUTUBE_CHANNEL", channelKey: key },
          (res) => {
            if (res.success) loadYouTubeChannels();
          },
        );
      });
    } else {
      actionBtn.textContent = "🛡️";
      actionBtn.style.cssText =
        "background:none;border:1px solid #ddd;border-radius:4px;padding:4px 8px;font-size:14px;cursor:pointer;transition:all 0.1s;";
      actionBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage(
          { type: "INCREMENT_YOUTUBE_DELETE_CLICK", channelKey: key },
          (res) => {
            if (res.success) loadYouTubeChannels();
          },
        );
      });
    }

    rightSection.appendChild(counter);
    rightSection.appendChild(actionBtn);
    item.appendChild(info);
    item.appendChild(rightSection);
    youtubeChannelsList.appendChild(item);
  });
}

addYouTubeChannelBtn.addEventListener("click", () => {
  const channelKey = youtubeChannelInput.value.trim();
  if (!channelKey) return;
  const maxMinutes = youtubeChannelMaxMins.value
    ? parseInt(youtubeChannelMaxMins.value)
    : null;
  chrome.runtime.sendMessage(
    { type: "ADD_YOUTUBE_CHANNEL", channelKey, maxMinutes },
    () => {
      youtubeChannelInput.value = "";
      youtubeChannelMaxMins.value = "";
      loadYouTubeChannels();
    },
  );
});

youtubeChannelInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addYouTubeChannelBtn.click();
});

// ===== KEYWORD BLOCKING UI =====

const blockedKeywordInput = document.getElementById("blockedKeywordInput");
const addBlockedKeywordBtn = document.getElementById("addBlockedKeywordBtn");
const blockedKeywordsList = document.getElementById("blockedKeywordsList");

function loadBlockedKeywords() {
  chrome.runtime.sendMessage({ type: "GET_BLOCKED_KEYWORDS" }, (res) => {
    const keywords = (res && res.keywords) || [];
    renderBlockedKeywords(keywords);
  });
}

function renderBlockedKeywords(keywords) {
  blockedKeywordsList.innerHTML = "";
  if (keywords.length === 0) {
    blockedKeywordsList.innerHTML =
      '<div style="color:#999;font-size:12px;padding:8px 0;">No blocked keywords added.</div>';
    return;
  }
  keywords.forEach((item) => {
    const kw = typeof item === "string" ? item : item.keyword;
    const deleteClicks = typeof item === "string" ? 0 : item.deleteClicks || 0;

    const el = document.createElement("div");
    el.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border:1px solid #e5e5ea;border-radius:4px;margin-bottom:6px;background:#fafafa;";

    const label = document.createElement("span");
    label.textContent = `"${kw}"`;
    label.style.fontSize = "13px";
    label.style.fontWeight = "500";

    const rightSection = document.createElement("div");
    rightSection.style.cssText = "display:flex;align-items:center;gap:8px;";

    const counter = document.createElement("span");
    counter.textContent = `${deleteClicks}/200`;
    counter.style.fontSize = "11px";
    counter.style.color = deleteClicks >= 200 ? "#2ecc71" : "#999";

    const actionBtn = document.createElement("button");
    if (deleteClicks >= 200) {
      actionBtn.textContent = "× Remove";
      actionBtn.style.cssText =
        "background:#b81d18;color:white;border:none;border-radius:4px;padding:4px 8px;font-size:12px;cursor:pointer;";
      actionBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage(
          { type: "REMOVE_BLOCKED_KEYWORD", keyword: kw },
          (res) => {
            if (res.success) loadBlockedKeywords();
          },
        );
      });
    } else {
      actionBtn.textContent = "🛡️";
      actionBtn.style.cssText =
        "background:none;border:1px solid #ddd;border-radius:4px;padding:4px 8px;font-size:14px;cursor:pointer;transition:all 0.1s;";
      actionBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage(
          { type: "INCREMENT_KEYWORD_DELETE_CLICK", keyword: kw },
          () => {
            loadBlockedKeywords();
          },
        );
      });
    }

    rightSection.appendChild(counter);
    rightSection.appendChild(actionBtn);
    el.appendChild(label);
    el.appendChild(rightSection);
    blockedKeywordsList.appendChild(el);
  });
}

addBlockedKeywordBtn.addEventListener("click", () => {
  const keyword = blockedKeywordInput.value.trim();
  if (!keyword) return;
  chrome.runtime.sendMessage({ type: "ADD_BLOCKED_KEYWORD", keyword }, () => {
    blockedKeywordInput.value = "";
    loadBlockedKeywords();
  });
});

blockedKeywordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addBlockedKeywordBtn.click();
});

// ===== PAUSE SETTINGS =====

function loadPauseSettings() {
  chrome.runtime.sendMessage({ type: "GET_PAUSE_SETTINGS" }, (res) => {
    if (res && res.settings) {
      maxPausesInput.value = res.settings.maxPauses || 3;
      defaultPauseDurationInput.value = res.settings.defaultPauseDuration || 10;
    }
  });
}

savePauseSettingsBtn.addEventListener("click", () => {
  const maxPauses = parseInt(maxPausesInput.value) || 3;
  const defaultPauseDuration = parseInt(defaultPauseDurationInput.value) || 10;
  chrome.runtime.sendMessage(
    {
      type: "SAVE_PAUSE_SETTINGS",
      settings: { maxPauses, defaultPauseDuration },
    },
    (res) => {
      if (res && res.success) {
        pauseSettingsSavedMsg.style.display = "block";
        setTimeout(() => {
          pauseSettingsSavedMsg.style.display = "none";
        }, 2000);
      }
    },
  );
});

// ===== EXTERNAL TIMER EXTENSION ID =====
const externalTimerIdInput = document.getElementById("externalTimerId");
const saveExternalTimerIdBtn = document.getElementById(
  "saveExternalTimerIdBtn",
);
const externalTimerSavedMsg = document.getElementById("externalTimerSavedMsg");

// Load saved external timer ID
function loadExternalTimerId() {
  chrome.storage.sync.get(["externalTimerId"], (res) => {
    if (res && res.externalTimerId) {
      externalTimerIdInput.value = res.externalTimerId;
    }
  });
}

// Save external timer ID
if (saveExternalTimerIdBtn) {
  saveExternalTimerIdBtn.addEventListener("click", () => {
    const id = externalTimerIdInput.value.trim();
    chrome.storage.sync.set({ externalTimerId: id }, () => {
      if (externalTimerSavedMsg) {
        externalTimerSavedMsg.style.display = "block";
        setTimeout(() => {
          externalTimerSavedMsg.style.display = "none";
        }, 2000);
      }
    });
  });
}

// Load the saved ID when popup opens
if (externalTimerIdInput) {
  loadExternalTimerId();
}

// ===== RESUME TIMER COUNTDOWN DISPLAY =====
// Update the pause button text to show the resume timer countdown

function updatePauseButtonWithResumeTimer() {
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
    if (!response) return;
    if (response.state === "PAUSED" && response.resumeTimerRemaining > 0) {
      const secs = response.resumeTimerRemaining;
      const mins = Math.floor(secs / 60);
      const secsLeft = secs % 60;
      pauseBtn.textContent = `Resume in ${mins}:${String(secsLeft).padStart(2, "0")}`;
    } else if (
      response.state === "PAUSED_OVERTIME" &&
      response.resumeTimerOvertime > 0
    ) {
      const secs = response.resumeTimerOvertime;
      const mins = Math.floor(secs / 60);
      const secsOver = secs % 60;
      pauseBtn.textContent = `+${mins}:${String(secsOver).padStart(2, "0")} late`;
    } else if (response.state === "PAUSED") {
      pauseBtn.textContent = "Resume";
    }
  });
}

// Run the resume timer update every second alongside the main timer
setInterval(() => {
  updatePauseButtonWithResumeTimer();
}, 1000);

// ===== RESUME TIMER COUNTDOWN DISPLAY ===== END

// Live dashboard progress refresh (every second)
let dashboardInterval = null;

function startDashboardRefresh() {
  if (dashboardInterval) clearInterval(dashboardInterval);
  // immediate first render
  renderProgressBar();
  dashboardInterval = setInterval(() => {
    if (navDashboard.classList.contains("active")) {
      renderProgressBar();
    }
  }, 1000);
}

function stopDashboardRefresh() {
  if (dashboardInterval) {
    clearInterval(dashboardInterval);
    dashboardInterval = null;
  }
}

// ===== MAX PAUSE REACHED INLINE UI =====

const maxPauseReachedUI = document.getElementById("maxPauseReachedUI");
const maxPauseReachedCount = document.getElementById("maxPauseReachedCount");
const maxPauseReachedLimit = document.getElementById("maxPauseReachedLimit");
const maxPauseAddInput = document.getElementById("maxPauseAddInput");
const maxPauseAddBtn = document.getElementById("maxPauseAddBtn");
const maxPauseCancelBtn = document.getElementById("maxPauseCancelBtn");

// Track what pause action was being attempted (default or custom duration)
let pendingPauseMins = null;

function showMaxPauseReachedUI(pauseCount, maxPauses, customMins) {
  pendingPauseMins = customMins;
  if (maxPauseReachedCount) maxPauseReachedCount.textContent = pauseCount || 0;
  if (maxPauseReachedLimit) maxPauseReachedLimit.textContent = maxPauses || 0;
  if (maxPauseAddInput) maxPauseAddInput.value = 1;
  if (maxPauseReachedUI) maxPauseReachedUI.style.display = "block";
}

function hideMaxPauseReachedUI() {
  pendingPauseMins = null;
  if (maxPauseReachedUI) maxPauseReachedUI.style.display = "none";
}

// "Add & Pause" button: increase the maxPauses setting and retry the pause
if (maxPauseAddBtn) {
  maxPauseAddBtn.addEventListener("click", () => {
    const extraPauses = parseInt(maxPauseAddInput.value) || 1;
    if (extraPauses < 1) return;

    // Get current settings and increase maxPauses
    chrome.runtime.sendMessage({ type: "GET_PAUSE_SETTINGS" }, (res) => {
      if (!res || !res.settings) return;
      const currentMax = res.settings.maxPauses || 0;
      const newMax = currentMax + extraPauses;

      chrome.runtime.sendMessage(
        {
          type: "SAVE_PAUSE_SETTINGS",
          settings: { ...res.settings, maxPauses: newMax },
        },
        (saveRes) => {
          if (saveRes && saveRes.success) {
            // Hide the UI
            hideMaxPauseReachedUI();
            // Retry pause with default or the pending custom duration
            if (pendingPauseMins !== null) {
              chrome.runtime.sendMessage(
                {
                  type: "PAUSE_WITH_DURATION",
                  durationMinutes: pendingPauseMins,
                },
                (pauseRes) => {
                  if (pauseRes && pauseRes.success) {
                    checkTimerState();
                  }
                },
              );
            } else {
              chrome.runtime.sendMessage(
                { type: "TOGGLE_PAUSE" },
                (pauseRes) => {
                  if (pauseRes && pauseRes.success) {
                    checkTimerState();
                  }
                },
              );
            }
          }
        },
      );
    });
  });
}

// Cancel button
if (maxPauseCancelBtn) {
  maxPauseCancelBtn.addEventListener("click", () => {
    hideMaxPauseReachedUI();
  });
}

// ===== END MAX PAUSE REACHED INLINE UI =====

checkTimerState();

setInterval(() => {
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
    if (!response) return;
    if (response.state === "RUNNING") {
      updateDisplayEngine(response.remainingTime, response.totalDurationMins);
    } else if (response.state === "OVERTIME") {
      updateOvertimeUI(response.overtimeSeconds || 0);
    }
  });
}, 1000);

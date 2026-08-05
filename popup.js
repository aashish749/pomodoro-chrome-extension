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

// Schedule elements
const scheduleDayTabs = document.getElementById("scheduleDayTabs");
const scheduleActivities = document.getElementById("scheduleActivities");
const addActivityBtn = document.getElementById("addActivityBtn");
const scheduleSaveBtn = document.getElementById("scheduleSaveBtn");
const scheduleSavedMsg = document.getElementById("scheduleSavedMsg");
const scheduleToggleBtn = document.getElementById("scheduleToggleBtn");
const dashboardSchedule = document.getElementById("dashboardSchedule");

// Dashboard progress elements
const progressWorked = document.getElementById("progressWorked");
const progressAvailable = document.getElementById("progressAvailable");
const progressRemaining = document.getElementById("progressRemaining");
const dashboardProgressFill = document.getElementById("dashboardProgressFill");
const marker12 = document.getElementById("marker12");
const marker14 = document.getElementById("marker14");

// Streak elements (used in schedule section and achievements)
const streakBadge = document.getElementById("streakBadge");
const streakBadgeCount = document.getElementById("streakBadgeCount");
const streakDetails = document.getElementById("streakDetails");
const streakRecoverSection = document.getElementById("streakRecoverSection");
const useStreakSaverBtn = document.getElementById("useStreakSaverBtn");
const dismissStreakSaverBtn = document.getElementById("dismissStreakSaverBtn");

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

// ===== ACCOMPLISHMENTS / ACHIEVEMENTS ELEMENTS =====
const accomplishmentBtn = document.getElementById("accomplishmentBtn");
const achievementsSection = document.getElementById("achievementsSection");
const closeAchievementsBtn = document.getElementById("closeAchievementsBtn");
const achievementsList = document.getElementById("achievementsList");

// Badge elements (kept for backward compatibility with schedule section)
const badgeDisplay = document.getElementById("badgeDisplay");
const badgeCount = document.getElementById("badgeCount");

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const EVERY_DAY_KEY = "EveryDay";

let currentScheduleDay = 0; // 0 = Sunday, 7 = EveryDay
let scheduleData = {};

function getLabelForMins(mins) {
  const m = parseFloat(mins);
  if (m === 60) return "1 hour";
  if (m === 120) return "2 hours";
  if (m === 180) return "3 hours";
  if (m === 240) return "4 hours";
  if (m === 360) return "6 hours";
  return `${mins} minutes`;
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

function loadAchievementsData() {
  // Fetch fresh streak data
  chrome.runtime.sendMessage({ type: "GET_STREAK_DATA" }, (streakRes) => {
    if (!streakRes) return;

    const { streakData, canRecover } = streakRes;

    // Fetch fresh badge data
    chrome.runtime.sendMessage({ type: "GET_BADGE_DATA" }, (badgeRes) => {
      if (!badgeRes) return;

      const { badgeData } = badgeRes;

      renderAchievementHonors(streakData, canRecover, badgeData);
    });
  });
}

function renderAchievementHonors(streakData, canRecover, badgeData) {
  const {
    currentStreak = 0,
    longestStreak = 0,
    streakSavers = 0,
    progressToNextSaver = 0,
  } = streakData;

  const {
    monthly = 0,
    lifetime = 0,
    day1_30day_completed = false,
    day1_30day_14hr_completed = false,
    thousand_hours_completed = false,
    elon_musk_weekly_completed = false,
    bronze_16hr_count = 0,
    six_hour_flow_count = 0,
    silver_3x16_count = 0,
    progress = {},
  } = badgeData || {};

  // Calculate total earned badges
  let totalEarnedBadges = 0;
  if (day1_30day_completed) totalEarnedBadges++;
  if (day1_30day_14hr_completed) totalEarnedBadges++;
  if (thousand_hours_completed) totalEarnedBadges++;
  if (elon_musk_weekly_completed) totalEarnedBadges++;
  totalEarnedBadges += bronze_16hr_count;
  totalEarnedBadges += six_hour_flow_count;
  totalEarnedBadges += silver_3x16_count;

  const p = progress || {};
  const day1 = p.threeZeroChallenge || {};
  const day14 = p.threeZeroChallenge14 || {};
  const thousand = p.thousandHours || {};
  const weekly = p.elonMusk || {};

  let html = "";

  // ===== STREAK HONOR CARD =====
  html += '<div class="honor-card honor-streak-container">';
  html +=
    '<img src="' +
    chrome.runtime.getURL("streak (1).png") +
    '" alt="Streak" class="honor-icon" />';
  html += '<div class="honor-content">';
  html += '<h4 class="honor-title">Streak</h4>';
  html += '<div class="honor-details">';
  html +=
    '<p style="margin: 4px 0;">Current: <span class="highlight">' +
    currentStreak +
    "</span> days</p>";
  html +=
    '<p style="margin: 4px 0;">Longest: <span class="highlight">' +
    longestStreak +
    "</span> days</p>";
  html +=
    '<p style="margin: 4px 0;">Streak Savers: <span class="highlight">' +
    streakSavers +
    "</span></p>";
  html +=
    '<p style="margin: 4px 0; font-size: 11px; color: #888;">Progress to next saver: <span class="highlight">' +
    progressToNextSaver +
    "</span>/14</p>";
  html += "</div></div></div>";

  // ===== BADGE HONOR CARD (Shows total earned achievement badges) =====
  html += '<div class="honor-card honor-badge-container">';
  html +=
    '<img src="' +
    chrome.runtime.getURL("Badges(1).png") +
    '" alt="Badge" class="honor-icon" />';
  html += '<div class="honor-content">';
  html += '<h4 class="honor-title">Badges</h4>';
  html += '<div class="honor-details">';
  html +=
    '<p style="margin: 4px 0;">Total Earned: <span class="highlight">' +
    totalEarnedBadges +
    "</span></p>";
  html +=
    '<p style="margin: 4px 0;">Lifetime: <span class="highlight">' +
    lifetime +
    "</span></p>";
  html +=
    '<p style="margin: 4px 0;">This Month: <span class="highlight">' +
    monthly +
    "</span></p>";
  html += "</div></div></div>";

  // ===== DAY 1 - 30 DAYS OF 10+ HOURS WITH PROGRESS =====
  const day1Completed = day1_30day_completed;
  const day1Current = day1.current || 0;
  const day1Target = day1.target || 30;
  const day1Percent = Math.min(100, (day1Current / day1Target) * 100);

  html +=
    '<div class="honor-card ' + (day1Completed ? "" : "honor-locked") + '">';
  html +=
    '<img src="' +
    chrome.runtime.getURL("badges/10hours_at_leastfor30days.png") +
    '" alt="Day 1 - 30 Days 10+ Hours" class="honor-icon ' +
    (day1Completed ? "" : "locked") +
    '" />';
  html += '<div class="honor-content">';
  html +=
    '<h4 class="honor-title ' +
    (day1Completed ? "" : "locked-title") +
    '">Day 1 Execution</h4>';
  html += '<div class="honor-details">';

  if (day1Completed) {
    html +=
      '<p style="margin: 4px 0; font-size: 12px; color: #666;">' +
      "10+ hours daily for 30 consecutive days" +
      "</p>";
  } else {
    html +=
      '<p style="margin: 4px 0; font-size: 12px; color: #999;"><span class="locked-label">🔒 ' +
      Math.round(day1Percent) +
      "% LOCKED</span><br>10+ hours daily for 30 consecutive days</p>";
  }
  html +=
    '<div class="progress-bar"><div class="progress-fill" style="width: ' +
    day1Percent +
    '%"></div></div>';
  html += "</div></div></div>";

  // ===== 14 HOURS DAILY FOR A MONTH WITH PROGRESS =====
  const day14Completed = day1_30day_14hr_completed;
  const day14Current = day14.current || 0;
  const day14Target = day14.target || 30;
  const day14Percent = Math.min(100, (day14Current / day14Target) * 100);

  html +=
    '<div class="honor-card ' + (day14Completed ? "" : "honor-locked") + '">';
  html +=
    '<img src="' +
    chrome.runtime.getURL("badges/14hoursdailyforamonth.png") +
    '" alt="14 Hours Daily for a Month" class="honor-icon ' +
    (day14Completed ? "" : "locked") +
    '" />';
  html += '<div class="honor-content">';
  html +=
    '<h4 class="honor-title ' +
    (day14Completed ? "" : "locked-title") +
    '">14 Hours Daily for a Month</h4>';
  html += '<div class="honor-details">';

  if (day14Completed) {
    html +=
      '<p style="margin: 4px 0; font-size: 12px; color: #666;">' +
      "14+ hours daily for 30 consecutive days" +
      "</p>";
  } else {
    html +=
      '<p style="margin: 4px 0; font-size: 12px; color: #999;"><span class="locked-label">🔒 ' +
      Math.round(day14Percent) +
      "% LOCKED</span><br>14+ hours daily for 30 consecutive days</p>";
  }
  html +=
    '<div class="progress-bar"><div class="progress-fill" style="width: ' +
    day14Percent +
    '%"></div></div>';
  html += "</div></div></div>";

  // ===== 1,000-HOUR CLUB WITH PROGRESS =====
  const thousandCompleted = thousand_hours_completed;
  const thousandCurrent = Math.floor(thousand.current || 0);
  const thousandTarget = thousand.target || 1000;
  const thousandPercent = Math.min(
    100,
    (thousandCurrent / thousandTarget) * 100,
  );

  html +=
    '<div class="honor-card ' +
    (thousandCompleted ? "" : "honor-locked") +
    '">';
  html +=
    '<img src="' +
    chrome.runtime.getURL("badges/godlmedal_for_1000hours.png") +
    '" alt="1,000-Hour Club" class="honor-icon ' +
    (thousandCompleted ? "" : "locked") +
    '" />';
  html += '<div class="honor-content">';
  html +=
    '<h4 class="honor-title ' +
    (thousandCompleted ? "" : "locked-title") +
    '">1,000-Hour Club</h4>';
  html += '<div class="honor-details">';

  if (thousandCompleted) {
    html +=
      '<p style="margin: 4px 0; font-size: 12px; color: #666;">' +
      "Crossed 1,000 total hours of logged focus time" +
      "</p>";
  } else {
    html +=
      '<p style="margin: 4px 0; font-size: 12px; color: #999;"><span class="locked-label">🔒 ' +
      Math.round(thousandPercent) +
      "% LOCKED</span><br>" +
      Math.round(thousandCurrent) +
      " / " +
      thousandTarget +
      " hours</p>";
  }
  html +=
    '<div class="progress-bar"><div class="progress-fill" style="width: ' +
    thousandPercent +
    '%"></div></div>';
  html += "</div></div></div>";

  // ===== ELON MUSK 100+ HOURS/WEEK WITH PROGRESS =====
  const elonCompleted = elon_musk_weekly_completed;
  const elonCurrent = Math.floor(weekly.current || 0);
  const elonTarget = weekly.target || 100;
  const elonPercent = Math.min(100, (elonCurrent / elonTarget) * 100);

  html +=
    '<div class="honor-card ' + (elonCompleted ? "" : "honor-locked") + '">';
  html +=
    '<img src="' +
    chrome.runtime.getURL("badges/musk_badge_for_100hours_plus_perweek.png") +
    '" alt="100+ Hours per Week" class="honor-icon ' +
    (elonCompleted ? "" : "locked") +
    '" />';
  html += '<div class="honor-content">';
  html +=
    '<h4 class="honor-title ' +
    (elonCompleted ? "" : "locked-title") +
    '">100+ Hours per Week</h4>';
  html += '<div class="honor-details">';

  if (elonCompleted) {
    html +=
      '<p style="margin: 4px 0; font-size: 12px; color: #666;">' +
      "100+ hours in a single 7-day period" +
      "</p>";
  } else {
    html +=
      '<p style="margin: 4px 0; font-size: 12px; color: #999;"><span class="locked-label">🔒 ' +
      Math.round(elonPercent) +
      "% LOCKED</span><br>" +
      elonCurrent +
      " / " +
      elonTarget +
      " hours this week</p>";
  }
  html +=
    '<div class="progress-bar"><div class="progress-fill" style="width: ' +
    elonPercent +
    '%"></div></div>';
  html += "</div></div></div>";

  // ===== BRONZE - 16 HOUR SINGLE DAY SHIFT =====
  const bronzeCompleted = bronze_16hr_count > 0;
  const sixHourImg = chrome.runtime
    .getURL("badges/complete 6 hours without single pause.png")
    .replace(/ /g, "%20");

  html +=
    '<div class="honor-card ' + (bronzeCompleted ? "" : "honor-locked") + '">';
  html +=
    '<img src="' +
    chrome.runtime.getURL(
      "badges/bronze_medal_for_16hours_singledayshift.png",
    ) +
    '" alt="Bronze - 16 Hour Single Day Shift" class="honor-icon ' +
    (bronzeCompleted ? "" : "locked") +
    '" />';
  html += '<div class="honor-content">';
  html +=
    '<h4 class="honor-title ' +
    (bronzeCompleted ? "" : "locked-title") +
    '">Bronze - 16 Hour Shift</h4>';
  html += '<div class="honor-details">';

  if (bronzeCompleted) {
    html +=
      '<p style="margin: 4px 0;">Completed: <span class="highlight">×' +
      bronze_16hr_count +
      "</span></p>";
  } else {
    html +=
      '<p style="margin: 4px 0;"><span class="locked-label">🔒 LOCKED</span></p>';
  }
  html +=
    '<p style="margin: 4px 0; font-size: 12px; color: ' +
    (bronzeCompleted ? "#666" : "#999") +
    ';">16-hour focus shift in a single day</p>';
  html += "</div></div></div>";

  // ===== DEEP FLOW - 6 HOURS WITHOUT PAUSE =====
  const flowCompleted = six_hour_flow_count > 0;

  html +=
    '<div class="honor-card ' + (flowCompleted ? "" : "honor-locked") + '">';
  html +=
    '<img src="' +
    sixHourImg +
    '" alt="6 Hours Without Pause" class="honor-icon ' +
    (flowCompleted ? "" : "locked") +
    '" />';
  html += '<div class="honor-content">';
  html +=
    '<h4 class="honor-title ' +
    (flowCompleted ? "" : "locked-title") +
    '">Deep Flow</h4>';
  html += '<div class="honor-details">';

  if (flowCompleted) {
    html +=
      '<p style="margin: 4px 0;">Completed: <span class="highlight">×' +
      six_hour_flow_count +
      "</span></p>";
  } else {
    html +=
      '<p style="margin: 4px 0;"><span class="locked-label">🔒 LOCKED</span></p>';
  }
  html +=
    '<p style="margin: 4px 0; font-size: 12px; color: ' +
    (flowCompleted ? "#666" : "#999") +
    ';">6 consecutive hours with zero interruptions</p>';
  html += "</div></div></div>";

  // ===== WARTIME EXECUTION - 3 CONSECUTIVE 16-HOUR DAYS =====
  const wartimeCompleted = silver_3x16_count > 0;

  html +=
    '<div class="honor-card ' + (wartimeCompleted ? "" : "honor-locked") + '">';
  html +=
    '<img src="' +
    chrome.runtime.getURL("badges/silverfor_3consecutive_16hours_days.png") +
    '" alt="3 Consecutive 16-Hour Days" class="honor-icon ' +
    (wartimeCompleted ? "" : "locked") +
    '" />';
  html += '<div class="honor-content">';
  html +=
    '<h4 class="honor-title ' +
    (wartimeCompleted ? "" : "locked-title") +
    '">Wartime Execution</h4>';
  html += '<div class="honor-details">';

  if (wartimeCompleted) {
    html +=
      '<p style="margin: 4px 0;">Completed: <span class="highlight">×' +
      silver_3x16_count +
      "</span></p>";
  } else {
    html +=
      '<p style="margin: 4px 0;"><span class="locked-label">🔒 LOCKED</span></p>';
  }
  html +=
    '<p style="margin: 4px 0; font-size: 12px; color: ' +
    (wartimeCompleted ? "#666" : "#999") +
    ';">16-hour sessions for 3 consecutive days</p>';
  html += "</div></div></div>";

  achievementsList.innerHTML = html;

  // Clean up any achievement-related badges that might still be showing
  if (streakBadge) streakBadge.style.display = "none";
  if (badgeDisplay) badgeDisplay.style.display = "none";
}

// Click handler for Accomplishment button
accomplishmentBtn.addEventListener("click", () => {
  showAchievements();
});

// Click handler for Close/Back button
closeAchievementsBtn.addEventListener("click", () => {
  hideAchievements();
});

// ===== END ACCOMPLISHMENTS ACHIEVEMENTS UI =====

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

// Get the day index for the current date (with 6-hour offset)
function getCurrentDayIndex() {
  const d = new Date();
  d.setHours(d.getHours() - 6);
  return d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
}

// Calculate available work hours for a given day
// Combines EveryDay activities (if any) with day-specific activities
function calculateAvailableWorkHours(daySchedule, everyDaySchedule) {
  let totalNonWorkMinutes = 0;

  // Add EveryDay activities first
  if (everyDaySchedule && everyDaySchedule.length > 0) {
    for (const activity of everyDaySchedule) {
      const duration = parseFloat(activity.duration) || 0;
      totalNonWorkMinutes += duration;
    }
  }

  // Add day-specific activities
  if (daySchedule && daySchedule.length > 0) {
    for (const activity of daySchedule) {
      const duration = parseFloat(activity.duration) || 0;
      totalNonWorkMinutes += duration;
    }
  }

  const totalNonWorkHours = totalNonWorkMinutes / 60;
  return Math.max(0, 24 - totalNonWorkHours);
}

// Render the progress bar on the dashboard (includes real-time in-progress timer)
function renderProgressBar() {
  const dayIndex = getCurrentDayIndex();
  const dayName = DAYS[dayIndex];

  chrome.storage.local.get(["workHistory", "daySchedule"], (res) => {
    const schedule = res.daySchedule || {};
    const daySchedule =
      schedule[dayName] || schedule[dayName.toLowerCase()] || [];
    const everyDaySchedule = schedule[EVERY_DAY_KEY] || [];

    const availableHours = calculateAvailableWorkHours(
      daySchedule,
      everyDaySchedule,
    );
    const todayStr = getDateKey(new Date());
    const history = res.workHistory || {};
    let minutesLogged = history[todayStr] || 0;

    // Add in-progress timer time (100% — no penalty while timer is still running)
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (timerRes) => {
      if (
        timerRes &&
        (timerRes.state === "RUNNING" || timerRes.state === "PAUSED")
      ) {
        const elapsedMins =
          timerRes.totalDurationMins - Math.ceil(timerRes.remainingTime / 60);
        if (elapsedMins > 0) {
          minutesLogged += elapsedMins;
        }
      }

      const hoursLogged = minutesLogged / 60;
      const remainingHours = Math.max(0, availableHours - hoursLogged);
      const progressPercent = Math.min(
        100,
        (hoursLogged / availableHours) * 100,
      );

      // Update header — show hours and minutes format
      const workedH = Math.floor(hoursLogged);
      const workedM = Math.round((hoursLogged - workedH) * 60);
      const remainH = Math.floor(remainingHours);
      const remainM = Math.round((remainingHours - remainH) * 60);
      progressWorked.textContent = `Worked: ${workedH}h ${String(workedM).padStart(2, "0")}m`;
      progressRemaining.textContent = `Remaining: ${remainH}h ${String(remainM).padStart(2, "0")}m`;

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

      // Update markers
      const marker12Percent = Math.min(100, (12 / availableHours) * 100);
      const marker14Percent = Math.min(100, (14 / availableHours) * 100);
      marker12.style.left = `${marker12Percent}%`;
      marker14.style.left = `${marker14Percent}%`;
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
        (timerRes.state === "RUNNING" || timerRes.state === "PAUSED")
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

// ===== STREAK UI =====

function loadStreakData() {
  chrome.runtime.sendMessage({ type: "GET_STREAK_DATA" }, (res) => {
    if (!res) return;
    const { streakData, todayMinutes, canRecover } = res;

    // Update streak details inside schedule section
    renderStreakDetails(streakData, canRecover);
  });
}

function renderStreakDetails(streakData, canRecover) {
  const {
    currentStreak = 0,
    longestStreak = 0,
    streakSavers = 0,
    progressToNextSaver = 0,
  } = streakData;

  let html = "";
  html += `<div>🔥 Current Streak: <strong>${currentStreak}</strong> days</div>`;
  html += `<div>🏆 Longest Streak: <strong>${longestStreak}</strong> days</div>`;
  html += `<div>🛡️ Streak Savers: <strong>${streakSavers}</strong> (earn 1 per 14-day streak)</div>`;
  html += `<div>📊 Progress to next saver: <strong>${progressToNextSaver}</strong>/14 days</div>`;

  streakDetails.innerHTML = html;

  // Show recover section if applicable
  if (canRecover) {
    streakRecoverSection.style.display = "block";
  } else {
    streakRecoverSection.style.display = "none";
  }
}

useStreakSaverBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "RECOVER_STREAK" }, (res) => {
    if (res && res.success) {
      // Update the UI
      loadStreakData();
      streakRecoverSection.style.display = "none";
      // Show a brief success message
      const successMsg = document.createElement("div");
      successMsg.style.cssText =
        "font-size: 12px; color: #2ecc71; margin-top: 8px; font-weight: 600;";
      successMsg.textContent = "✅ Streak recovered!";
      streakDetails.appendChild(successMsg);
      setTimeout(() => successMsg.remove(), 3000);
    } else {
      alert(res?.reason || "Failed to recover streak.");
    }
  });
});

dismissStreakSaverBtn.addEventListener("click", () => {
  streakRecoverSection.style.display = "none";
});

// ===== BADGE UI =====
// (Badge display is no longer shown inline on dashboard - replaced with Accomplishment button)
// But we keep loadBadgeData for potential other uses
function loadBadgeData() {
  chrome.runtime.sendMessage({ type: "GET_BADGE_DATA" }, (res) => {
    if (!res || !res.badgeData) {
      badgeDisplay.style.display = "none";
      return;
    }
    const { monthly, lifetime } = res.badgeData;
    const total = lifetime || 0;
    if (total > 0) {
      badgeDisplay.style.display = "block";
      badgeCount.textContent = total;
    } else {
      badgeDisplay.style.display = "none";
    }
  });
}
// ===== END BADGE UI =====

// Schedule functions
function loadSchedule() {
  chrome.storage.local.get(["daySchedule"], (res) => {
    scheduleData = res.daySchedule || {};
    renderScheduleDayTabs();
    renderScheduleActivities();
  });
}

function renderScheduleDayTabs() {
  scheduleDayTabs.innerHTML = "";
  DAYS.forEach((day, index) => {
    const tab = document.createElement("button");
    tab.className = "schedule-day-tab";
    if (index === currentScheduleDay) {
      tab.classList.add("active");
    }
    tab.textContent = day;
    tab.addEventListener("click", () => {
      currentScheduleDay = index;
      renderScheduleDayTabs();
      renderScheduleActivities();
    });
    scheduleDayTabs.appendChild(tab);
  });

  // Add "Every Day" tab
  const everyDayTab = document.createElement("button");
  everyDayTab.className = "schedule-day-tab";
  if (currentScheduleDay === 7) {
    everyDayTab.classList.add("active");
  }
  everyDayTab.textContent = "All Days";
  everyDayTab.style.color = "#b81d18";
  everyDayTab.style.fontWeight = "600";
  everyDayTab.addEventListener("click", () => {
    currentScheduleDay = 7;
    renderScheduleDayTabs();
    renderScheduleActivities();
  });
  scheduleDayTabs.appendChild(everyDayTab);
}

function getEffectiveScheduleKey(dayName) {
  // For individual days, if there's no day-specific list, fall back to EveryDay
  if (currentScheduleDay >= 0 && currentScheduleDay < 7) {
    return dayName;
  }
  return EVERY_DAY_KEY;
}

function renderScheduleActivities() {
  const isEveryDay = currentScheduleDay === 7;
  const dayName = isEveryDay ? EVERY_DAY_KEY : DAYS[currentScheduleDay];
  const activities = scheduleData[dayName] || [];

  scheduleActivities.innerHTML = "";

  // Show a hint for EveryDay mode
  if (isEveryDay) {
    const hint = document.createElement("div");
    hint.style.cssText =
      "font-size:11px;color:#666;background:#fff8f8;border:1px solid #f5c6cb;border-radius:4px;padding:8px 10px;margin-bottom:10px;";
    hint.textContent =
      "Activities here apply to EVERY day of the week. Add things like sleep, meals, gym, etc.";
    scheduleActivities.appendChild(hint);
  }

  if (activities.length === 0) {
    scheduleActivities.innerHTML +=
      '<div style="text-align:center;color:#999;padding:20px;font-size:13px;">No activities added for this day. Click below to add one.</div>';
    return;
  }

  activities.forEach((activity, index) => {
    const item = document.createElement("div");
    item.className = "activity-item";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Activity name";
    nameInput.value = activity.name || "";
    nameInput.style.flex = "1";
    nameInput.addEventListener("input", (e) => {
      scheduleData[dayName][index].name = e.target.value;
    });

    // Convert stored minutes to hours:minutes display
    const totalMins = activity.duration || 0;
    const displayHours = Math.floor(totalMins / 60);
    const displayMins = totalMins % 60;

    const durationWrapper = document.createElement("div");
    durationWrapper.style.display = "flex";
    durationWrapper.style.alignItems = "center";
    durationWrapper.style.gap = "4px";
    durationWrapper.style.flex = "0 0 auto";

    const hoursInput = document.createElement("input");
    hoursInput.type = "number";
    hoursInput.placeholder = "Hrs";
    hoursInput.value = displayHours || "";
    hoursInput.min = "0";
    hoursInput.style.width = "44px";
    hoursInput.style.padding = "6px 4px";
    hoursInput.style.border = "1px solid #ddd";
    hoursInput.style.borderRadius = "4px";
    hoursInput.style.fontSize = "13px";
    hoursInput.addEventListener("input", () => {
      const h = parseInt(hoursInput.value) || 0;
      const m = parseInt(minsInput.value) || 0;
      scheduleData[dayName][index].duration = h * 60 + m;
    });

    const sep = document.createElement("span");
    sep.textContent = ":";
    sep.style.fontSize = "13px";
    sep.style.color = "#555";

    const minsInput = document.createElement("input");
    minsInput.type = "number";
    minsInput.placeholder = "Min";
    minsInput.value = displayMins || "";
    minsInput.min = "0";
    minsInput.max = "59";
    minsInput.style.width = "44px";
    minsInput.style.padding = "6px 4px";
    minsInput.style.border = "1px solid #ddd";
    minsInput.style.borderRadius = "4px";
    minsInput.style.fontSize = "13px";
    minsInput.addEventListener("input", () => {
      const h = parseInt(hoursInput.value) || 0;
      const m = parseInt(minsInput.value) || 0;
      scheduleData[dayName][index].duration = h * 60 + m;
    });

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => {
      scheduleData[dayName].splice(index, 1);
      renderScheduleActivities();
    });

    durationWrapper.appendChild(hoursInput);
    durationWrapper.appendChild(sep);
    durationWrapper.appendChild(minsInput);

    item.appendChild(nameInput);
    item.appendChild(durationWrapper);
    item.appendChild(removeBtn);
    scheduleActivities.appendChild(item);
  });
}

addActivityBtn.addEventListener("click", () => {
  const isEveryDay = currentScheduleDay === 7;
  const dayName = isEveryDay ? EVERY_DAY_KEY : DAYS[currentScheduleDay];
  if (!scheduleData[dayName]) {
    scheduleData[dayName] = [];
  }
  scheduleData[dayName].push({ name: "", duration: 0 });
  renderScheduleActivities();
});

scheduleToggleBtn.addEventListener("click", () => {
  // Close achievements if open
  if (achievementsSection.style.display === "block") {
    hideAchievements();
  }

  if (dashboardSchedule.style.display === "none") {
    dashboardSchedule.style.display = "block";
    scheduleToggleBtn.textContent = "Close Schedule";
    loadSchedule();
    // Load streak data when schedule is opened
    loadStreakData();
    // Load blocking data when schedule is opened
    loadBlockedPatterns();
    loadYouTubeChannels();
    loadBlockedKeywords();
    // Load pause settings
    loadPauseSettings();
  } else {
    dashboardSchedule.style.display = "none";
    scheduleToggleBtn.textContent = "Edit Schedule";
  }
});

scheduleSaveBtn.addEventListener("click", () => {
  // Save with EveryDay activities expanded to all days
  const finalSchedule = JSON.parse(JSON.stringify(scheduleData));

  // If EveryDay has activities, merge them into each day
  const everyDayActivities = finalSchedule[EVERY_DAY_KEY] || [];
  if (everyDayActivities.length > 0) {
    for (const day of DAYS) {
      const dayActivities = finalSchedule[day] || [];
      // Merge: EveryDay activities first, then day-specific ones
      const merged = [...everyDayActivities, ...dayActivities];
      finalSchedule[day] = merged;
    }
  }

  // Keep the EveryDay key for editing purposes
  chrome.storage.local.set({ daySchedule: finalSchedule }, () => {
    scheduleSavedMsg.style.display = "block";
    setTimeout(() => {
      scheduleSavedMsg.style.display = "none";
    }, 2000);
  });
});

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

// Pause button - just pauses/resumes, no popup
pauseBtn.addEventListener("click", () => {
  pauseDurationSelector.style.display = "none";
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
    if (!response) return;
    if (response.state === "PAUSED" || response.state === "PAUSED_OVERTIME") {
      chrome.runtime.sendMessage({ type: "TOGGLE_PAUSE" }, checkTimerState);
    } else if (response.state === "RUNNING") {
      chrome.runtime.sendMessage({ type: "TOGGLE_PAUSE" }, (res) => {
        if (res && res.success) {
          checkTimerState();
        } else if (res && res.reason === "Max pauses reached") {
          alert(
            "Max pauses reached for this session. Increase the limit in Edit Schedule > Pause Settings.",
          );
        }
      });
    }
  });
});

closeBtn.addEventListener("click", () => window.close());

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "STATE_CHANGED") {
    checkTimerState();
  }
});

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
    const patterns = res.patterns || [];
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
    const channels = res.channels || {};
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
    const keywords = res.keywords || [];
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

// Analytics button
const analyticsBtn = document.getElementById("analyticsBtn");
if (analyticsBtn) {
  analyticsBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_ANALYTICS" });
  });
}

// Run the resume timer update every second alongside the main timer
setInterval(() => {
  updatePauseButtonWithResumeTimer();
}, 1000);

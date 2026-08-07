// State management variables
let timerInterval = null;
let remainingTime = 0;
let totalDurationMins = 0;
let currentState = "IDLE"; // IDLE, RUNNING, PAUSED, OVERTIME, PAUSED_OVERTIME
let isBreakSession = false;
let overtimeSeconds = 0; // Tracks extra time spent past break allocation

// Timestamp-based tracking variables
let endTime = 0;
let pauseTimeLeft = 0;

// Pause timer variables
let pauseCount = 0; // Number of pauses in current session
let pauseDurationSecs = 0; // How long the user set for the pause timer
let resumeTimerEndTime = 0; // When the resume timer expires
let resumeOvertimeSeconds = 0; // How long past the resume timer they've gone

// Initialize badge formatting
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: "#b81d18" });
  updateBlockingRules();
  initializePauseSettings();
});

function initializePauseSettings() {
  chrome.storage.local.get(["pauseSettings"], (res) => {
    if (!res.pauseSettings) {
      chrome.storage.local.set({
        pauseSettings: {
          maxPauses: 3,
          defaultPauseDuration: 10, // minutes
        },
      });
    }
  });
}

// Returns date key with 6-hour offset (so sessions up to 6AM count toward previous day)
function getDateKey(date) {
  const d = new Date(date);
  d.setHours(d.getHours() - 6);
  return d.toISOString().split("T")[0];
}

// Simple YYYY-MM-DD from a Date object (no offset, for walking backwards through history keys)
function formatDateKey(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Splits session minutes across hours of the day.
// startTime and endTime are timestamps in ms.
// Returns an object mapping hour (0-23) -> total minutes attributed.
function splitSessionAcrossHours(startTime, endTime) {
  const totalMs = endTime - startTime;
  if (totalMs <= 0) return {};

  const totalMinutes = Math.round(totalMs / 60000);
  const result = {};

  // Walk minute by minute, attributing each minute to its hour bucket
  for (let i = 0; i < totalMinutes; i++) {
    const minuteTimestamp = startTime + i * 60000;
    const d = new Date(minuteTimestamp);
    const hour = d.getHours();
    result[hour] = (result[hour] || 0) + 1;
  }

  return result;
}

// Save hourly data alongside daily work history
function saveHourlyData(startTime, endTime) {
  const hourSplits = splitSessionAcrossHours(startTime, endTime);
  if (Object.keys(hourSplits).length === 0) return;

  chrome.storage.local.get(["hourlyHistory"], (res) => {
    const hourlyHistory = res.hourlyHistory || {};

    for (const [hourStr, minutes] of Object.entries(hourSplits)) {
      const dateKey = getDateKey(new Date(startTime));
      if (!hourlyHistory[dateKey]) {
        hourlyHistory[dateKey] = {};
      }
      hourlyHistory[dateKey][hourStr] =
        (hourlyHistory[dateKey][hourStr] || 0) + minutes;
    }

    chrome.storage.local.set({ hourlyHistory });
  });
}

// Splits session minutes across days based on the 6AM boundary.
// startTime and endTime are timestamps in ms.
// Returns an object mapping dateKey -> minutes to attribute.
function splitSessionAcrossDays(startTime, endTime) {
  const totalMs = endTime - startTime;
  if (totalMs <= 0) return {};

  const totalMinutes = Math.round(totalMs / 60000);
  const result = {};

  // Walk minute by minute from start to end, attributing each minute
  // to the correct date key based on the 6-hour offset.
  for (let i = 0; i < totalMinutes; i++) {
    const minuteTimestamp = startTime + i * 60000;
    const key = getDateKey(new Date(minuteTimestamp));
    result[key] = (result[key] || 0) + 1;
  }

  return result;
}

// Helper to save current state to local storage
function saveStateToStorage() {
  chrome.storage.local.set({
    timerPersistentState: {
      remainingTime,
      totalDurationMins,
      currentState,
      isBreakSession,
      endTime,
      pauseTimeLeft,
      overtimeSeconds,
      pauseCount,
      pauseDurationSecs,
      resumeTimerEndTime,
      resumeOvertimeSeconds,
    },
  });
}

// Restore state immediately upon Service Worker boot up
chrome.storage.local.get(["timerPersistentState"], (res) => {
  if (res.timerPersistentState) {
    const state = res.timerPersistentState;
    remainingTime = state.remainingTime;
    totalDurationMins = state.totalDurationMins;
    currentState = state.currentState;
    isBreakSession = state.isBreakSession;
    endTime = state.endTime;
    pauseTimeLeft = state.pauseTimeLeft;
    overtimeSeconds = state.overtimeSeconds || 0;
    pauseCount = state.pauseCount || 0;
    pauseDurationSecs = state.pauseDurationSecs || 0;
    resumeTimerEndTime = state.resumeTimerEndTime || 0;
    resumeOvertimeSeconds = state.resumeOvertimeSeconds || 0;

    if (currentState === "RUNNING") {
      const now = Date.now();
      if (now >= endTime) {
        remainingTime = 0;
        handleSessionCompletion();
      } else {
        startTimerEngine();
      }
    } else if (currentState === "PAUSED") {
      chrome.action.setBadgeBackgroundColor({ color: "#8e8e93" });
      updateBadgeText(Math.round(pauseTimeLeft / 1000));
      // Start the resume timer engine if we have a pause duration set
      if (pauseDurationSecs > 0) {
        startResumeTimerEngine();
      }
    } else if (currentState === "PAUSED_OVERTIME") {
      chrome.action.setBadgeBackgroundColor({ color: "#8e8e93" });
      startResumeTimerEngine();
    } else if (currentState === "OVERTIME") {
      startOvertimeEngine();
    }
  }
});

// Helper to format badge text (handles both countdowns and counting up)
function updateBadgeText(seconds, isOvertime = false) {
  if (seconds <= 0 && !isOvertime) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }

  const totalMins = isOvertime
    ? Math.floor(seconds / 60)
    : Math.ceil(seconds / 60);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const paddedMins = String(mins).padStart(2, "0");

  if (isOvertime) {
    chrome.action.setBadgeText({ text: `+${mins}` });
  } else {
    chrome.action.setBadgeText({ text: `${hrs}:${paddedMins}` });
  }
}

function clearIntervalEngine() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function startTimerEngine() {
  clearIntervalEngine();
  currentState = "RUNNING";

  const badgeColor = isBreakSession ? "#1d70b8" : "#b81d18";
  chrome.action.setBadgeBackgroundColor({ color: badgeColor });

  timerInterval = setInterval(() => {
    if (currentState !== "RUNNING") return;

    const now = Date.now();
    if (now < endTime) {
      remainingTime = Math.round((endTime - now) / 1000);
      updateBadgeText(remainingTime);

      if (remainingTime % 5 === 0) saveStateToStorage();
    } else {
      remainingTime = 0;
      handleSessionCompletion();
    }
  }, 1000);

  saveStateToStorage();
}

function startOvertimeEngine() {
  clearIntervalEngine();
  currentState = "OVERTIME";

  chrome.action.setBadgeBackgroundColor({ color: "#e67e22" });

  timerInterval = setInterval(() => {
    if (currentState !== "OVERTIME") return;
    overtimeSeconds++;
    updateBadgeText(overtimeSeconds, true);

    if (overtimeSeconds % 5 === 0) saveStateToStorage();
  }, 1000);

  saveStateToStorage();
}

// ===== RESUME TIMER ENGINE =====
// Counts down from pauseDurationSecs, then counts up in resumeOvertime

// Tracks whether the "about to end" alert has been played for this pause
let resumeAlertPlayed = false;

function startResumeTimerEngine() {
  clearIntervalEngine();
  resumeAlertPlayed = false;

  if (currentState === "PAUSED" || currentState === "PAUSED_OVERTIME") {
    // Show the main timer remaining time on badge with grey background
    chrome.action.setBadgeBackgroundColor({ color: "#8e8e93" });
    updateBadgeText(Math.round(pauseTimeLeft / 1000));

    timerInterval = setInterval(() => {
      if (currentState !== "PAUSED" && currentState !== "PAUSED_OVERTIME")
        return;

      const now = Date.now();
      const remaining = Math.round((resumeTimerEndTime - now) / 1000);

      if (currentState === "PAUSED") {
        if (remaining > 0) {
          // Normal pause - grey background with main timer time
          chrome.action.setBadgeBackgroundColor({ color: "#8e8e93" });
          const mainTimeLeft = Math.round(pauseTimeLeft / 1000);
          updateBadgeText(mainTimeLeft);
          if (remaining % 5 === 0) saveStateToStorage();
          // Alert ONCE when the resume timer is about to end (within 10 seconds)
          if (remaining <= 10 && !resumeAlertPlayed) {
            resumeAlertPlayed = true;
            playSound("timeisabout_to_up.mp3", false).catch(() => {});
          }
        } else {
          // Resume timer expired! Switch to PAUSED_OVERTIME
          currentState = "PAUSED_OVERTIME";
          resumeOvertimeSeconds = 0;
          // Change badge to yellow to alert user
          chrome.action.setBadgeBackgroundColor({ color: "#e67e22" });
          // Apply deduction (once per day)
          applyPauseDeduction();
          saveStateToStorage();
          notifyStateChange();
        }
      } else if (currentState === "PAUSED_OVERTIME") {
        // Overtime pause - yellow background to alert user
        chrome.action.setBadgeBackgroundColor({ color: "#e67e22" });
        const mainTimeLeft = Math.round(pauseTimeLeft / 1000);
        updateBadgeText(mainTimeLeft);
        resumeOvertimeSeconds = Math.round((now - resumeTimerEndTime) / 1000);
        if (resumeOvertimeSeconds % 5 === 0) saveStateToStorage();
      }
    }, 1000);
  }
}

function applyPauseDeduction() {
  const todayKey = getDateKey(new Date());
  chrome.storage.local.get(["workHistory", "pauseDeductionDays"], (res) => {
    const deductionDays = res.pauseDeductionDays || {};
    // Can only deduct once per day
    if (deductionDays[todayKey]) return;

    let deductionMinutes = 0;
    if (totalDurationMins >= 180) {
      deductionMinutes = 60; // 1 hour for sessions >= 3 hours
    } else if (totalDurationMins >= 60) {
      deductionMinutes = 30; // 30 minutes for sessions >= 1 hour
    }

    if (deductionMinutes > 0) {
      const history = res.workHistory || {};
      history[todayKey] = Math.max(
        0,
        (history[todayKey] || 0) - deductionMinutes,
      );
      deductionDays[todayKey] = true;
      chrome.storage.local.set(
        { workHistory: history, pauseDeductionDays: deductionDays },
        () => {
          updateStreakData();
        },
      );
    }
  });
}

function handleSessionCompletion() {
  clearIntervalEngine();

  // Capture pause count BEFORE resetting - needed for flow badge check
  const sessionPauses = pauseCount;

  // Reset pause-related state
  pauseCount = 0;
  pauseDurationSecs = 0;
  resumeTimerEndTime = 0;
  resumeOvertimeSeconds = 0;

  chrome.tabs.create({ url: chrome.runtime.getURL("success.html") });

  if (isBreakSession) {
    overtimeSeconds = 0;
    startOvertimeEngine();
  } else {
    const sessionMinutes = totalDurationMins;
    // Track pauses for flow achievement

    currentState = "IDLE";
    chrome.action.setBadgeText({ text: "✔" });
    chrome.action.setBadgeBackgroundColor({ color: "#b81d18" });

    const startTime = endTime - totalDurationMins * 60 * 1000;
    const daySplits = splitSessionAcrossDays(startTime, endTime);
    chrome.storage.local.get(["workHistory"], (res) => {
      const history = res.workHistory || {};
      for (const [dateKey, minutes] of Object.entries(daySplits)) {
        history[dateKey] = (history[dateKey] || 0) + minutes;
      }
      chrome.storage.local.set({ workHistory: history }, () => {
        saveStateToStorage();
        updateStreakData();
      });
    });

    // Save hourly breakdown
    saveHourlyData(startTime, endTime);

    // Check and award badge if today's total >= 16 hours
    checkAndAwardBadge(sessionMinutes, sessionPauses);
    // Update best week/month data
    updateBestWeekMonth();
  }

  notifyStateChange();
}

// ===== STREAK SYSTEM =====

const STREAK_THRESHOLD_MINUTES = 720; // 12 hours
const STREAK_SAVER_INTERVAL = 14; // 14 days = 1 streak saver

// Initialize streak data if not present
function ensureStreakData(callback) {
  chrome.storage.local.get(["streakData"], (res) => {
    const data = res.streakData || {
      currentStreak: 0,
      longestStreak: 0,
      streakSavers: 0,
      lastStreakDate: null,
      progressToNextSaver: 0,
      brokenStreakDate: null, // dateKey where streak first broke (for 1-day grace check)
    };
    if (callback) callback(data);
  });
}

// Recursively build the streak from workHistory, scanning backwards day by day
function calculateStreakFromHistory(history) {
  const todayKey = getDateKey(new Date());
  let streak = 0;
  let saverIntervalCount = 0;
  let saversEarned = 0;
  let lastStreakDate = null;
  let brokenStreakDate = null;

  // Check if today qualifies first
  const todayMinutes = history[todayKey] || 0;
  if (todayMinutes >= STREAK_THRESHOLD_MINUTES) {
    streak = 1;
    saverIntervalCount = 1;
    lastStreakDate = todayKey;

    // Walk backwards from yesterday
    let walkDate = new Date(todayKey);
    walkDate.setDate(walkDate.getDate() - 1);
    for (let i = 1; i < 365; i++) {
      const dateKey = formatDateKey(walkDate);
      const minutes = history[dateKey] || 0;
      if (minutes >= STREAK_THRESHOLD_MINUTES) {
        streak++;
        saverIntervalCount++;
        if (saverIntervalCount >= STREAK_SAVER_INTERVAL) {
          saversEarned++;
          saverIntervalCount = 0;
        }
        walkDate.setDate(walkDate.getDate() - 1);
      } else {
        break;
      }
    }
  } else {
    // Today doesn't qualify. Check if yesterday qualified.
    // If so, the streak is "broken" as of today (1-day gap, recoverable)
    const yesterdayKey = getDateKey(new Date(Date.now() - 86400000));
    const yesterdayMinutes = history[yesterdayKey] || 0;

    if (yesterdayMinutes >= STREAK_THRESHOLD_MINUTES) {
      // Streak was active as of yesterday, now broken today (1-day gap)
      streak = 1;
      saverIntervalCount = 1;
      lastStreakDate = yesterdayKey;
      brokenStreakDate = todayKey;

      // Walk backwards from the day before yesterday
      let walkDate = new Date(yesterdayKey);
      walkDate.setDate(walkDate.getDate() - 1);
      for (let i = 1; i < 365; i++) {
        const dateKey = formatDateKey(walkDate);
        const minutes = history[dateKey] || 0;
        if (minutes >= STREAK_THRESHOLD_MINUTES) {
          streak++;
          saverIntervalCount++;
          if (saverIntervalCount >= STREAK_SAVER_INTERVAL) {
            saversEarned++;
            saverIntervalCount = 0;
          }
          walkDate.setDate(walkDate.getDate() - 1);
        } else {
          break;
        }
      }
    } else {
      // No active streak. Walk backwards to find the most recent qualifying day
      let walkDate = new Date(todayKey);
      walkDate.setDate(walkDate.getDate() - 1);
      for (let i = 1; i < 365; i++) {
        const dateKey = formatDateKey(walkDate);
        const minutes = history[dateKey] || 0;
        if (minutes >= STREAK_THRESHOLD_MINUTES) {
          // Found the most recent qualifying day - start streak from here
          streak = 1;
          saverIntervalCount = 1;
          lastStreakDate = dateKey;

          // Walk further back
          walkDate.setDate(walkDate.getDate() - 1);
          for (let j = 1; j < 365; j++) {
            const backDateKey = formatDateKey(walkDate);
            const backMinutes = history[backDateKey] || 0;
            if (backMinutes >= STREAK_THRESHOLD_MINUTES) {
              streak++;
              saverIntervalCount++;
              if (saverIntervalCount >= STREAK_SAVER_INTERVAL) {
                saversEarned++;
                saverIntervalCount = 0;
              }
              walkDate.setDate(walkDate.getDate() - 1);
            } else {
              break;
            }
          }
          break;
        }
        walkDate.setDate(walkDate.getDate() - 1);
      }
    }
  }

  return {
    currentStreak: streak,
    longestStreak: streak, // We'll track the longest separately
    streakSavers: saversEarned,
    lastStreakDate,
    progressToNextSaver: saverIntervalCount,
    brokenStreakDate,
  };
}

// Update streak data after workHistory changes
function updateStreakData(callback) {
  chrome.storage.local.get(["workHistory", "streakData"], (res) => {
    const history = res.workHistory || {};
    const prevStreakData = res.streakData || {
      currentStreak: 0,
      longestStreak: 0,
      streakSavers: 0,
      lastStreakDate: null,
      progressToNextSaver: 0,
      brokenStreakDate: null,
    };

    // Recalculate streak from history
    const calculated = calculateStreakFromHistory(history);

    // Preserve the longest streak ever achieved
    const longestStreak = Math.max(
      prevStreakData.longestStreak || 0,
      calculated.currentStreak,
    );

    // Preserve previously earned streak savers (don't lose them on recalculation)
    const streakSavers = Math.max(
      prevStreakData.streakSavers || 0,
      calculated.streakSavers,
    );

    // Preserve brokenStreakDate from previous data if it's still valid
    let brokenStreakDate = calculated.brokenStreakDate;
    if (!brokenStreakDate && prevStreakData.brokenStreakDate) {
      const todayKey = getDateKey(new Date());
      const brokenDate = new Date(prevStreakData.brokenStreakDate);
      const todayDate = new Date(todayKey);
      const diffDays = Math.round((todayDate - brokenDate) / 86400000);
      if (diffDays === 1) {
        brokenStreakDate = prevStreakData.brokenStreakDate;
      }
    }

    const streakData = {
      ...calculated,
      longestStreak,
      streakSavers,
      brokenStreakDate,
    };

    chrome.storage.local.set({ streakData }, () => {
      if (callback) callback(streakData);
    });
  });
}

function calculateProgressData(history) {
  const now = new Date();
  const nowDate = new Date();

  // Total lifetime hours
  let totalHours = 0;
  for (const mins of Object.values(history)) {
    totalHours += mins / 60;
  }

  // Weekly hours (last 7 days)
  let weeklyHours = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(nowDate);
    d.setDate(d.getDate() - i);
    const key = getDateKey(d);
    weeklyHours += (history[key] || 0) / 60;
  }

  // Consecutive 10+ hour days
  let consecutive10HrDays = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(nowDate);
    d.setDate(d.getDate() - i);
    const key = getDateKey(d);
    if ((history[key] || 0) >= 600) {
      consecutive10HrDays++;
    } else {
      break;
    }
  }

  // Consecutive 14+ hour days
  let consecutive14HrDays = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(nowDate);
    d.setDate(d.getDate() - i);
    const key = getDateKey(d);
    if ((history[key] || 0) >= 840) {
      consecutive14HrDays++;
    } else {
      break;
    }
  }

  return {
    totalHours: Math.round(totalHours * 10) / 10,
    weeklyHours: Math.round(weeklyHours * 10) / 10,
    consecutive10HrDays,
    consecutive14HrDays,
  };
}

function checkAndAwardBadge(sessionMinutes, sessionPauses) {
  const todayKey = getDateKey(new Date());
  chrome.storage.local.get(["workHistory", "badgeData"], (res) => {
    const history = res.workHistory || {};
    let badgeData = res.badgeData || {
      monthly: 0,
      lifetime: 0,
      lastBadgeDate: null,
      badgeMonth: null,
    };

    // Initialize new achievement fields if not present
    if (badgeData.day1_30day_completed === undefined)
      badgeData.day1_30day_completed = false;
    if (badgeData.day1_30day_14hr_completed === undefined)
      badgeData.day1_30day_14hr_completed = false;
    if (badgeData.thousand_hours_completed === undefined)
      badgeData.thousand_hours_completed = false;
    if (badgeData.elon_musk_weekly_completed === undefined)
      badgeData.elon_musk_weekly_completed = false;
    if (badgeData.bronze_16hr_count === undefined)
      badgeData.bronze_16hr_count = 0;
    if (badgeData.six_hour_flow_count === undefined)
      badgeData.six_hour_flow_count = 0;
    if (badgeData.silver_3x16_count === undefined)
      badgeData.silver_3x16_count = 0;

    const todayMinutes = history[todayKey] || 0;

    // ===== 6 HOURS WITHOUT PAUSE - DEEP FLOW (Repeatable) =====
    // Track when a 6+ hour session is completed with zero pauses
    if (sessionMinutes >= 360 && (sessionPauses || 0) === 0) {
      badgeData.six_hour_flow_count = (badgeData.six_hour_flow_count || 0) + 1;
    }

    // ===== 16-HOUR BRONZE MEDAL (Repeatable) =====
    if (todayMinutes >= 960) {
      badgeData.bronze_16hr_count = (badgeData.bronze_16hr_count || 0) + 1;
    }

    // Calculate progress data for display
    const progress = calculateProgressData(history);

    // Store progress for UI display
    badgeData.progress = {
      threeZeroChallenge: {
        current: progress.consecutive10HrDays,
        target: 30,
        description: "10+ hours daily",
      },
      threeZeroChallenge14: {
        current: progress.consecutive14HrDays,
        target: 30,
        description: "14+ hours daily",
      },
      thousandHours: {
        current: Math.floor(progress.totalHours),
        target: 1000,
        description: "Total hours",
      },
      elonMusk: {
        current: Math.floor(progress.weeklyHours),
        target: 100,
        description: "Weekly hours",
      },
    };

    // ===== MONTHLY/LIFETIME BADGE (Existing logic for 16+ hours) =====
    if (todayMinutes >= 960) {
      const today = new Date();
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

      if (badgeData.lastBadgeDate !== todayKey) {
        badgeData.lifetime = (badgeData.lifetime || 0) + 1;
        badgeData.lastBadgeDate = todayKey;

        if (badgeData.badgeMonth !== currentMonth) {
          badgeData.monthly = 1;
          badgeData.badgeMonth = currentMonth;
        } else {
          badgeData.monthly = (badgeData.monthly || 0) + 1;
        }
      }
    }

    // ===== 1,000-HOUR CLUB (One-time) =====
    let totalLifetimeHours = 0;
    for (const [dateKey, mins] of Object.entries(history)) {
      totalLifetimeHours += mins / 60;
    }
    if (totalLifetimeHours >= 1000 && !badgeData.thousand_hours_completed) {
      badgeData.thousand_hours_completed = true;
    }

    // ===== ELON MUSK 100+ HOURS PER WEEK (One-time) =====
    const now = new Date();
    let weeklyTotal = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = getDateKey(d);
      weeklyTotal += history[key] || 0;
    }
    if (weeklyTotal >= 6000 && !badgeData.elon_musk_weekly_completed) {
      // 6000 mins = 100 hours
      badgeData.elon_musk_weekly_completed = true;
    }

    // ===== DAY 1 - 30 DAYS OF 10+ HOURS (One-time) =====
    if (!badgeData.day1_30day_completed) {
      const thirtyDayKeys = [];
      for (let i = 0; i < 30; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        thirtyDayKeys.push(getDateKey(d));
      }
      const all30Days10Hours = thirtyDayKeys.every(
        (key) => (history[key] || 0) >= 600,
      );
      if (all30Days10Hours) {
        badgeData.day1_30day_completed = true;
      }
    }

    // ===== DAY 1 - 30 DAYS OF 14+ HOURS (One-time) =====
    if (!badgeData.day1_30day_14hr_completed) {
      const thirtyDayKeys = [];
      for (let i = 0; i < 30; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        thirtyDayKeys.push(getDateKey(d));
      }
      const all30Days14Hours = thirtyDayKeys.every(
        (key) => (history[key] || 0) >= 840,
      );
      if (all30Days14Hours) {
        badgeData.day1_30day_14hr_completed = true;
      }
    }

    // ===== 3 CONSECUTIVE 16-HOUR DAYS (Repeatable) =====
    if (todayMinutes >= 960) {
      // Check if today, yesterday, and day before were all 16+ hours
      const yesterdayKey = getDateKey(new Date(Date.now() - 86400000));
      const dayBeforeKey = getDateKey(new Date(Date.now() - 2 * 86400000));
      if (
        (history[yesterdayKey] || 0) >= 960 &&
        (history[dayBeforeKey] || 0) >= 960
      ) {
        badgeData.silver_3x16_count = (badgeData.silver_3x16_count || 0) + 1;
      }
    }

    chrome.storage.local.set({ badgeData });
  });
}

// Migration: scan existing workHistory and award missing badges for past days
function migrateBadgesFromHistory() {
  chrome.storage.local.get(["workHistory", "badgeData"], (res) => {
    const history = res.workHistory || {};
    let badgeData = res.badgeData || {
      monthly: 0,
      lifetime: 0,
      lastBadgeDate: null,
      badgeMonth: null,
    };

    // Initialize all fields
    if (badgeData.day1_30day_completed === undefined)
      badgeData.day1_30day_completed = false;
    if (badgeData.day1_30day_14hr_completed === undefined)
      badgeData.day1_30day_14hr_completed = false;
    if (badgeData.thousand_hours_completed === undefined)
      badgeData.thousand_hours_completed = false;
    if (badgeData.elon_musk_weekly_completed === undefined)
      badgeData.elon_musk_weekly_completed = false;
    if (badgeData.bronze_16hr_count === undefined)
      badgeData.bronze_16hr_count = 0;
    if (badgeData.six_hour_flow_count === undefined)
      badgeData.six_hour_flow_count = 0;
    if (badgeData.silver_3x16_count === undefined)
      badgeData.silver_3x16_count = 0;
    if (badgeData.migrated) return;

    let awardedDays = 0;
    const awardedDates = new Set();
    if (badgeData.lastBadgeDate) awardedDates.add(badgeData.lastBadgeDate);

    // Scan all workHistory days
    for (const [dateKey, mins] of Object.entries(history)) {
      if (mins >= 960 && !awardedDates.has(dateKey)) {
        awardedDays++;
        awardedDates.add(dateKey);

        const d = new Date(dateKey + "T06:00:00");
        if (!isNaN(d.getTime())) {
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          if (monthKey === badgeData.badgeMonth) {
            badgeData.monthly = (badgeData.monthly || 0) + 1;
          } else {
            badgeData.monthly = 1;
            badgeData.badgeMonth = monthKey;
          }
        }
      }
    }

    if (awardedDays > 0) {
      badgeData.lifetime = (badgeData.lifetime || 0) + awardedDays;
      const todayKey = getDateKey(new Date());
      if (history[todayKey] >= 960 && !awardedDates.has(todayKey)) {
        badgeData.lastBadgeDate = todayKey;
      }
    }

    // Calculate bronze_16hr_count from history
    let bronzeCount = 0;
    for (const [dateKey, mins] of Object.entries(history)) {
      if (mins >= 960) bronzeCount++;
    }
    // Don't count today twice if already counted
    const todayKey = getDateKey(new Date());
    const todayMinutes = history[todayKey] || 0;
    if (todayMinutes >= 960) {
      bronzeCount = Math.max(bronzeCount, badgeData.bronze_16hr_count || 0);
    }

    // Check for 3 consecutive 16-hour days from history
    let silverCount = 0;
    const nowDate = new Date();
    for (let i = 2; i < 31; i++) {
      for (let j = i; j < i + 3; j++) {
        const d = new Date(nowDate);
        d.setDate(d.getDate() - j);
        const key = getDateKey(d);
        if ((history[key] || 0) < 960) break;
        if (j === i + 2) silverCount++;
      }
    }
    badgeData.silver_3x16_count = Math.max(
      badgeData.silver_3x16_count || 0,
      silverCount,
    );

    // Check for thousand hours
    let totalLifetimeHours = 0;
    for (const [dateKey, mins] of Object.entries(history)) {
      totalLifetimeHours += mins / 60;
    }
    if (totalLifetimeHours >= 1000) {
      badgeData.thousand_hours_completed = true;
    }

    // Check for 30 consecutive days of 10+ hours
    const sortedKeys = Object.keys(history).sort().reverse();
    if (sortedKeys.length >= 30) {
      let consecutive10HourCount = 0;
      for (let i = 0; i < sortedKeys.length; i++) {
        const key = sortedKeys[i];
        const mins = history[key];
        const expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() - i);
        const expectedKey = getDateKey(expectedDate);
        if (key === expectedKey && mins >= 600) {
          consecutive10HourCount++;
          if (consecutive10HourCount >= 30) {
            badgeData.day1_30day_completed = true;
            break;
          }
        } else {
          consecutive10HourCount = 0;
        }
      }
    }

    // Check for 30 consecutive days of 14+ hours
    if (!badgeData.day1_30day_14hr_completed) {
      let consecutive14HourCount = 0;
      for (let i = 0; i < sortedKeys.length; i++) {
        const key = sortedKeys[i];
        const mins = history[key];
        const expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() - i);
        const expectedKey = getDateKey(expectedDate);
        if (key === expectedKey && mins >= 840) {
          consecutive14HourCount++;
          if (consecutive14HourCount >= 30) {
            badgeData.day1_30day_14hr_completed = true;
            break;
          }
        } else {
          consecutive14HourCount = 0;
        }
      }
    }

    // Check for weekly 100+ hours
    for (let weekStart = 0; weekStart < sortedKeys.length - 6; weekStart += 7) {
      let weekTotal = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(nowDate);
        d.setDate(d.getDate() - weekStart - i);
        const key = getDateKey(d);
        weekTotal += history[key] || 0;
      }
      if (weekTotal >= 6000) {
        badgeData.elon_musk_weekly_completed = true;
        break;
      }
    }

    badgeData.bronze_16hr_count = bronzeCount;
    badgeData.migrated = true;
    chrome.storage.local.set({ badgeData });
  });
}

function updateBestWeekMonth() {
  chrome.storage.local.get(
    ["workHistory", "hourlyHistory", "bestData"],
    (res) => {
      const history = res.workHistory || {};
      const hourlyHistory = res.hourlyHistory || {};
      const bestData = res.bestData || {
        bestWeekTotal: 0,
        bestWeekHourly: null,
        bestMonthTotal: 0,
        bestMonthHourly: null,
        bestMonthLabel: null,
        bestWeekLabel: null,
      };

      const now = new Date();
      const todayKey = getDateKey(now);

      // Calculate this week's total (last 7 days)
      let thisWeekTotal = 0;
      const thisWeekHourly = new Array(24).fill(0);
      const thisWeekCount = new Array(24).fill(0);
      for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = getDateKey(d);
        thisWeekTotal += history[key] || 0;
        if (hourlyHistory[key]) {
          for (let h = 0; h < 24; h++) {
            const mins = hourlyHistory[key][h] || 0;
            if (mins > 0) {
              thisWeekHourly[h] += mins;
              thisWeekCount[h]++;
            }
          }
        }
      }

      // Calculate this month's total
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      let thisMonthTotal = 0;
      const thisMonthHourly = new Array(24).fill(0);
      const thisMonthCount = new Array(24).fill(0);
      for (const [key, mins] of Object.entries(history)) {
        const d = new Date(key + "T06:00:00");
        if (d >= monthStart && d <= now) {
          thisMonthTotal += mins;
          if (hourlyHistory[key]) {
            for (let h = 0; h < 24; h++) {
              const m = hourlyHistory[key][h] || 0;
              if (m > 0) {
                thisMonthHourly[h] += m;
                thisMonthCount[h]++;
              }
            }
          }
        }
      }

      let changed = false;

      // Check if this week is the best
      if (thisWeekTotal > (bestData.bestWeekTotal || 0)) {
        bestData.bestWeekTotal = thisWeekTotal;
        bestData.bestWeekHourly = thisWeekHourly.map((t, h) =>
          thisWeekCount[h] > 0 ? Math.round(t / thisWeekCount[h]) : 0,
        );
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 6);
        bestData.bestWeekLabel = `${formatDateKey(weekStart)} to ${todayKey}`;
        changed = true;
      }

      // Check if this month is the best
      if (thisMonthTotal > (bestData.bestMonthTotal || 0)) {
        bestData.bestMonthTotal = thisMonthTotal;
        bestData.bestMonthHourly = thisMonthHourly.map((t, h) =>
          thisMonthCount[h] > 0 ? Math.round(t / thisMonthCount[h]) : 0,
        );
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
        bestData.bestMonthLabel = `${months[now.getMonth()]} ${now.getFullYear()}`;
        changed = true;
      }

      if (changed) {
        chrome.storage.local.set({ bestData });
      }
    },
  );
}

// ===== AUDIO SYSTEM (Offscreen Document) =====
// Creates an offscreen audio document to play sounds.
// The loop parameter makes the sound play on repeat (for pause alerts).
async function playSound(soundFile, shouldLoop) {
  try {
    // Close any existing offscreen audio document first
    await chrome.offscreen.closeDocument().catch(() => {});
    // Create new offscreen document with the sound
    const params = new URLSearchParams({ sound: soundFile });
    if (shouldLoop) params.set("loop", "1");
    await chrome.offscreen.createDocument({
      url: `audio.html?${params.toString()}`,
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Play timer alert sounds",
    });
  } catch (err) {
    console.error("Failed to play sound:", err);
  }
}

// Stops any playing sound and closes the offscreen document
async function stopSound() {
  try {
    await chrome.offscreen.closeDocument().catch(() => {});
  } catch (err) {
    console.error("Failed to stop sound:", err);
  }
}

function notifyStateChange() {
  chrome.runtime.sendMessage({ type: "STATE_CHANGED" }).catch(() => {});
}

// Send message to external timer extension (if configured)
function notifyExternalExtension(action) {
  chrome.storage.sync.get(["externalTimerId"], (result) => {
    const extId = (result.externalTimerId || "").trim();
    if (!extId) return;
    chrome.runtime.sendMessage(extId, { action }, () => {
      // Ignore errors (extension might not be installed)
      if (chrome.runtime.lastError) {
        console.log(
          "External extension not reachable:",
          chrome.runtime.lastError.message,
        );
      }
    });
  });
}

// ===== BLOCKING FEATURE =====

// Helper to get today's date string (for daily resets)
function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

// Helper to extract YouTube channel identifier from a URL
function getYouTubeChannelIdentifier(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("youtube.com") && !u.hostname.includes("youtu.be"))
      return null;

    const path = u.pathname;

    const atMatch = path.match(/^\/(@[\w.-]+)/);
    if (atMatch) return atMatch[1];

    const channelMatch = path.match(/^\/channel\/(UC[\w-]+)/);
    if (channelMatch) return channelMatch[1];

    const cMatch = path.match(/^\/c\/([\w.-]+)/);
    if (cMatch) return cMatch[1];

    const userMatch = path.match(/^\/user\/([\w.-]+)/);
    if (userMatch) return userMatch[1];

    return null;
  } catch {
    return null;
  }
}

// Check if a URL should be blocked by domain pattern
function isBlockedByPattern(url, patterns) {
  if (!patterns || patterns.length === 0) return false;
  try {
    const u = new URL(url);
    const fullHost = u.hostname;
    for (const item of patterns) {
      const patternStr = typeof item === "string" ? item : item.pattern;
      if (fullHost.includes(patternStr)) return true;
    }
  } catch {}
  return false;
}

// Helper to check if a URL matches a channel key
function isChannelMatch(url, channelKey) {
  const channelId = getYouTubeChannelIdentifier(url);
  if (!channelId) return false;
  return (
    channelId.includes(channelKey) ||
    url.includes(channelKey) ||
    channelKey.includes(channelId)
  );
}

// Redirect a tab to blocked.html with the channel key as query param
function redirectToBlocked(tabId, channelKey) {
  const params = channelKey ? `?channel=${encodeURIComponent(channelKey)}` : "";
  chrome.tabs.update(tabId, {
    url: chrome.runtime.getURL(`blocked.html${params}`),
  });
}

function checkChannelBlock(channelKey, channelData, tabId) {
  if (!channelData.maxMinutes || channelData.maxMinutes === 0) {
    redirectToBlocked(tabId, channelKey);
    return;
  }

  const today = getTodayStr();
  let used = channelData.usedMinutes || 0;
  let lastReset = channelData.lastReset || "";

  if (lastReset !== today) {
    used = 0;
    channelData.usedMinutes = 0;
    channelData.lastReset = today;
    channelData.bonusUsed = false;
    chrome.storage.local.get(["youtubeBlockedChannels"], (store) => {
      const ch = store.youtubeBlockedChannels || {};
      if (ch[channelKey]) {
        ch[channelKey].usedMinutes = 0;
        ch[channelKey].lastReset = today;
        ch[channelKey].bonusUsed = false;
        chrome.storage.local.set({ youtubeBlockedChannels: ch });
      }
    });
  }

  if (used >= channelData.maxMinutes) {
    redirectToBlocked(tabId, channelKey);
  }
}

// Track active time spent on YouTube channels
// We use a single global alarm that fires every 10 seconds and checks all active tabs
let youtubeActiveTabs = {}; // tabId -> { channelKey, lastCheckedUrl }

function startYouTubeTimeTracking(tabId, channelKey) {
  youtubeActiveTabs[tabId] = { channelKey, lastCheckedUrl: null };
  // Ensure the global tracking alarm is running
  chrome.alarms.create("youtube-global-track", { periodInMinutes: 1 / 6 }); // every 10 seconds
}

function stopYouTubeTimeTracking(tabId) {
  delete youtubeActiveTabs[tabId];
  // If no more active tabs, clear the global alarm
  if (Object.keys(youtubeActiveTabs).length === 0) {
    chrome.alarms.clear("youtube-global-track");
  }
}

// Single global alarm handler for all YouTube tracking
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "youtube-global-track") {
    const tabIds = Object.keys(youtubeActiveTabs);
    if (tabIds.length === 0) {
      chrome.alarms.clear("youtube-global-track");
      return;
    }

    for (const tabIdStr of tabIds) {
      const tabId = parseInt(tabIdStr);
      const trackData = youtubeActiveTabs[tabId];
      if (!trackData) continue;

      const { channelKey } = trackData;

      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) {
          stopYouTubeTimeTracking(tabId);
          return;
        }

        // Check if still on a YouTube page that matches this channel
        if (!tab.url || !tab.url.includes("youtube.com")) {
          stopYouTubeTimeTracking(tabId);
          return;
        }

        // Don't count time if on blocked page
        if (tab.url.includes("blocked.html")) {
          return;
        }

        // Check if URL changed (navigated to a different video)
        if (trackData.lastCheckedUrl && trackData.lastCheckedUrl !== tab.url) {
          trackData.lastCheckedUrl = tab.url;
        } else if (!trackData.lastCheckedUrl) {
          trackData.lastCheckedUrl = tab.url;
        }

        // Add 10 seconds of time (10/60 = 0.1667 minutes)
        chrome.storage.local.get(["youtubeBlockedChannels"], (res) => {
          const channels = res.youtubeBlockedChannels || {};
          const data = channels[channelKey];
          if (!data || !data.maxMinutes) {
            stopYouTubeTimeTracking(tabId);
            return;
          }

          const today = getTodayStr();
          if (data.lastReset !== today) {
            data.usedMinutes = 0;
            data.lastReset = today;
            data.bonusUsed = false;
          }

          data.usedMinutes = (data.usedMinutes || 0) + 10 / 60;
          channels[channelKey] = data;
          chrome.storage.local.set({ youtubeBlockedChannels: channels });

          if (data.usedMinutes >= data.maxMinutes) {
            redirectToBlocked(tabId, channelKey);
            stopYouTubeTimeTracking(tabId);
          }
        });
      });
    }
  }
});

// Helper function to handle YouTube channel detection
function handleYouTubeNavigation(details) {
  if (details.frameId !== 0) return;

  stopYouTubeTimeTracking(details.tabId);

  const channelId = getYouTubeChannelIdentifier(details.url);
  if (!channelId) return;

  chrome.storage.local.get(
    ["youtubeBlockedChannels", "blockedPatterns"],
    (res) => {
      const patterns = res.blockedPatterns || [];
      if (isBlockedByPattern(details.url, patterns)) {
        redirectToBlocked(details.tabId, null);
        return;
      }

      const channels = res.youtubeBlockedChannels || {};
      let matchedKey = null;

      for (const key of Object.keys(channels)) {
        if (isChannelMatch(details.url, key)) {
          matchedKey = key;
          break;
        }
      }

      if (!matchedKey) return;

      const data = channels[matchedKey];
      if (!data.maxMinutes) {
        redirectToBlocked(details.tabId, matchedKey);
      } else {
        startYouTubeTimeTracking(details.tabId, matchedKey);
        checkChannelBlock(matchedKey, data, details.tabId);
      }
    },
  );
}

chrome.webNavigation.onBeforeNavigate.addListener(handleYouTubeNavigation);
chrome.webNavigation.onHistoryStateUpdated.addListener(handleYouTubeNavigation);

chrome.tabs.onRemoved.addListener((tabId) => {
  stopYouTubeTimeTracking(tabId);
});

// ===== KEYWORD BLOCKING =====
async function getBlockedKeywords() {
  const res = await chrome.storage.local.get(["blockedKeywords"]);
  return res.blockedKeywords || [];
}

function keywordMatchesAny(text, keywords) {
  if (!text || !keywords || keywords.length === 0) return false;
  const lowerText = text.toLowerCase();
  for (const kw of keywords) {
    const kwStr = typeof kw === "string" ? kw : kw.keyword;
    if (lowerText.includes(kwStr.toLowerCase())) return true;
  }
  return false;
}

// Rebuild declarativeNetRequest rules from stored patterns
async function updateBlockingRules() {
  const res = await chrome.storage.local.get(["blockedPatterns"]);
  const patterns = res.blockedPatterns || [];

  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const oldRuleIds = oldRules.map((r) => r.id);

  const newRules = patterns.map((item, index) => {
    const patternStr = typeof item === "string" ? item : item.pattern;
    return {
      id: index + 1,
      priority: 1,
      action: { type: "block" },
      condition: {
        regexFilter: `.*${escapeRegex(patternStr)}.*`,
        resourceTypes: ["main_frame", "sub_frame"],
      },
    };
  });

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: oldRuleIds,
    addRules: newRules,
  });
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Get yesterday's date key for recovery check
function getYesterdayKey() {
  const d = new Date();
  d.setHours(d.getHours() - 6);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

// Main message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START") {
    totalDurationMins = message.minutes;
    remainingTime = totalDurationMins * 60;
    isBreakSession = message.isBreak || false;
    overtimeSeconds = 0;
    pauseCount = 0;
    pauseDurationSecs = 0;
    resumeTimerEndTime = 0;
    resumeOvertimeSeconds = 0;

    endTime = Date.now() + remainingTime * 1000;

    startTimerEngine();
    updateBadgeText(remainingTime);
    notifyStateChange();
    // Notify external timer extension that focus session started
    notifyExternalExtension("timerStart");
    sendResponse({ success: true });
  } else if (message.type === "TOGGLE_PAUSE") {
    if (currentState === "RUNNING") {
      // Use default pause duration from settings (10 minutes)
      chrome.storage.local.get(["pauseSettings"], async (res) => {
        const settings = res.pauseSettings || {
          maxPauses: 3,
          defaultPauseDuration: 10,
        };
        if (pauseCount >= settings.maxPauses) {
          sendResponse({ success: false, reason: "Max pauses reached" });
          return;
        }
        pauseCount++;
        currentState = "PAUSED";
        pauseTimeLeft = endTime - Date.now();
        pauseDurationSecs = settings.defaultPauseDuration * 60;
        resumeTimerEndTime = Date.now() + pauseDurationSecs * 1000;
        clearIntervalEngine();
        chrome.action.setBadgeBackgroundColor({ color: "#8e8e93" });
        startResumeTimerEngine();
        saveStateToStorage();
        notifyStateChange();
        // Play looping alert sound to remind user to unpause
        await playSound("timeisabout_to_up.mp3", true).catch(() => {});
        sendResponse({
          success: true,
          pauseCount,
          maxPauses: settings.maxPauses,
          pauseDurationSecs,
        });
      });
      return true;
    } else if (
      currentState === "PAUSED" ||
      currentState === "PAUSED_OVERTIME"
    ) {
      // Resume the timer - stop the looping pause alert sound
      stopSound();
      currentState = "RUNNING";
      endTime = Date.now() + pauseTimeLeft;
      pauseDurationSecs = 0;
      resumeTimerEndTime = 0;
      resumeOvertimeSeconds = 0;
      clearIntervalEngine();
      startTimerEngine();
      saveStateToStorage();
      notifyStateChange();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, reason: "Cannot pause in current state" });
    }
  } else if (message.type === "PAUSE_WITH_DURATION") {
    // User sets a custom pause duration
    if (currentState !== "RUNNING") {
      sendResponse({ success: false, reason: "Timer is not running" });
      return;
    }
    chrome.storage.local.get(["pauseSettings"], (res) => {
      const settings = res.pauseSettings || {
        maxPauses: 3,
        defaultPauseDuration: 10,
      };
      if (pauseCount >= settings.maxPauses) {
        sendResponse({ success: false, reason: "Max pauses reached" });
        return;
      }
      pauseCount++;
      const durationMins =
        message.durationMinutes || settings.defaultPauseDuration;
      currentState = "PAUSED";
      pauseTimeLeft = endTime - Date.now();
      pauseDurationSecs = durationMins * 60;
      resumeTimerEndTime = Date.now() + pauseDurationSecs * 1000;
      clearIntervalEngine();
      chrome.action.setBadgeBackgroundColor({ color: "#8e8e93" });
      startResumeTimerEngine();
      saveStateToStorage();
      notifyStateChange();
      sendResponse({
        success: true,
        pauseCount,
        maxPauses: settings.maxPauses,
        pauseDurationSecs,
      });
    });
    return true;
  } else if (message.type === "END") {
    clearIntervalEngine();

    chrome.storage.local.get(["timerPersistentState", "workHistory"], (res) => {
      const persisted = res.timerPersistentState || {};
      const savedTotalMins = persisted.totalDurationMins || totalDurationMins;
      const savedEndTime = persisted.endTime || endTime;
      const savedIsBreak = persisted.isBreakSession ?? isBreakSession;

      if (!savedIsBreak && savedTotalMins > 0 && savedEndTime > 0) {
        const now = Date.now();
        const actualRemainingSecs = Math.max(
          0,
          Math.round((savedEndTime - now) / 1000),
        );
        const elapsedMins =
          savedTotalMins - Math.ceil(actualRemainingSecs / 60);
        if (elapsedMins > 0) {
          const savedStartTime = savedEndTime - savedTotalMins * 60 * 1000;
          const actualEndTime = now;
          const daySplits = splitSessionAcrossDays(
            savedStartTime,
            actualEndTime,
          );
          const history = res.workHistory || {};
          for (const [dateKey, minutes] of Object.entries(daySplits)) {
            const attributedMins = Math.floor(minutes * 0.8);
            if (attributedMins > 0) {
              history[dateKey] = (history[dateKey] || 0) + attributedMins;
            }
          }
          chrome.storage.local.set({ workHistory: history }, () => {
            updateStreakData();
          });
        }

        // Save hourly breakdown for END handler
        const savedStartTime = savedEndTime - savedTotalMins * 60 * 1000;
        saveHourlyData(savedStartTime, now);
      }

      currentState = "IDLE";
      remainingTime = 0;
      totalDurationMins = 0;
      endTime = 0;
      pauseTimeLeft = 0;
      isBreakSession = false;
      overtimeSeconds = 0;
      pauseCount = 0;
      pauseDurationSecs = 0;
      resumeTimerEndTime = 0;
      resumeOvertimeSeconds = 0;

      chrome.action.setBadgeText({ text: "" });
      chrome.action.setBadgeBackgroundColor({ color: "#b81d18" });

      saveStateToStorage();
      notifyStateChange();
      // Notify external timer extension that focus session stopped
      notifyExternalExtension("timerStop");
      sendResponse({ success: true });
    });
    return true;
  } else if (message.type === "RESET") {
    clearIntervalEngine();
    currentState = "IDLE";
    remainingTime = 0;
    totalDurationMins = 0;
    endTime = 0;
    pauseTimeLeft = 0;
    isBreakSession = false;
    overtimeSeconds = 0;
    pauseCount = 0;
    pauseDurationSecs = 0;
    resumeTimerEndTime = 0;
    resumeOvertimeSeconds = 0;

    chrome.action.setBadgeText({ text: "" });
    chrome.action.setBadgeBackgroundColor({ color: "#b81d18" });

    saveStateToStorage();
    notifyStateChange();
    // Notify external timer extension that focus session stopped
    notifyExternalExtension("timerStop");
    sendResponse({ success: true });
  } else if (message.type === "GET_STATE") {
    chrome.storage.local.get(["timerPersistentState"], (res) => {
      if (res.timerPersistentState && currentState === "IDLE") {
        const saved = res.timerPersistentState;
        if (saved.currentState !== "IDLE") {
          remainingTime = saved.remainingTime;
          totalDurationMins = saved.totalDurationMins;
          currentState = saved.currentState;
          isBreakSession = saved.isBreakSession;
          endTime = saved.endTime;
          pauseTimeLeft = saved.pauseTimeLeft;
          overtimeSeconds = saved.overtimeSeconds || 0;
          pauseCount = saved.pauseCount || 0;
          pauseDurationSecs = saved.pauseDurationSecs || 0;
          resumeTimerEndTime = saved.resumeTimerEndTime || 0;
          resumeOvertimeSeconds = saved.resumeOvertimeSeconds || 0;
        }
      }

      if (currentState === "RUNNING") {
        const now = Date.now();
        if (now >= endTime) {
          remainingTime = 0;
          handleSessionCompletion();
          sendResponse({
            state: "IDLE",
            remainingTime: 0,
            totalDurationMins: 0,
            isBreak: false,
            overtimeSeconds: 0,
            pauseCount: 0,
          });
          return;
        } else {
          remainingTime = Math.round((endTime - now) / 1000);
        }
      }

      // Get resume timer remaining time
      let resumeTimerRemaining = 0;
      let resumeTimerOvertime = 0;
      if (currentState === "PAUSED" && resumeTimerEndTime > 0) {
        resumeTimerRemaining = Math.max(
          0,
          Math.round((resumeTimerEndTime - Date.now()) / 1000),
        );
      } else if (currentState === "PAUSED_OVERTIME") {
        resumeTimerOvertime = resumeOvertimeSeconds || 0;
      }

      sendResponse({
        state: currentState,
        remainingTime: remainingTime,
        totalDurationMins: totalDurationMins,
        isBreak: isBreakSession,
        overtimeSeconds: overtimeSeconds,
        pauseCount: pauseCount,
        pauseDurationSecs: pauseDurationSecs,
        resumeTimerRemaining: resumeTimerRemaining,
        resumeTimerOvertime: resumeTimerOvertime,
      });
    });
    return true;
  }

  // ===== PAUSE SETTINGS MESSAGES =====
  else if (message.type === "GET_PAUSE_SETTINGS") {
    chrome.storage.local.get(["pauseSettings"], (res) => {
      sendResponse({
        settings: res.pauseSettings || {
          maxPauses: 3,
          defaultPauseDuration: 10,
        },
      });
    });
    return true;
  } else if (message.type === "SAVE_PAUSE_SETTINGS") {
    chrome.storage.local.set({ pauseSettings: message.settings }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // ===== STREAK MESSAGES =====
  else if (message.type === "GET_STREAK_DATA") {
    // Wait for streak data to be updated before responding
    // This ensures we return fresh data, not stale cached values
    updateStreakData(() => {
      chrome.storage.local.get(["streakData", "workHistory"], (res) => {
        const streakData = res.streakData || {
          currentStreak: 0,
          longestStreak: 0,
          streakSavers: 0,
          lastStreakDate: null,
          progressToNextSaver: 0,
          brokenStreakDate: null,
        };
        const history = res.workHistory || {};
        const todayKey = getDateKey(new Date());
        const yesterdayKey = getYesterdayKey();
        const todayMinutes = history[todayKey] || 0;

        let canRecover = false;
        if (streakData.brokenStreakDate && streakData.streakSavers > 0) {
          const brokenDate = new Date(streakData.brokenStreakDate);
          const todayDate = new Date(todayKey);
          const diffDays = Math.round((todayDate - brokenDate) / 86400000);
          if (diffDays === 1) {
            canRecover = true;
          }
        }

        sendResponse({
          streakData,
          todayMinutes,
          canRecover,
        });
      });
    });
    return true;
  } else if (message.type === "RECOVER_STREAK") {
    chrome.storage.local.get(["streakData", "workHistory"], (res) => {
      const streakData = res.streakData || {
        currentStreak: 0,
        longestStreak: 0,
        streakSavers: 0,
        lastStreakDate: null,
        progressToNextSaver: 0,
        brokenStreakDate: null,
      };
      const history = res.workHistory || {};
      const todayKey = getDateKey(new Date());
      const yesterdayKey = getYesterdayKey();

      if (!streakData.brokenStreakDate || streakData.streakSavers <= 0) {
        sendResponse({
          success: false,
          reason: "Cannot recover streak at this time.",
        });
        return;
      }

      const brokenDate = new Date(streakData.brokenStreakDate);
      const todayDate = new Date(todayKey);
      const diffDays = Math.round((todayDate - brokenDate) / 86400000);
      if (diffDays !== 1) {
        sendResponse({
          success: false,
          reason: "Recovery window has expired.",
        });
        return;
      }

      streakData.streakSavers -= 1;
      streakData.lastStreakDate = yesterdayKey;
      streakData.brokenStreakDate = null;

      if (streakData.currentStreak > streakData.longestStreak) {
        streakData.longestStreak = streakData.currentStreak;
      }

      chrome.storage.local.set({ streakData }, () => {
        sendResponse({ success: true, streakData });
      });
    });
    return true;
  }

  // Blocking related messages
  else if (message.type === "GET_BLOCKED_PATTERNS") {
    chrome.storage.local.get(["blockedPatterns"], (res) => {
      sendResponse({ patterns: res.blockedPatterns || [] });
    });
    return true;
  } else if (message.type === "ADD_BLOCKED_PATTERN") {
    chrome.storage.local.get(["blockedPatterns"], async (res) => {
      const patterns = res.blockedPatterns || [];
      const exists = patterns.some(
        (p) => (typeof p === "string" ? p : p.pattern) === message.pattern,
      );
      if (!exists) {
        patterns.push({ pattern: message.pattern, deleteClicks: 0 });
        await chrome.storage.local.set({ blockedPatterns: patterns });
        await updateBlockingRules();
      }
      sendResponse({ success: true, patterns });
    });
    return true;
  } else if (message.type === "INCREMENT_DELETE_CLICK") {
    chrome.storage.local.get(["blockedPatterns"], async (res) => {
      let patterns = res.blockedPatterns || [];
      let found = false;
      for (let i = 0; i < patterns.length; i++) {
        const p =
          typeof patterns[i] === "string" ? patterns[i] : patterns[i].pattern;
        if (p === message.pattern) {
          if (typeof patterns[i] === "string") {
            patterns[i] = { pattern: patterns[i], deleteClicks: 1 };
          } else {
            patterns[i].deleteClicks = (patterns[i].deleteClicks || 0) + 1;
          }
          found = true;
          break;
        }
      }
      if (found) {
        await chrome.storage.local.set({ blockedPatterns: patterns });
        sendResponse({
          success: true,
          deleteClicks:
            patterns.find(
              (p) =>
                (typeof p === "string" ? p : p.pattern) === message.pattern,
            )?.deleteClicks || 0,
        });
      } else {
        sendResponse({ success: false });
      }
    });
    return true;
  } else if (message.type === "REMOVE_BLOCKED_PATTERN") {
    chrome.storage.local.get(["blockedPatterns"], async (res) => {
      let patterns = res.blockedPatterns || [];
      const target = patterns.find(
        (p) => (typeof p === "string" ? p : p.pattern) === message.pattern,
      );
      if (target && (target.deleteClicks || 0) >= 200) {
        patterns = patterns.filter(
          (p) => (typeof p === "string" ? p : p.pattern) !== message.pattern,
        );
        await chrome.storage.local.set({ blockedPatterns: patterns });
        await updateBlockingRules();
        sendResponse({ success: true, patterns });
      } else {
        sendResponse({ success: false, clicks: target?.deleteClicks || 0 });
      }
    });
    return true;
  } else if (message.type === "GET_YOUTUBE_CHANNELS") {
    chrome.storage.local.get(["youtubeBlockedChannels"], (res) => {
      sendResponse({ channels: res.youtubeBlockedChannels || {} });
    });
    return true;
  } else if (message.type === "ADD_YOUTUBE_CHANNEL") {
    chrome.storage.local.get(["youtubeBlockedChannels"], async (res) => {
      const channels = res.youtubeBlockedChannels || {};
      channels[message.channelKey] = {
        maxMinutes: message.maxMinutes || null,
        usedMinutes: 0,
        lastReset: getTodayStr(),
        bonusUsed: false,
        deleteClicks: 0,
      };
      await chrome.storage.local.set({ youtubeBlockedChannels: channels });
      sendResponse({ success: true, channels });
    });
    return true;
  } else if (message.type === "INCREMENT_YOUTUBE_DELETE_CLICK") {
    chrome.storage.local.get(["youtubeBlockedChannels"], async (res) => {
      const channels = res.youtubeBlockedChannels || {};
      const data = channels[message.channelKey];
      if (data) {
        data.deleteClicks = (data.deleteClicks || 0) + 1;
        await chrome.storage.local.set({ youtubeBlockedChannels: channels });
        sendResponse({ success: true, deleteClicks: data.deleteClicks });
      } else {
        sendResponse({ success: false });
      }
    });
    return true;
  } else if (message.type === "REMOVE_YOUTUBE_CHANNEL") {
    chrome.storage.local.get(["youtubeBlockedChannels"], async (res) => {
      const channels = res.youtubeBlockedChannels || {};
      const data = channels[message.channelKey];
      if (data && (data.deleteClicks || 0) >= 200) {
        delete channels[message.channelKey];
        await chrome.storage.local.set({ youtubeBlockedChannels: channels });
        sendResponse({ success: true, channels });
      } else {
        sendResponse({ success: false, clicks: data?.deleteClicks || 0 });
      }
    });
    return true;
  } else if (message.type === "ADD_5_MINUTES_BONUS") {
    chrome.storage.local.get(["youtubeBlockedChannels"], async (res) => {
      const channels = res.youtubeBlockedChannels || {};
      const data = channels[message.channelKey];
      if (data && !data.bonusUsed) {
        data.maxMinutes = (data.maxMinutes || 0) + 5;
        data.bonusUsed = true;
        data.lastReset = getTodayStr();
        await chrome.storage.local.set({ youtubeBlockedChannels: channels });
        sendResponse({ success: true, newMax: data.maxMinutes });
      } else {
        sendResponse({
          success: false,
          reason:
            data && data.bonusUsed
              ? "Bonus already used today"
              : "Channel not found",
        });
      }
    });
    return true;
  } else if (message.type === "CHECK_VIDEO_CHANNEL") {
    const tabId = sender.tab ? sender.tab.id : null;
    if (!tabId) {
      sendResponse({ blocked: false });
      return true;
    }

    const checkStr = (message.channelHandle || message.channelName || "")
      .toLowerCase()
      .replace(/^@/, "");

    chrome.storage.local.get(
      ["youtubeBlockedChannels", "blockedPatterns"],
      (res) => {
        const patterns = res.blockedPatterns || [];
        if (isBlockedByPattern(message.url, patterns)) {
          redirectToBlocked(tabId, null);
          sendResponse({ blocked: true });
          return;
        }

        const channels = res.youtubeBlockedChannels || {};
        let matchedKey = null;

        for (const key of Object.keys(channels)) {
          const keyLower = key.toLowerCase().replace(/^@/, "");
          if (
            checkStr.includes(keyLower) ||
            keyLower.includes(checkStr) ||
            message.channelHandle?.toLowerCase().includes(keyLower) ||
            message.channelName?.toLowerCase().includes(keyLower)
          ) {
            matchedKey = key;
            break;
          }
        }

        if (!matchedKey) {
          sendResponse({ blocked: false });
          return;
        }

        const data = channels[matchedKey];
        if (!data.maxMinutes) {
          redirectToBlocked(tabId, matchedKey);
          sendResponse({ blocked: true });
        } else {
          if (!youtubeActiveTabs[tabId]) {
            startYouTubeTimeTracking(tabId, matchedKey);
          } else {
            youtubeActiveTabs[tabId].channelKey = matchedKey;
          }
          checkChannelBlock(matchedKey, data, tabId);
          sendResponse({ blocked: false, tracking: true });
        }
      },
    );
    return true;
  } else if (message.type === "GET_BLOCKED_KEYWORDS") {
    chrome.storage.local.get(["blockedKeywords"], (res) => {
      sendResponse({ keywords: res.blockedKeywords || [] });
    });
    return true;
  } else if (message.type === "ADD_BLOCKED_KEYWORD") {
    chrome.storage.local.get(["blockedKeywords"], async (res) => {
      const keywords = res.blockedKeywords || [];
      const kw = message.keyword.toLowerCase().trim();
      const exists = keywords.some(
        (k) => (typeof k === "string" ? k : k.keyword) === kw,
      );
      if (!exists) {
        keywords.push({ keyword: kw, deleteClicks: 0 });
        await chrome.storage.local.set({ blockedKeywords: keywords });
      }
      sendResponse({ success: true, keywords });
    });
    return true;
  } else if (message.type === "INCREMENT_KEYWORD_DELETE_CLICK") {
    chrome.storage.local.get(["blockedKeywords"], async (res) => {
      const keywords = res.blockedKeywords || [];
      for (let i = 0; i < keywords.length; i++) {
        const kw =
          typeof keywords[i] === "string" ? keywords[i] : keywords[i].keyword;
        if (kw === message.keyword) {
          if (typeof keywords[i] === "string") {
            keywords[i] = { keyword: keywords[i], deleteClicks: 1 };
          } else {
            keywords[i].deleteClicks = (keywords[i].deleteClicks || 0) + 1;
          }
          break;
        }
      }
      await chrome.storage.local.set({ blockedKeywords: keywords });
      sendResponse({ success: true });
    });
    return true;
  } else if (message.type === "REMOVE_BLOCKED_KEYWORD") {
    chrome.storage.local.get(["blockedKeywords"], async (res) => {
      let keywords = res.blockedKeywords || [];
      const target = keywords.find(
        (k) => (typeof k === "string" ? k : k.keyword) === message.keyword,
      );
      if (target && (target.deleteClicks || 0) >= 200) {
        keywords = keywords.filter(
          (k) => (typeof k === "string" ? k : k.keyword) !== message.keyword,
        );
        await chrome.storage.local.set({ blockedKeywords: keywords });
        sendResponse({ success: true, keywords });
      } else {
        sendResponse({ success: false, clicks: target?.deleteClicks || 0 });
      }
    });
    return true;
  } else if (message.type === "CHECK_VIDEO_KEYWORDS") {
    const tabId = sender.tab ? sender.tab.id : null;
    if (!tabId) {
      sendResponse({ blocked: false });
      return true;
    }

    chrome.storage.local.get(["blockedKeywords"], (res) => {
      const keywords = res.blockedKeywords || [];
      const keywordStrs = keywords.map((k) =>
        (typeof k === "string" ? k : k.keyword).toLowerCase(),
      );
      const text = (message.text || "").toLowerCase();
      const matchedKeyword = keywordStrs.find((kw) => text.includes(kw));

      if (matchedKeyword) {
        const params = `?keyword=${encodeURIComponent(matchedKeyword)}`;
        chrome.tabs.update(tabId, {
          url: chrome.runtime.getURL(`blocked.html${params}`),
        });
        sendResponse({ blocked: true, keyword: matchedKeyword });
      } else {
        sendResponse({
          blocked: false,
          keywords: keywordStrs,
        });

        if (message.url && message.url.includes("/results")) {
          chrome.tabs
            .sendMessage(tabId, {
              type: "HIDE_BLOCKED_RESULTS",
              keywords: keywordStrs,
            })
            .catch(() => {});
        }
      }
    });
    return true;
  }

  // ===== BADGE MESSAGES =====
  else if (message.type === "GET_BADGE_DATA") {
    // Get existing badge data and initialize missing fields
    chrome.storage.local.get(["badgeData", "workHistory"], (res) => {
      const existingData = res.badgeData || {};
      const history = res.workHistory || {};

      // Build badgeData with all required fields initialized
      let badgeData = {
        monthly: existingData.monthly || 0,
        lifetime: existingData.lifetime || 0,
        lastBadgeDate: existingData.lastBadgeDate || null,
        badgeMonth: existingData.badgeMonth || null,
        // New achievement fields - initialize from existing or defaults
        day1_30day_completed: existingData.day1_30day_completed || false,
        day1_30day_14hr_completed:
          existingData.day1_30day_14hr_completed || false,
        thousand_hours_completed:
          existingData.thousand_hours_completed || false,
        elon_musk_weekly_completed:
          existingData.elon_musk_weekly_completed || false,
        bronze_16hr_count: existingData.bronze_16hr_count || 0,
        six_hour_flow_count: existingData.six_hour_flow_count || 0,
        silver_3x16_count: existingData.silver_3x16_count || 0,
      };

      // Scan history for bronze_16hr_count if not migrated
      if (!existingData.bronze_16hr_count && !existingData.migrated) {
        let bronzeCount = 0;
        for (const mins of Object.values(history)) {
          if (mins >= 960) bronzeCount++;
        }
        badgeData.bronze_16hr_count = bronzeCount;
        badgeData.migrated = true;
        chrome.storage.local.set({ badgeData }).catch(() => {});
      }

      // Check for thousand hours if not already completed
      if (!badgeData.thousand_hours_completed) {
        let totalLifetimeHours = 0;
        for (const mins of Object.values(history)) {
          totalLifetimeHours += mins / 60;
        }
        if (totalLifetimeHours >= 1000) {
          badgeData.thousand_hours_completed = true;
        }
      }

      // Check for 30 consecutive days of 10+ hours
      if (!badgeData.day1_30day_completed) {
        const sortedKeys = Object.keys(history).sort().reverse();
        if (sortedKeys.length >= 30) {
          let consecutive10HourCount = 0;
          for (let i = 0; i < sortedKeys.length; i++) {
            const key = sortedKeys[i];
            const mins = history[key];
            const expectedDate = new Date();
            expectedDate.setDate(expectedDate.getDate() - i);
            const expectedKey = getDateKey(expectedDate);
            if (key === expectedKey && mins >= 600) {
              consecutive10HourCount++;
              if (consecutive10HourCount >= 30) {
                badgeData.day1_30day_completed = true;
                break;
              }
            } else {
              consecutive10HourCount = 0;
            }
          }
        }
      }

      // Check for 30 consecutive days of 14+ hours
      if (!badgeData.day1_30day_14hr_completed) {
        const sortedKeys = Object.keys(history).sort().reverse();
        if (sortedKeys.length >= 30) {
          let consecutive14HourCount = 0;
          for (let i = 0; i < sortedKeys.length; i++) {
            const key = sortedKeys[i];
            const mins = history[key];
            const expectedDate = new Date();
            expectedDate.setDate(expectedDate.getDate() - i);
            const expectedKey = getDateKey(expectedDate);
            if (key === expectedKey && mins >= 840) {
              consecutive14HourCount++;
              if (consecutive14HourCount >= 30) {
                badgeData.day1_30day_14hr_completed = true;
                break;
              }
            } else {
              consecutive14HourCount = 0;
            }
          }
        }
      }

      // Check for 3 consecutive 16-hour days
      if (!badgeData.silver_3x16_count) {
        const nowDate = new Date();
        let silverCount = 0;
        for (let i = 2; i < 31; i++) {
          for (let j = i; j < i + 3; j++) {
            const d = new Date(nowDate);
            d.setDate(d.getDate() - j);
            const key = getDateKey(d);
            if ((history[key] || 0) < 960) break;
            if (j === i + 2) silverCount++;
          }
        }
        badgeData.silver_3x16_count = silverCount;
      }

      // Check for weekly 100+ hours
      if (!badgeData.elon_musk_weekly_completed) {
        const nowDate = new Date();
        const sortedKeys = Object.keys(history).sort().reverse();
        for (
          let weekStart = 0;
          weekStart < sortedKeys.length - 6;
          weekStart += 7
        ) {
          let weekTotal = 0;
          for (let i = 0; i < 7; i++) {
            const d = new Date(nowDate);
            d.setDate(d.getDate() - weekStart - i);
            const key = getDateKey(d);
            weekTotal += history[key] || 0;
          }
          if (weekTotal >= 6000) {
            badgeData.elon_musk_weekly_completed = true;
            break;
          }
        }
      }

      // ===== COMPUTE PROGRESS DATA FOR UI DISPLAY =====
      // This ensures achievements show correct progress (e.g. "X/100 hours this week")
      // even when the user hasn't just completed a session
      const progress = calculateProgressData(history);
      badgeData.progress = {
        threeZeroChallenge: {
          current: progress.consecutive10HrDays,
          target: 30,
          description: "10+ hours daily",
        },
        threeZeroChallenge14: {
          current: progress.consecutive14HrDays,
          target: 30,
          description: "14+ hours daily",
        },
        thousandHours: {
          current: Math.floor(progress.totalHours),
          target: 1000,
          description: "Total hours",
        },
        elonMusk: {
          current: Math.floor(progress.weeklyHours),
          target: 100,
          description: "Weekly hours",
        },
      };

      sendResponse({ badgeData: badgeData });
    });
    return true;
  }

  // ===== ANALYTICS MESSAGES =====
  else if (message.type === "GET_HOURLY_ANALYTICS") {
    chrome.storage.local.get(["hourlyHistory", "workHistory"], (res) => {
      sendResponse({
        hourlyHistory: res.hourlyHistory || {},
        workHistory: res.workHistory || {},
      });
    });
    return true;
  } else if (message.type === "GET_BEST_DATA") {
    chrome.storage.local.get(["bestData"], (res) => {
      sendResponse({ bestData: res.bestData || {} });
    });
    return true;
  } else if (message.type === "OPEN_ANALYTICS") {
    chrome.tabs.create({ url: chrome.runtime.getURL("analytics.html") });
    sendResponse({ success: true });
    return true;
  }

  // ===== SOUND MESSAGES =====
  else if (message.type === "PLAY_SOUND") {
    playSound(message.sound || "timeisabout_to_up.mp3", message.loop || false);
    sendResponse({ success: true });
    return true;
  } else if (message.type === "STOP_SOUND") {
    stopSound();
    sendResponse({ success: true });
    return true;
  }

  // ===== DATA MANAGEMENT MESSAGES =====
  else if (message.type === "EXPORT_DATA") {
    chrome.storage.local.get(null, (allData) => {
      sendResponse({ success: true, data: allData });
    });
    return true;
  } else if (message.type === "IMPORT_DATA") {
    if (!message.data || typeof message.data !== "object") {
      sendResponse({ success: false, reason: "Invalid data format" });
      return true;
    }
    chrome.storage.local.get(null, (existing) => {
      const keysToSet = {};
      let count = 0;
      for (const [key, value] of Object.entries(message.data)) {
        if (key !== "timerPersistentState" && key !== "recentDurations") {
          keysToSet[key] = value;
          count++;
        }
      }
      chrome.storage.local.set(keysToSet, () => {
        sendResponse({ success: true, count });
      });
    });
    return true;
  } else if (message.type === "CLEAR_DATA") {
    chrome.storage.local.clear(() => {
      // Reset state
      clearIntervalEngine();
      currentState = "IDLE";
      remainingTime = 0;
      totalDurationMins = 0;
      endTime = 0;
      pauseTimeLeft = 0;
      isBreakSession = false;
      overtimeSeconds = 0;
      pauseCount = 0;
      pauseDurationSecs = 0;
      resumeTimerEndTime = 0;
      resumeOvertimeSeconds = 0;
      chrome.action.setBadgeText({ text: "" });
      chrome.action.setBadgeBackgroundColor({ color: "#b81d18" });
      // Reinitialize necessary defaults
      initializePauseSettings();
      sendResponse({ success: true });
    });
    return true;
  }

  return true;
});

// ===== CROSS-EXTENSION MESSAGES (from external timer extensions) =====
chrome.runtime.onMessageExternal.addListener(
  (message, sender, sendResponse) => {
    // Check if the sender is a trusted timer extension
    chrome.storage.sync.get(["externalTimerId"], (result) => {
      const trustedId = (result.externalTimerId || "").trim();

      if (trustedId && sender.id === trustedId) {
        if (message && message.action === "timerStart") {
          // Timer started in the external extension - enable focus mode
          chrome.storage.sync.set({ focusModeActive: true }, () => {
            chrome.action.setBadgeText({ text: "ON" });
            chrome.action.setBadgeBackgroundColor({ color: "#b71c1c" });
          });
          sendResponse({ success: true, focusOn: true });
        } else if (message && message.action === "timerStop") {
          // Timer stopped - disable focus mode
          chrome.storage.sync.set({ focusModeActive: false }, () => {
            chrome.action.setBadgeText({ text: "" });
          });
          sendResponse({ success: true, focusOn: false });
        } else if (message && message.action === "ping") {
          // Just check if connection works
          sendResponse({ success: true, status: "connected" });
        }
      } else {
        sendResponse({ success: false, error: "Untrusted extension" });
      }
    });

    // Return true to keep the message channel open for async response
    return true;
  },
);

// Also rebuild rules when service worker starts
updateBlockingRules();

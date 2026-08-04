let currentDuration = 5;
let statsRangeDays = 7;

const viewSetup = document.getElementById("view-setup");
const viewProgress = document.getElementById("view-progress");
const viewDashboard = document.getElementById("view-dashboard");

const navTimer = document.getElementById("navTimer");
const navDashboard = document.getElementById("navDashboard");

const range7Btn = document.getElementById("range7Btn");
const range30Btn = document.getElementById("range30Btn");
range7Btn.style.backgroundColor = "#b81d18";
range7Btn.style.color = "#ffffff";
const dashboardList = document.getElementById("dashboardList");

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

let currentScheduleDay = 0; // 0 = Sunday
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
});

range7Btn.addEventListener("click", () => {
  statsRangeDays = 7;
  range7Btn.style.backgroundColor = "#b81d18";
  range7Btn.style.color = "#ffffff";
  range30Btn.style.backgroundColor = "#f0f0f0";
  range30Btn.style.color = "#333333";
  renderAnalytics();
});

range30Btn.addEventListener("click", () => {
  statsRangeDays = 30;
  range30Btn.style.backgroundColor = "#b81d18";
  range30Btn.style.color = "#ffffff";
  range7Btn.style.backgroundColor = "#f0f0f0";
  range7Btn.style.color = "#333333";
  renderAnalytics();
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
function calculateAvailableWorkHours(daySchedule) {
  if (!daySchedule || daySchedule.length === 0) return 24;
  let totalNonWorkMinutes = 0;
  for (const activity of daySchedule) {
    const duration = parseFloat(activity.duration) || 0;
    totalNonWorkMinutes += duration;
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

    const availableHours = calculateAvailableWorkHours(daySchedule);
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

// Calculate average hours for a given range (7 or 30 days)
function calculateAverageHours(history, inProgressMins, rangeDays) {
  let totalMinutes = 0;
  let daysWithData = 0;

  for (let i = 0; i < rangeDays; i++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - i);
    const dateString = getDateKey(targetDate);
    let minutesLogged = history[dateString] || 0;

    // Add in-progress timer time to "Today" row
    if (i === 0) {
      minutesLogged += inProgressMins;
    }

    totalMinutes += minutesLogged;
    if (minutesLogged > 0) {
      daysWithData++;
    }
  }

  const totalHours = totalMinutes / 60;
  const averageHours = totalHours / rangeDays;

  return {
    totalHours,
    averageHours,
    daysWithData,
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

      // Calculate averages
      const avgData = calculateAverageHours(
        history,
        inProgressMins,
        statsRangeDays,
      );

      for (let i = 0; i < statsRangeDays; i++) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - i);
        const dateString = getDateKey(targetDate);
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
        let displayText;
        if (i === 0) {
          displayText = "Today";
        } else if (i === 1) {
          displayText = "Yesterday";
        } else {
          displayText = formatDate(targetDate);
        }
        dateLabel.textContent = displayText;
        dateLabel.style.color = "#555";

        // Goal thresholds: <12hrs = red, 12-14hrs = light green, >=14hrs = dark green
        const hoursLogged = minutesLogged / 60;
        let goalColor;
        if (minutesLogged === 0) {
          goalColor = "#8e8e93";
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
}

function renderScheduleActivities() {
  const dayName = DAYS[currentScheduleDay];
  const activities = scheduleData[dayName] || [];

  scheduleActivities.innerHTML = "";
  if (activities.length === 0) {
    scheduleActivities.innerHTML =
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
  const dayName = DAYS[currentScheduleDay];
  if (!scheduleData[dayName]) {
    scheduleData[dayName] = [];
  }
  scheduleData[dayName].push({ name: "", duration: 0 });
  renderScheduleActivities();
});

scheduleToggleBtn.addEventListener("click", () => {
  if (dashboardSchedule.style.display === "none") {
    dashboardSchedule.style.display = "block";
    scheduleToggleBtn.textContent = "Close Schedule";
    loadSchedule();
    // Load blocking data when schedule is opened
    loadBlockedPatterns();
    loadYouTubeChannels();
    loadBlockedKeywords();
  } else {
    dashboardSchedule.style.display = "none";
    scheduleToggleBtn.textContent = "Edit Schedule";
  }
});

scheduleSaveBtn.addEventListener("click", () => {
  chrome.storage.local.set({ daySchedule: scheduleData }, () => {
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
      response.state === "OVERTIME"
    ) {
      viewSetup.classList.remove("active");
      viewProgress.classList.add("active");

      if (response.state === "PAUSED") {
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
    } else {
      viewProgress.classList.remove("active");
      viewSetup.classList.add("active");
      loadRecentOptions();
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

pauseBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "TOGGLE_PAUSE" }, checkTimerState);
});

endBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "END" }, checkTimerState);
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

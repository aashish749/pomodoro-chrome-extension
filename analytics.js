// ===== ANALYTICS ENGINE =====
// All chart instances stored for cleanup
let barChart = null;
let lineChart = null;
let compareChart = null;
let currentTrendDays = 7;

// Filter state
let hourFilterStart = 6; // Default 6AM (day start)
let hourFilterEnd = 5; // Default 5AM (next day)
let currentBarRange = "week"; // today, week, month, 90

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Hours ordered starting from 6AM (day start) to 5AM (next day)
const HOUR_ORDER = [];
for (let i = 6; i < 24; i++) HOUR_ORDER.push(i);
for (let i = 0; i < 6; i++) HOUR_ORDER.push(i);

const HOUR_LABELS = HOUR_ORDER.map((h) => {
  const ampm = h < 12 ? "AM" : "PM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}${ampm}`;
});

// Convert raw hour (0-23) to 12-hour AM/PM label (e.g., 21 -> "9PM", 2 -> "2AM")
function hourToLabel(h) {
  const ampm = h < 12 ? "AM" : "PM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}${ampm}`;
}

// Get date key matching background.js (6-hour offset)
function getDateKey(date) {
  const d = new Date(date);
  d.setHours(d.getHours() - 6);
  return d.toISOString().split("T")[0];
}

// Format YYYY-MM-DD from Date
function formatDateKey(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Get day of week (0=Sun) from date key
function getDayFromKey(dateKey) {
  return new Date(dateKey + "T06:00:00").getDay();
}

// Color scale helpers
function heatmapColor(value, max) {
  if (max === 0) return "#f5f5f5";
  const ratio = value / max;
  if (ratio === 0) return "#f5f5f5";
  if (ratio < 0.2) return "#fee5d9";
  if (ratio < 0.4) return "#fcae91";
  if (ratio < 0.6) return "#fb6a4a";
  if (ratio < 0.8) return "#de2d26";
  return "#a50f15";
}

function barColor(value, max) {
  if (max === 0) return "#ccc";
  const ratio = value / max;
  if (ratio < 0.2) return "#b81d18";
  if (ratio < 0.4) return "#c0392b";
  if (ratio < 0.6) return "#e67e22";
  if (ratio < 0.8) return "#27ae60";
  return "#1a7a5a";
}

// ===== DATA FETCHING =====
function loadAnalytics() {
  chrome.runtime.sendMessage({ type: "GET_HOURLY_ANALYTICS" }, (res) => {
    if (!res) {
      document.getElementById("loadingState").style.display = "none";
      document.getElementById("noDataState").style.display = "block";
      return;
    }

    const { hourlyHistory, workHistory } = res;
    const hasHourlyData = Object.keys(hourlyHistory).length > 0;
    const hasWorkData = Object.keys(workHistory).length > 0;

    if (!hasHourlyData && !hasWorkData) {
      document.getElementById("loadingState").style.display = "none";
      document.getElementById("noDataState").style.display = "block";
      return;
    }

    document.getElementById("loadingState").style.display = "none";
    document.getElementById("mainContent").style.display = "block";

    // Process data
    const processed = processHourlyData(hourlyHistory, workHistory);

    // Render everything
    renderSummaryCards(processed);
    renderBarChart(processed);
    renderHeatmap(processed);
    renderLineChart(processed, currentTrendDays);
    renderCompareChart(processed);
  });
}

// ===== DATA PROCESSING =====
function processHourlyData(hourlyHistory, workHistory) {
  // 1. Aggregate minutes per hour (all time)
  const hourlyTotals = new Array(24).fill(0);
  const hourlyCounts = new Array(24).fill(0);
  const hourlyByDayOfWeek = {}; // dayIdx -> { hour: total }
  for (let d = 0; d < 7; d++) {
    hourlyByDayOfWeek[d] = new Array(24).fill(0);
  }
  const dailyTotals = {}; // dateKey -> total minutes

  // Also aggregate from workHistory for daily totals
  if (workHistory) {
    for (const [dateKey, mins] of Object.entries(workHistory)) {
      dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + mins;
    }
  }

  // Check if an hour is within the sleep range (with wrap-around support)
  function isHourInRange(hour, start, end) {
    if (start <= end) {
      // Normal range: e.g. 7AM to 9PM -> include hours 7-21
      return hour >= start && hour <= end;
    } else {
      // Wrap-around range: e.g. 6AM to 5AM -> include 6-23 AND 0-5
      return hour >= start || hour <= end;
    }
  }

  // Get date keys for the selected time range
  function getDateKeysForBarRange(range) {
    const now = new Date();
    if (range === "today") return [getDateKey(now)];
    const keys = [];
    const days = range === "week" ? 7 : range === "month" ? 31 : 90;
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      keys.push(getDateKey(d));
    }
    return keys;
  }

  // Filter hourlyHistory to only selected time range
  const barDateKeys = getDateKeysForBarRange(currentBarRange);
  const filteredHourlyHistory = {};
  for (const key of barDateKeys) {
    if (hourlyHistory[key]) {
      filteredHourlyHistory[key] = hourlyHistory[key];
    }
  }

  // Process hourlyHistory (only hours within the sleep filter range)
  for (const [dateKey, hours] of Object.entries(filteredHourlyHistory)) {
    const dayIdx = getDayFromKey(dateKey);
    let dayTotal = 0;
    for (let h = 0; h < 24; h++) {
      // Skip hours outside the sleep filter range (with wrap-around support)
      if (!isHourInRange(h, hourFilterStart, hourFilterEnd)) continue;
      const mins = hours[h] || 0;
      if (mins > 0) {
        hourlyTotals[h] += mins;
        hourlyCounts[h]++;
        hourlyByDayOfWeek[dayIdx][h] += mins;
        dayTotal += mins;
      }
    }
    // Add to daily totals if not already there
    if (!dailyTotals[dateKey]) {
      dailyTotals[dateKey] = dayTotal;
    }
  }

  // Calculate averages
  const hourlyAverages = hourlyTotals.map((total, h) =>
    hourlyCounts[h] > 0 ? Math.round(total / hourlyCounts[h]) : 0,
  );

  // Find peak and weak hour
  let peakHour = -1,
    peakValue = 0;
  let weakHour = -1,
    weakValue = Infinity;
  for (let h = 0; h < 24; h++) {
    if (hourlyAverages[h] > peakValue) {
      peakValue = hourlyAverages[h];
      peakHour = h;
    }
    // Only consider hours that have data
    if (hourlyCounts[h] > 0 && hourlyAverages[h] < weakValue) {
      weakValue = hourlyAverages[h];
      weakHour = h;
    }
  }
  // If no data at all, weak hour is not set
  if (weakValue === Infinity) weakHour = -1;

  // Calculate average per day of week
  const dayOfWeekAvgs = [];
  for (let d = 0; d < 7; d++) {
    const total = hourlyByDayOfWeek[d].reduce((a, b) => a + b, 0);
    dayOfWeekAvgs.push(total);
  }

  // Find best day
  let bestDayIdx = 0;
  let bestDayValue = 0;
  for (let d = 0; d < 7; d++) {
    if (dayOfWeekAvgs[d] > bestDayValue) {
      bestDayValue = dayOfWeekAvgs[d];
      bestDayIdx = d;
    }
  }

  // Prepare daily trend data (sorted by date)
  const sortedDaily = Object.entries(dailyTotals)
    .filter(([key]) => {
      // Only include dates that make sense (within last year)
      const d = new Date(key + "T06:00:00");
      return !isNaN(d.getTime());
    })
    .sort(([a], [b]) => a.localeCompare(b));

  // Calculate week-over-week comparison
  const today = new Date();
  const thisWeekHours = new Array(24).fill(0);
  const lastWeekHours = new Array(24).fill(0);
  const thisWeekCount = new Array(24).fill(0);
  const lastWeekCount = new Array(24).fill(0);

  for (const [dateKey, hours] of Object.entries(hourlyHistory)) {
    const d = new Date(dateKey + "T06:00:00");
    if (isNaN(d.getTime())) continue;

    const now = new Date();
    const diffMs = now - d;
    const diffDays = diffMs / 86400000;

    if (diffDays >= 0 && diffDays <= 7) {
      // This week
      for (let h = 0; h < 24; h++) {
        const mins = hours[h] || 0;
        if (mins > 0) {
          thisWeekHours[h] += mins;
          thisWeekCount[h]++;
        }
      }
    } else if (diffDays > 7 && diffDays <= 14) {
      // Last week
      for (let h = 0; h < 24; h++) {
        const mins = hours[h] || 0;
        if (mins > 0) {
          lastWeekHours[h] += mins;
          lastWeekCount[h]++;
        }
      }
    }
  }

  const thisWeekAvg = thisWeekHours.map((t, h) =>
    thisWeekCount[h] > 0 ? Math.round(t / thisWeekCount[h]) : 0,
  );
  const lastWeekAvg = lastWeekHours.map((t, h) =>
    lastWeekCount[h] > 0 ? Math.round(t / lastWeekCount[h]) : 0,
  );

  return {
    hourlyAverages,
    hourlyTotals,
    hourlyCounts,
    hourlyByDayOfWeek,
    dailyTotals,
    sortedDaily,
    peakHour,
    peakValue,
    weakHour,
    weakValue,
    bestDayIdx,
    bestDayValue,
    dayOfWeekAvgs,
    thisWeekAvg,
    lastWeekAvg,
  };
}

// ===== UI RENDERING =====

function renderSummaryCards(data) {
  const { peakHour, peakValue, weakHour, weakValue, bestDayIdx, bestDayValue } =
    data;

  const peakEl = document.getElementById("peakHour");
  const peakSubEl = document.getElementById("peakHourSub");
  const weakEl = document.getElementById("weakHour");
  const weakSubEl = document.getElementById("weakHourSub");
  const bestDayEl = document.getElementById("bestDay");
  const bestDaySubEl = document.getElementById("bestDaySub");

  if (peakHour >= 0) {
    peakEl.textContent = hourToLabel(peakHour);
    peakSubEl.textContent = `avg ${peakValue} min`;
  } else {
    peakEl.textContent = "--";
    peakSubEl.textContent = "No data yet";
  }

  if (weakHour >= 0) {
    weakEl.textContent = hourToLabel(weakHour);
    weakSubEl.textContent = `avg ${weakValue} min`;
  } else {
    weakEl.textContent = "--";
    weakSubEl.textContent = "No data yet";
  }

  if (bestDayValue > 0) {
    bestDayEl.textContent = DAYS_SHORT[bestDayIdx];
    const hours = (bestDayValue / 60).toFixed(1);
    bestDaySubEl.textContent = `${hours}h total`;
  } else {
    bestDayEl.textContent = "--";
    bestDaySubEl.textContent = "No data yet";
  }
}

function isHourInRange(hour, start, end) {
  if (start <= end) {
    return hour >= start && hour <= end;
  } else {
    return hour >= start || hour <= end;
  }
}

// Reorder data array from 0-23 hour index to 6AM-first order
function reorderHours(dataArr) {
  return HOUR_ORDER.map((h) => dataArr[h]);
}

// Get the label for a specific hour (0-23) using the reordered labels
function getHourLabel(actualHour) {
  const idx = HOUR_ORDER.indexOf(actualHour);
  return idx >= 0 ? HOUR_LABELS[idx] : HOUR_LABELS[actualHour] || "";
}

function renderBarChart(data) {
  const ctx = document.getElementById("barChart").getContext("2d");
  const reordered = reorderHours(data.hourlyAverages);
  const maxVal = Math.max(...data.hourlyAverages, 1);
  const colors = reordered.map((v, idx) => {
    const h = HOUR_ORDER[idx];
    // Gray out hours outside the sleep filter range (wrap-around aware)
    if (!isHourInRange(h, hourFilterStart, hourFilterEnd)) {
      return "#e0e0e0";
    }
    return barColor(v, maxVal);
  });

  if (barChart) barChart.destroy();

  barChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: HOUR_LABELS,
      datasets: [
        {
          label: "Avg minutes",
          data: reordered,
          backgroundColor: colors,
          borderColor: colors.map(() => "rgba(0,0,0,0.1)"),
          borderWidth: 1,
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const h = HOUR_ORDER[ctx.dataIndex];
              if (!isHourInRange(h, hourFilterStart, hourFilterEnd)) {
                return `${ctx.raw} min avg (sleep hours)`;
              }
              return `${ctx.raw} min avg`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            font: { size: 10 },
            callback: (v) => `${v}m`,
          },
          grid: { color: "rgba(0,0,0,0.06)" },
        },
        x: {
          ticks: {
            font: { size: 9 },
            maxRotation: 45,
          },
          grid: { display: false },
        },
      },
    },
  });
}

function renderHeatmap(data) {
  const container = document.getElementById("heatmapContainer");
  const maxVal = Math.max(...Object.values(data.hourlyByDayOfWeek).flat(), 1);

  let html = '<table class="heatmap-table"><thead><tr><th></th>';
  for (let h = 0; h < 24; h++) {
    html += `<th>${HOUR_LABELS[h]}</th>`;
  }
  html += "</tr></thead><tbody>";

  for (let d = 0; d < 7; d++) {
    html += `<tr><td class="day-label">${DAYS_SHORT[d]}</td>`;
    // Use reordered hour order
    for (let h = 0; h < 24; h++) {
      const actualHour = HOUR_ORDER[h];
      const val = data.hourlyByDayOfWeek[d][actualHour];
      const color = heatmapColor(val, maxVal);
      const text = val > 0 ? `${val}m` : "";
      const textColor = val > maxVal * 0.5 ? "#fff" : "rgba(0,0,0,0.5)";
      html += `<td><div class="cell-content" style="background:${color};color:${textColor}">${text}</div></td>`;
    }
    html += "</tr>";
  }

  html += "</tbody></table>";
  container.innerHTML = html;
}

function renderLineChart(data, days) {
  const ctx = document.getElementById("lineChart").getContext("2d");

  // Filter sorted daily data to last N days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = getDateKey(cutoffDate);

  const filtered = data.sortedDaily.filter(([key]) => key >= cutoffStr);

  const labels = filtered.map(([key]) => {
    const d = new Date(key + "T06:00:00");
    const today = new Date();
    const todayStr = getDateKey(today);
    const yesterdayStr = getDateKey(new Date(Date.now() - 86400000));

    if (key === todayStr) return "Today";
    if (key === yesterdayStr) return "Yesterday";

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
    return `${months[d.getMonth()]} ${d.getDate()}`;
  });
  const values = filtered.map(([, v]) => Math.round((v / 60) * 10) / 10); // hours

  if (lineChart) lineChart.destroy();

  // Create gradient fill: green for higher values, red for lower values
  const gradient = ctx.createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, "rgba(39,174,96,0.3)"); // Green at top (higher values)
  gradient.addColorStop(0.5, "rgba(255,200,0,0.2)"); // Yellow in middle
  gradient.addColorStop(1, "rgba(232,67,247,0.1)"); // Pinkish-red at bottom (lower values)

  lineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Hours worked",
          data: values,
          borderColor: "#2ecc71",
          backgroundColor: gradient,
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: "#2ecc71",
          borderWidth: 2,
          // Add hour labels to data points
          datalabels: {
            display: true,
            align: "top",
            offset: 4,
            font: { size: 9 },
            color: "#555",
            formatter: (value) => (value ? `${value}h` : ""),
          },
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.raw}h`,
          },
        },
        datalabels: {
          display: false, // Hide by default, can be enabled if needed
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            font: { size: 10 },
            callback: (v) => `${v}h`,
          },
          grid: { color: "rgba(0,0,0,0.06)" },
        },
        x: {
          ticks: {
            font: { size: 9 },
            maxTicksLimit: 15,
            maxRotation: 45,
          },
          grid: { display: false },
        },
      },
    },
  });
}

function renderCompareChart(data) {
  const ctx = document.getElementById("compareChart").getContext("2d");
  const subtitle = document.getElementById("compareSubtitle");

  if (compareChart) compareChart.destroy();

  // Reorder data to 6AM-first order for consistent display
  const thisWeekReordered = reorderHours(data.thisWeekAvg);
  const lastWeekReordered = reorderHours(data.lastWeekAvg);

  // Fetch best data for comparison modes
  chrome.runtime.sendMessage({ type: "GET_BEST_DATA" }, (bestRes) => {
    const bestData = (bestRes && bestRes.bestData) || {};
    let datasets = [];
    let title = "";

    if (currentCompareMode === "this-last-week") {
      datasets = [
        {
          label: "This week (avg min)",
          data: thisWeekReordered,
          backgroundColor: "rgba(184,29,24,0.8)",
          borderRadius: 3,
        },
        {
          label: "Last week (avg min)",
          data: lastWeekReordered,
          backgroundColor: "rgba(230,126,34,0.6)",
          borderRadius: 3,
        },
      ];
      if (subtitle)
        subtitle.textContent = "Compare your hourly pattern week-over-week.";
    } else if (currentCompareMode === "this-last-month") {
      // Calculate this month and last month averages
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const thisMonthHours = new Array(24).fill(0);
      const thisMonthCount = new Array(24).fill(0);
      const lastMonthHours = new Array(24).fill(0);
      const lastMonthCount = new Array(24).fill(0);

      chrome.runtime.sendMessage({ type: "GET_HOURLY_ANALYTICS" }, (res) => {
        if (!res || !res.hourlyHistory) return;
        for (const [dateKey, hours] of Object.entries(res.hourlyHistory)) {
          const d = new Date(dateKey + "T06:00:00");
          if (isNaN(d.getTime())) continue;
          for (let h = 0; h < 24; h++) {
            const mins = hours[h] || 0;
            if (mins === 0) continue;
            if (d >= thisMonthStart && d <= now) {
              thisMonthHours[h] += mins;
              thisMonthCount[h]++;
            } else if (d >= lastMonthStart && d <= lastMonthEnd) {
              lastMonthHours[h] += mins;
              lastMonthCount[h]++;
            }
          }
        }
        const thisMonthAvg = thisMonthHours.map((t, h) =>
          thisMonthCount[h] > 0 ? Math.round(t / thisMonthCount[h]) : 0,
        );
        const lastMonthAvg = lastMonthHours.map((t, h) =>
          lastMonthCount[h] > 0 ? Math.round(t / lastMonthCount[h]) : 0,
        );

        // Reorder to 6AM-first order
        const thisMonthReordered = reorderHours(thisMonthAvg);
        const lastMonthReordered = reorderHours(lastMonthAvg);

        if (compareChart) compareChart.destroy();
        compareChart = new Chart(ctx, {
          type: "bar",
          data: {
            labels: HOUR_LABELS,
            datasets: [
              {
                label: "This month (avg min)",
                data: thisMonthReordered,
                backgroundColor: "rgba(184,29,24,0.8)",
                borderRadius: 3,
              },
              {
                label: "Last month (avg min)",
                data: lastMonthReordered,
                backgroundColor: "rgba(230,126,34,0.6)",
                borderRadius: 3,
              },
            ],
          },
          options: getCompareOptions(),
        });
      });
      if (subtitle) subtitle.textContent = "Compare this month vs last month.";
      return;
    } else if (currentCompareMode === "best-week") {
      const bestWeek = bestData.bestWeekHourly || new Array(24).fill(0);
      const bestWeekReordered = reorderHours(bestWeek);
      datasets = [
        {
          label: "This week (avg min)",
          data: thisWeekReordered,
          backgroundColor: "rgba(184,29,24,0.8)",
          borderRadius: 3,
        },
        {
          label: `Best week (${bestData.bestWeekLabel || "N/A"})`,
          data: bestWeekReordered,
          backgroundColor: "rgba(39,174,96,0.6)",
          borderRadius: 3,
        },
      ];
      if (subtitle)
        subtitle.textContent = `Best week: ${bestData.bestWeekLabel || "N/A"} (${Math.round((bestData.bestWeekTotal || 0) / 60)}h total)`;
    } else if (currentCompareMode === "best-month") {
      const bestMonth = bestData.bestMonthHourly || new Array(24).fill(0);
      const bestMonthReordered = reorderHours(bestMonth);
      datasets = [
        {
          label: "This month (avg min)",
          data: thisWeekReordered,
          backgroundColor: "rgba(184,29,24,0.8)",
          borderRadius: 3,
        },
        {
          label: `Best month (${bestData.bestMonthLabel || "N/A"})`,
          data: bestMonthReordered,
          backgroundColor: "rgba(39,174,96,0.6)",
          borderRadius: 3,
        },
      ];
      if (subtitle)
        subtitle.textContent = `Best month: ${bestData.bestMonthLabel || "N/A"} (${Math.round((bestData.bestMonthTotal || 0) / 60)}h total)`;
    }

    compareChart = new Chart(ctx, {
      type: "bar",
      data: { labels: HOUR_LABELS, datasets },
      options: getCompareOptions(),
    });
  });
}

function getCompareOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: { font: { size: 10 }, boxWidth: 12, padding: 8 },
      },
      tooltip: {
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} min` },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { font: { size: 10 }, callback: (v) => `${v}m` },
        grid: { color: "rgba(0,0,0,0.06)" },
      },
      x: {
        ticks: { font: { size: 9 }, maxRotation: 45 },
        grid: { display: false },
      },
    },
  };
}

// ===== TREND TOGGLE =====
function setupTrendToggle() {
  const buttons = document.querySelectorAll(".week-toggle button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentTrendDays = parseInt(btn.getAttribute("data-days"));

      // Re-fetch data and re-render line chart
      chrome.runtime.sendMessage({ type: "GET_HOURLY_ANALYTICS" }, (res) => {
        if (!res) return;
        const processed = processHourlyData(res.hourlyHistory, res.workHistory);
        renderLineChart(processed, currentTrendDays);
      });
    });
  });
}

// ===== COMPARISON MODE =====
let currentCompareMode = "this-last-week";

function setupCompareMode() {
  const select = document.getElementById("compareMode");
  if (!select) return;

  select.addEventListener("change", () => {
    currentCompareMode = select.value;
    // Re-fetch and re-render comparison chart
    chrome.runtime.sendMessage({ type: "GET_HOURLY_ANALYTICS" }, (res) => {
      if (!res) return;
      const processed = processHourlyData(res.hourlyHistory, res.workHistory);
      renderCompareChart(processed);
    });
  });
}

// ===== FILTER SETUP =====
function setupFilters() {
  const startSelect = document.getElementById("hourFilterStart");
  const endSelect = document.getElementById("hourFilterEnd");
  const resetBtn = document.getElementById("resetFilterBtn");

  if (!startSelect || !endSelect || !resetBtn) return;

  function applyFilter() {
    hourFilterStart = parseInt(startSelect.value);
    hourFilterEnd = parseInt(endSelect.value);
    // Re-fetch and re-render
    chrome.runtime.sendMessage({ type: "GET_HOURLY_ANALYTICS" }, (res) => {
      if (!res) return;
      const processed = processHourlyData(res.hourlyHistory, res.workHistory);
      renderBarChart(processed);
      renderHeatmap(processed);
    });
  }

  startSelect.addEventListener("change", applyFilter);
  endSelect.addEventListener("change", applyFilter);
  resetBtn.addEventListener("click", () => {
    startSelect.value = "6";
    endSelect.value = "5";
    applyFilter();
  });
}

// ===== TIME RANGE SETUP =====
function setupBarRange() {
  const chips = document.querySelectorAll(".filter-chip[data-range]");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentBarRange = chip.getAttribute("data-range");
      // Re-fetch and re-render bar chart & heatmap
      chrome.runtime.sendMessage({ type: "GET_HOURLY_ANALYTICS" }, (res) => {
        if (!res) return;
        const processed = processHourlyData(res.hourlyHistory, res.workHistory);
        renderBarChart(processed);
        renderHeatmap(processed);
      });
    });
  });
}

// ===== BADGE DISPLAY =====
function loadBadgeData() {
  chrome.runtime.sendMessage({ type: "GET_BADGE_DATA" }, (res) => {
    if (!res || !res.badgeData) return;
    const { monthly, lifetime } = res.badgeData;
    const badgeSection = document.getElementById("badgeSection");
    const badgeMonthly = document.getElementById("badgeMonthly");
    const badgeLifetime = document.getElementById("badgeLifetime");
    if (badgeSection && (monthly > 0 || lifetime > 0)) {
      badgeSection.style.display = "block";
      if (badgeMonthly) badgeMonthly.textContent = monthly || 0;
      if (badgeLifetime) badgeLifetime.textContent = lifetime || 0;
    }
  });
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  setupTrendToggle();
  setupCompareMode();
  setupFilters();
  setupBarRange();
  loadAnalytics();
  loadBadgeData();
});

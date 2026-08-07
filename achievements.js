// ===== SHARED ACHIEVEMENTS ENGINE =====
// This file is used by both popup.js and analytics.js
// The same rendering code powers achievements on both pages.

// ===== DATA LOADING =====
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

// ===== RENDER ALL HONOR CARDS =====
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

  // ===== BUILD SHOWCASE TROPHIES (top section) =====
  const showcaseContainer = document.getElementById("achievementShowcase");
  let showcaseHtml = "";

  // Decide which badges to showcase (the ones that are completed)
  const showcaseBadges = [];

  // Streak always shows
  showcaseBadges.push({
    src: chrome.runtime.getURL("streak (1).png"),
    alt: "Streak",
    label: `${currentStreak}d`,
    class: "showcase-item",
  });

  if (day1_30day_completed) {
    showcaseBadges.push({
      src: chrome.runtime.getURL("badges/10hours_at_leastfor30days.png"),
      alt: "Day 1 - 30 Days 10+ Hours",
      label: "10h×30d",
      class: "showcase-item",
    });
  }
  if (day1_30day_14hr_completed) {
    showcaseBadges.push({
      src: chrome.runtime.getURL("badges/14hoursdailyforamonth.png"),
      alt: "14 Hours Daily for a Month",
      label: "14h×30d",
      class: "showcase-item",
    });
  }
  if (thousand_hours_completed) {
    showcaseBadges.push({
      src: chrome.runtime.getURL("badges/godlmedal_for_1000hours.png"),
      alt: "1,000-Hour Club",
      label: "1,000h",
      class: "showcase-item",
    });
  }
  if (elon_musk_weekly_completed) {
    showcaseBadges.push({
      src: chrome.runtime.getURL(
        "badges/musk_badge_for_100hours_plus_perweek.png",
      ),
      alt: "100+ Hours per Week",
      label: "100h/wk",
      class: "showcase-item",
    });
  }
  if (bronze_16hr_count > 0) {
    showcaseBadges.push({
      src: chrome.runtime.getURL(
        "badges/bronze_medal_for_16hours_singledayshift.png",
      ),
      alt: "Bronze - 16 Hour Shift",
      label: `×${bronze_16hr_count}`,
      class: "showcase-item",
    });
  }
  if (six_hour_flow_count > 0) {
    showcaseBadges.push({
      src: chrome.runtime.getURL(
        "badges/complete 6 hours without single pause.png",
      ),
      alt: "Deep Flow",
      label: `×${six_hour_flow_count}`,
      class: "showcase-item",
    });
  }
  if (silver_3x16_count > 0) {
    showcaseBadges.push({
      src: chrome.runtime.getURL(
        "badges/silverfor_3consecutive_16hours_days.png",
      ),
      alt: "Wartime Execution",
      label: `×${silver_3x16_count}`,
      class: "showcase-item",
    });
  }

  // If no badges earned, show empty state
  if (showcaseBadges.length <= 1) {
    // Only streak is shown, no earned badges
    showcaseHtml =
      '<div class="showcase-empty">Complete challenges to earn trophies</div>';
  } else {
    showcaseHtml = '<div class="showcase-grid">';
    for (const badge of showcaseBadges) {
      showcaseHtml +=
        '<div class="' +
        badge.class +
        '" title="' +
        badge.alt +
        '">' +
        '<img src="' +
        badge.src +
        '" alt="' +
        badge.alt +
        '" class="showcase-icon" />' +
        '<span class="showcase-label">' +
        badge.label +
        "</span>" +
        "</div>";
    }
    showcaseHtml += "</div>";
  }

  if (showcaseContainer) {
    showcaseContainer.innerHTML = showcaseHtml;
    showcaseContainer.style.display = "block";
  }

  // ===== BUILD ALL HONOR CARDS =====
  const achievementsContainer = document.getElementById("achievementsList");
  if (!achievementsContainer) return;

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

  achievementsContainer.innerHTML = html;
}

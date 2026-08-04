// State management variables
let timerInterval = null;
let remainingTime = 0;
let totalDurationMins = 0;
let currentState = "IDLE"; // IDLE, RUNNING, PAUSED, OVERTIME
let isBreakSession = false;
let overtimeSeconds = 0; // Tracks extra time spent past break allocation

// Timestamp-based tracking variables
let endTime = 0;
let pauseTimeLeft = 0;

// Initialize badge formatting
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: "#b81d18" });
  updateBlockingRules();
});

// Returns date key with 6-hour offset (so sessions up to 6AM count toward previous day)
function getDateKey(date) {
  const d = new Date(date);
  d.setHours(d.getHours() - 6);
  return d.toISOString().split("T")[0];
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

function handleSessionCompletion() {
  clearIntervalEngine();

  chrome.tabs.create({ url: chrome.runtime.getURL("success.html") });

  if (isBreakSession) {
    overtimeSeconds = 0;
    startOvertimeEngine();
  } else {
    const sessionMinutes = totalDurationMins;

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
      });
    });
  }

  notifyStateChange();
}

function notifyStateChange() {
  chrome.runtime.sendMessage({ type: "STATE_CHANGED" }).catch(() => {});
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
          // URL changed — the content script will re-send CHECK_VIDEO_CHANNEL
          // Don't stop tracking, just update the URL
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
// New message: keywords are stored as array of strings with deleteClicks
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

// Main message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START") {
    totalDurationMins = message.minutes;
    remainingTime = totalDurationMins * 60;
    isBreakSession = message.isBreak || false;
    overtimeSeconds = 0;

    endTime = Date.now() + remainingTime * 1000;

    startTimerEngine();
    updateBadgeText(remainingTime);
    notifyStateChange();
    sendResponse({ success: true });
  } else if (message.type === "TOGGLE_PAUSE") {
    if (currentState === "RUNNING") {
      currentState = "PAUSED";
      pauseTimeLeft = endTime - Date.now();
      clearIntervalEngine();
      chrome.action.setBadgeBackgroundColor({ color: "#8e8e93" });
    } else if (currentState === "PAUSED") {
      currentState = "RUNNING";
      endTime = Date.now() + pauseTimeLeft;
      startTimerEngine();
    }
    saveStateToStorage();
    notifyStateChange();
    sendResponse({ success: true });
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
          chrome.storage.local.set({ workHistory: history });
        }
      }

      currentState = "IDLE";
      remainingTime = 0;
      totalDurationMins = 0;
      endTime = 0;
      pauseTimeLeft = 0;
      isBreakSession = false;
      overtimeSeconds = 0;

      chrome.action.setBadgeText({ text: "" });
      chrome.action.setBadgeBackgroundColor({ color: "#b81d18" });

      saveStateToStorage();
      notifyStateChange();
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

    chrome.action.setBadgeText({ text: "" });
    chrome.action.setBadgeBackgroundColor({ color: "#b81d18" });

    saveStateToStorage();
    notifyStateChange();
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
          });
          return;
        } else {
          remainingTime = Math.round((endTime - now) / 1000);
        }
      }

      sendResponse({
        state: currentState,
        remainingTime: remainingTime,
        totalDurationMins: totalDurationMins,
        isBreak: isBreakSession,
        overtimeSeconds: overtimeSeconds,
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
    // Called from content script (youtube-checker.js) when a video page loads
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
          // Start or continue tracking — don't stop previous tracking!
          // Only start if not already tracking this tab
          if (!youtubeActiveTabs[tabId]) {
            startYouTubeTimeTracking(tabId, matchedKey);
          } else {
            // Update the channel key if it changed
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
    // Called from content script when a video title or search query matches
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
        // Redirect to blocked page with keyword param (no bonus button)
        const params = `?keyword=${encodeURIComponent(matchedKeyword)}`;
        chrome.tabs.update(tabId, {
          url: chrome.runtime.getURL(`blocked.html${params}`),
        });
        sendResponse({ blocked: true, keyword: matchedKeyword });
      } else {
        // No keyword matched in the text, but send back keywords anyway for results hiding on search pages
        sendResponse({
          blocked: false,
          keywords: keywordStrs,
        });

        // If this is a search results page (URL contains /results), tell content script to hide matching results
        if (message.url && message.url.includes("/results")) {
          // Send keywords to the content script for hiding search results
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

  return true;
});

// Also rebuild rules when service worker starts
updateBlockingRules();

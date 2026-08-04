// Content script that runs on YouTube video pages
// Extracts the channel name from the DOM and checks with the background script

// Track the last channel we detected to avoid duplicate checks
let lastDetectedChannel = null;
let lastVideoTitle = null;

function extractChannelName() {
  // Method 1: #owner ytd-channel-name yt-formatted-string.ytd-channel-name a (owner section below video)
  const ownerLink = document.querySelector(
    "#owner ytd-channel-name yt-formatted-string.ytd-channel-name a",
  );
  if (ownerLink) {
    return {
      name: ownerLink.textContent.trim(),
      handle: null,
    };
  }

  // Method 2: Look for any channel link with @handle in href
  const atLink = document.querySelector('a[href^="/@"]');
  if (atLink) {
    const href = atLink.getAttribute("href");
    const handle = href.split("/")[1]; // @WarnerBros
    return {
      name: atLink.textContent.trim() || handle,
      handle: handle,
    };
  }

  // Method 3: ytd-video-owner-renderer (sometimes used in search/watch)
  const ownerRenderer = document.querySelector(
    "ytd-video-owner-renderer a.yt-simple-endpoint",
  );
  if (ownerRenderer) {
    return {
      name: ownerRenderer.textContent.trim(),
      handle: null,
    };
  }

  // Method 4: Look for channel links in watch page meta
  const metaChannel = document.querySelector('link[itemprop="name"]');
  if (metaChannel && metaChannel.getAttribute("content")) {
    return {
      name: metaChannel.getAttribute("content"),
      handle: null,
    };
  }

  return null;
}

function extractChannelHandle() {
  // Try to extract the @handle from channel links
  const channelLink = document.querySelector(
    "#owner ytd-channel-name yt-formatted-string.ytd-channel-name a",
  );
  if (channelLink) {
    const href = channelLink.getAttribute("href");
    if (href && href.startsWith("/@")) {
      return href.split("/")[1];
    }
  }

  // Fallback: look for any link with @handle
  const atLink = document.querySelector('a[href^="/@"]');
  if (atLink) {
    const href = atLink.getAttribute("href");
    return href.split("/")[1];
  }

  return null;
}

function extractVideoTitle() {
  // Method 1: h1 yt-formatted-string (modern YouTube)
  const titleEl = document.querySelector(
    "h1.ytd-watch-metadata yt-formatted-string, #title h1 yt-formatted-string, .ytd-video-primary-info-renderer yt-formatted-string",
  );
  if (titleEl) return titleEl.textContent.trim();

  // Method 2: #container h1 yt-formatted-string (older layout)
  const titleEl2 = document.querySelector(
    "#container h1 yt-formatted-string, .ytd-watch-metadata yt-formatted-string.style-scope",
  );
  if (titleEl2) return titleEl2.textContent.trim();

  // Method 3: From the <title> tag
  const pageTitle = document.title;
  if (pageTitle) {
    // YouTube page title format: "Video Title - YouTube"
    return pageTitle.replace(/ - YouTube$/, "").trim();
  }

  return null;
}

function extractSearchQuery() {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get("search_query");
  } catch {
    return null;
  }
}

function sendChannelToBackground() {
  try {
    const channelData = extractChannelName();
    const channelHandle = extractChannelHandle();
    const channelName = channelData ? channelData.name : null;
    const handle = channelHandle || (channelData ? channelData.handle : null);

    // Only proceed if we found something and it's different from last time
    const detectKey = handle || channelName || "unknown";
    if (detectKey === lastDetectedChannel) return;

    if (channelName || handle) {
      lastDetectedChannel = detectKey;
      chrome.runtime.sendMessage(
        {
          type: "CHECK_VIDEO_CHANNEL",
          channelName: channelName,
          channelHandle: handle ? "@" + handle.replace("@", "") : null,
          url: window.location.href,
        },
        () => {
          if (chrome.runtime.lastError) {
            // Extension context invalidated, ignore
          }
        },
      );
    }
  } catch (e) {
    // Silently fail if extension context is gone
  }
}

function sendKeywordsToBackground(text) {
  try {
    if (!text) return;

    const lowerText = text.toLowerCase().trim();
    if (lowerText === lastVideoTitle) return;
    lastVideoTitle = lowerText;

    chrome.runtime.sendMessage(
      {
        type: "CHECK_VIDEO_KEYWORDS",
        text: text,
        url: window.location.href,
      },
      () => {
        if (chrome.runtime.lastError) {
          // Extension context invalidated, ignore
        }
      },
    );
  } catch (e) {
    // Silently fail
  }
}

// Hide search result items whose titles contain a blocked keyword
function hideBlockedSearchResults(keywords) {
  if (!keywords || keywords.length === 0) return;

  const videoItems = document.querySelectorAll(
    "ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-rich-item-renderer",
  );

  videoItems.forEach((item) => {
    const titleElement = item.querySelector(
      "#video-title, yt-formatted-string#video-title, a#video-title",
    );
    if (!titleElement) return;
    const title = titleElement.textContent.trim().toLowerCase();

    for (const kw of keywords) {
      if (title.includes(kw)) {
        item.style.display = "none";
        break;
      }
    }
  });
}

// Main keyword check
function checkKeywords() {
  const url = window.location.href;
  const path = window.location.pathname;

  // Check if on search results page — extract query
  if (path.includes("/results")) {
    const searchQuery = extractSearchQuery();
    if (searchQuery) {
      sendKeywordsToBackground(searchQuery);
    }
  }

  // Check if on a watch page — extract video title
  if (path.includes("/watch")) {
    const title = extractVideoTitle();
    if (title) {
      sendKeywordsToBackground(title);
    }
  }
}

// Retry extraction with delays since YouTube loads dynamically
function tryExtractWithRetries(maxRetries = 8) {
  let attempts = 0;
  function attempt() {
    attempts++;
    const channelData = extractChannelName();
    const channelHandle = extractChannelHandle();
    if (channelData || channelHandle) {
      sendChannelToBackground();
      return;
    }
    if (attempts < maxRetries) {
      setTimeout(attempt, 1000);
    }
  }
  setTimeout(attempt, 500);
}

// Run on page load with retries
tryExtractWithRetries();

// Also check keywords on page load (with retries for video title)
setTimeout(checkKeywords, 1000);
setTimeout(checkKeywords, 2500);
setTimeout(checkKeywords, 4000);

// YouTube is a SPA, so re-check when navigating to a new video
let lastUrl = window.location.href;
function checkForUrlChange() {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    lastDetectedChannel = null;
    lastVideoTitle = null;
    tryExtractWithRetries();
    setTimeout(checkKeywords, 1000);
    setTimeout(checkKeywords, 2500);
  }
}

// Observe title changes as a proxy for page navigation
const titleEl = document.querySelector("title");
if (titleEl) {
  const observer = new MutationObserver(checkForUrlChange);
  observer.observe(titleEl, { childList: true, subtree: true });
}

// YouTube fires this custom event after SPA navigation
window.addEventListener("yt-navigate-finish", () => {
  setTimeout(() => {
    lastDetectedChannel = null;
    lastVideoTitle = null;
    tryExtractWithRetries();
    setTimeout(checkKeywords, 800);
    setTimeout(checkKeywords, 2000);
  }, 500);
});

// Listen for history changes as a fallback
window.addEventListener("popstate", () => {
  lastDetectedChannel = null;
  lastVideoTitle = null;
  setTimeout(() => tryExtractWithRetries(), 1000);
  setTimeout(checkKeywords, 1500);
});

// Listen for keyword blocking updates from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "HIDE_BLOCKED_RESULTS") {
    hideBlockedSearchResults(message.keywords);
  }
});

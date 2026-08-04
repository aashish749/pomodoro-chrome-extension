document.addEventListener("DOMContentLoaded", () => {
  const tomatoAvatars = [
    "ill_rested.jpg",
    "ill_gatsby.jpg",
    "ill_monopoly.jpg",
  ];
  const randomIndex = Math.floor(Math.random() * tomatoAvatars.length);
  const selectedAvatar = tomatoAvatars[randomIndex];

  if (document.getElementById("avatarDisplay")) {
    document.getElementById("avatarDisplay").src = selectedAvatar;
  }

  const sound = document.getElementById("alertSound");
  if (sound) {
    sound.play().catch((err) => console.log("Audio exception handled:", err));
  }

  if (typeof confetti === "function") {
    confetti({ particleCount: 180, spread: 90, origin: { y: 0.6 } });
  }

  const startBtn = document.getElementById("startBtn");
  const breakBtn = document.getElementById("breakBtn");
  const dropdownTrigger = document.getElementById("dropdownTrigger");
  const dropdownMenu = document.getElementById("dropdownMenu");
  const dropdownSearch = document.getElementById("dropdownSearch");
  const recentContainer = document.getElementById("recent-options-container");

  const selectionWrapper = document.getElementById("selection-wrapper");
  const breakTimerContainer = document.getElementById("break-timer-container");
  const breakTimerDisplay = document.getElementById("breakTimerDisplay");
  const statusMessage = document.getElementById("statusMessage");
  const headerTitle = document.getElementById("headerTitle");

  let currentDuration = 15; // Default 15 minutes selected
  let liveTimerInterval = null;
  let isCurrentlyOnBreak = false; // Tracks if we are in the rest countdown view

  function getLabelForMins(mins) {
    const m = parseFloat(mins);
    if (m === 60) return "1 hour";
    if (m === 120) return "2 hours";
    if (m === 180) return "3 hours";
    if (m === 240) return "4 hours";
    if (m === 360) return "6 hours";
    return `${mins} minutes`;
  }

  dropdownTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle("open");
  });

  document.addEventListener("click", () =>
    dropdownMenu.classList.remove("open"),
  );

  dropdownSearch.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    dropdownMenu.querySelectorAll(".dropdown-option").forEach((opt) => {
      opt.style.display = opt.textContent.toLowerCase().includes(query)
        ? "block"
        : "none";
    });
  });

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

  // Switches layout into active ticking rest session mode
  function startLiveBreakUI() {
    if (liveTimerInterval) clearInterval(liveTimerInterval);
    isCurrentlyOnBreak = true;

    selectionWrapper.style.display = "none";
    breakBtn.style.display = "none";
    breakTimerContainer.style.display = "block";

    headerTitle.textContent = "Enjoy Your Break!";
    headerTitle.style.color = "var(--break-blue)";
    statusMessage.textContent =
      "Relax your mind. The timer will notify you when rest ends.";
    startBtn.textContent = "Choose Work Time"; // Contextual option change

    function updateLiveClock() {
      chrome.runtime.sendMessage({ type: "GET_STATE" }, (res) => {
        if (!res || res.state !== "RUNNING") {
          clearInterval(liveTimerInterval);
          returnToSelectionUI();
          return;
        }
        const totalSecs = res.remainingTime || 0;
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;

        const pad = (n) => String(n).padStart(2, "0");
        breakTimerDisplay.textContent = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
      });
    }

    updateLiveClock();
    liveTimerInterval = setInterval(updateLiveClock, 1000);
  }

  // Brings back full configurations so user can select a custom time
  function returnToSelectionUI() {
    if (liveTimerInterval) clearInterval(liveTimerInterval);
    isCurrentlyOnBreak = false;

    breakTimerContainer.style.display = "none";
    selectionWrapper.style.display = "block";
    breakBtn.style.display = "block";

    headerTitle.textContent = "Session Complete!";
    headerTitle.style.color = "var(--primary-red)";
    statusMessage.textContent =
      "Great work keeping your focus absolute! Take a well-deserved breathing break before jumping back in.";
    startBtn.textContent = "Restart Timer";
  }

  // Handle Action Button Commands
  startBtn.addEventListener("click", () => {
    if (isCurrentlyOnBreak) {
      // User clicked 'Choose Work Time' while on a break -> stop rest and allow choice
      chrome.runtime.sendMessage({ type: "RESET" }, () => {
        returnToSelectionUI();
      });
    } else {
      // Normal flow: Start focus session
      triggerSession(false);
    }
  });

  breakBtn.addEventListener("click", () => triggerSession(true));

  function triggerSession(isBreak = false) {
    chrome.storage.local.get(["recentDurations"], (res) => {
      let list = res.recentDurations || [];
      list = list.filter((x) => x !== currentDuration);
      list.unshift(currentDuration);
      if (list.length > 3) list.pop();
      chrome.storage.local.set({ recentDurations: list }, () => {
        chrome.runtime.sendMessage(
          { type: "START", minutes: currentDuration, isBreak: isBreak },
          () => {
            if (isBreak) {
              startLiveBreakUI();
            } else {
              window.close();
            }
          },
        );
      });
    });
  }

  // Dynamically load layout state
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
});

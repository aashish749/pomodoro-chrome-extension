// Parse the URL query params
const params = new URLSearchParams(window.location.search);
const channelKey = params.get("channel");
const blockedKeyword = params.get("keyword");

const channelNameEl = document.getElementById("channelName");
const bonusBtn = document.getElementById("bonusBtn");
const bonusMsg = document.getElementById("bonusMsg");
const bonusUsedMsg = document.getElementById("bonusUsedMsg");

if (blockedKeyword) {
  // Keyword block — no bonus option, different message
  channelNameEl.textContent = `Keyword: "${blockedKeyword}"`;
  document.getElementById("blockMessage").textContent =
    "This keyword is blocked. Time to get back to work!";
  // Hide the bonus section entirely
  const bonusSection = document.querySelector(".bonus-section");
  if (bonusSection) bonusSection.style.display = "none";
} else if (channelKey) {
  channelNameEl.textContent = `Channel: ${channelKey}`;

  // Check if bonus was already used
  chrome.runtime.sendMessage({ type: "GET_YOUTUBE_CHANNELS" }, (res) => {
    const channels = res.channels || {};
    const data = channels[channelKey];
    if (data && data.bonusUsed) {
      bonusBtn.style.display = "none";
      bonusUsedMsg.textContent =
        "You've already used your +5 minute bonus today.";
    }
  });
} else {
  channelNameEl.textContent = "This site has been blocked.";
}

bonusBtn.addEventListener("click", () => {
  if (!channelKey) return;

  bonusBtn.disabled = true;
  bonusBtn.textContent = "Adding...";

  chrome.runtime.sendMessage(
    { type: "ADD_5_MINUTES_BONUS", channelKey },
    (res) => {
      if (res.success) {
        bonusMsg.className = "bonus-msg success";
        bonusMsg.textContent = `✅ Got it! You have ${res.newMax} minutes now. Going back to YouTube...`;
        bonusMsg.style.display = "block";

        // Navigate back to YouTube after 1.5 seconds
        setTimeout(() => {
          window.location.href = "https://youtube.com";
        }, 1500);
      } else {
        bonusMsg.className = "bonus-msg error";
        bonusMsg.textContent = "❌ " + res.reason;
        bonusMsg.style.display = "block";
        bonusBtn.disabled = false;
        bonusBtn.textContent = "Give me +5 minutes";
      }
    },
  );
});

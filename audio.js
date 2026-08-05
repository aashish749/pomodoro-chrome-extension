let currentAudio = null;

// Signal to the service worker that this offscreen document is ready
chrome.runtime.sendMessage({ type: "OFFSCREEN_READY" }).catch(() => {});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "PLAY_SOUND") {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    const fileToPlay =
      message.soundFile || chrome.runtime.getURL("completed.mp3");
    currentAudio = new Audio(fileToPlay);
    currentAudio
      .play()
      .catch((err) => console.error("Audio engine context exception:", err));
  } else if (message.type === "STOP_SOUND") {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
  }
});

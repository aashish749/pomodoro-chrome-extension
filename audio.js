// ===== BULLETPROOF AUDIO PLAYER =====
// This script runs in an offscreen document.
// The sound file to play is passed via URL query parameter: ?sound=timeisabout_to_up.mp3
// It auto-plays immediately on load, no message passing needed.
// If the "loop" param is present (e.g. ?sound=file.mp3&loop=1), it loops until stopped.

(function () {
  const params = new URLSearchParams(location.search);
  const soundFile = params.get("sound") || "timeisabout_to_up.mp3";
  const shouldLoop = params.has("loop");
  const fullUrl = chrome.runtime.getURL(soundFile);

  const audio = new Audio(fullUrl);
  audio.volume = 1.0;
  audio.loop = shouldLoop;

  audio.play().catch((err) => {
    console.error("Audio play failed:", err);
    // Close after a short delay even on failure
    setTimeout(() => window.close(), 1000);
  });

  // Listen for messages to stop/close the audio
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "STOP_SOUND") {
      audio.pause();
      audio.currentTime = 0;
      setTimeout(() => window.close(), 100);
    }
  });

  // If not looping, close after the sound finishes
  if (!shouldLoop) {
    audio.addEventListener("ended", () => {
      setTimeout(() => window.close(), 200);
    });
    // Fallback timeout in case duration is unknown
    setTimeout(() => {
      if (!audio.paused) {
        // Still playing, let it finish naturally
      } else {
        window.close();
      }
    }, 10000);
  }
  // If looping, the document stays open until chrome.offscreen.closeDocument() is called
  // or a STOP_SOUND message is received
})();

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "PLAY_SOUND") {
    const fileToPlay = message.soundFile || "completed.mp3";
    const audio = new Audio(fileToPlay);
    audio
      .play()
      .catch((err) => console.error("Audio engine context exception:", err));
  }
});

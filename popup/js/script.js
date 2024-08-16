document.getElementById("download").addEventListener("click", () => {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {
      minTime: document.getElementById("start").valueAsNumber,
      maxTime: document.getElementById("end").valueAsNumber,
    });
  });
});

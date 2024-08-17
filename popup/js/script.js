document.getElementById("download").addEventListener("click", () => {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {
      minTime: document.getElementById("start").valueAsNumber,
      maxTime: document.getElementById("end").valueAsNumber,
    });
  });
});

onload = () => {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
    if (!/^https:\/\/chat\.line\.biz.+$/gm.test(tabs[0].url)) {
      document.getElementById("menu").style.display = "none";
      document.getElementById("message").style.display = "block";
    }
  });
};

document.addEventListener("DOMContentLoaded", () => {
  const backButton = document.getElementById("backButton");
  const applyApiButton = document.getElementById("applyApiButton");
  const apiKeyInput = document.getElementById("apiKeyInput");

  chrome.storage.local.get(["apiKey"], (data) => {
    if (data.apiKey) {
      apiKeyInput.value = data.apiKey;
    }
  });

  applyApiButton.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    chrome.storage.local.set({ apiKey: key }, () => {
      chrome.tabs.reload();
    });
  });

  backButton.addEventListener("click", () => {
    window.location.href = "popup.html";
  });
});

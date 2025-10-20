document.addEventListener("DOMContentLoaded", async () => {
  const toggleButton = document.getElementById('toggleButton');
  const styleSelector = document.getElementById('styleSelector');
  const colorPicker = document.getElementById('colorPicker');
  const applyColorButton = document.getElementById('applyColorButton');
  const hoverViewCheckbox = document.getElementById('hoverViewCheckbox');
  const hoverEmoji = document.getElementById('hoverEmoji');
  const hoverViewWrapper = document.getElementById('hoverViewWrapper');

  let promptApiAvailable = true;
  if (!('LanguageModel' in self)) {
    promptApiAvailable = false;
  } else {
    try {
      const availability = await LanguageModel.availability();
      promptApiAvailable = availability !== 'unavailable';
    } catch (err) {
      console.warn("Error checking prompt API availability:", err);
      promptApiAvailable = false;
    }
  }

  chrome.storage.local.get(
    ['isTheExtensionOn', 'textStyleSelected', 'lightBarColor', 'hoverUnblur', 'fallbackActive'],
    (data) => {
      const isOn = data.isTheExtensionOn || false;
      const textStyle = data.textStyleSelected || 'as-is';
      const lightBarColor = data.lightBarColor || '#008000';
      const hoverUnblur = data.hoverUnblur !== undefined ? data.hoverUnblur : true;
      const fallbackActive = data.fallbackActive || false;

      updateButton(isOn);
      styleSelector.value = textStyle;
      colorPicker.value = lightBarColor;
      hoverViewCheckbox.checked = hoverUnblur;
      updateHoverEmoji(hoverUnblur);

      if (!promptApiAvailable) {
        chrome.storage.local.set({ fallbackActive: true });
        disableHoverViewSection();
      } else {
        chrome.storage.local.set({ fallbackActive: false });
        enableHoverViewSection();
      }
    }
  );

  toggleButton.addEventListener('click', () => {
    const isCurrentlyOn = toggleButton.classList.contains('toggle-on');
    const newState = !isCurrentlyOn;

    chrome.storage.local.set({ 'isTheExtensionOn': newState }, () => {
      updateButton(newState);
      chrome.tabs.reload();
    });
  });

  styleSelector.addEventListener('change', () => {
    const selectedStyle = styleSelector.value;
    chrome.storage.local.set({ 'textStyleSelected': selectedStyle }, () => {
      chrome.tabs.reload();
    });
  });

  applyColorButton.addEventListener('click', () => {
    const selectedColor = colorPicker.value;
    const hoverUnblur = hoverViewCheckbox.checked;

    chrome.storage.local.set({
      'lightBarColor': selectedColor,
      'hoverUnblur': hoverUnblur
    }, () => {
      chrome.tabs.reload();
    });
  });

  hoverViewCheckbox.addEventListener('change', () => {
    updateHoverEmoji(hoverViewCheckbox.checked);
  });

  const advancedButton = document.getElementById('advancedButton');
  advancedButton.addEventListener('click', () => {
    window.location.href = "advanced.html";
  });

  function updateHoverEmoji(isChecked) {
    hoverEmoji.textContent = isChecked ? "✓" : "✕";
  }

  function updateButton(isOn) {
    if (isOn) {
      toggleButton.classList.add('toggle-on');
      toggleButton.classList.remove('toggle-off');
      toggleButton.textContent = "ON";
    } else {
      toggleButton.classList.remove('toggle-on');
      toggleButton.classList.add('toggle-off');
      toggleButton.textContent = "OFF";
    }
  }

  function disableHoverViewSection() {
    const accessibilityBox = document.querySelector('.checkbox-row');

    let overlay = document.getElementById('imageBlurOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'imageBlurOverlay';
      overlay.textContent = "Image blurring disabled (Requires Prompt API)";
      overlay.style.position = 'absolute';
      overlay.style.top = 0;
      overlay.style.left = 0;
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.background = 'rgba(200, 200, 200, 1)';
      overlay.style.display = 'flex';
      overlay.style.justifyContent = 'center';
      overlay.style.alignItems = 'center';
      overlay.style.color = '#c42121ff';
      overlay.style.fontWeight = '200';
      overlay.style.fontSize = '10px';
      overlay.style.borderRadius = '5px';
      overlay.style.zIndex = '10';
      overlay.style.textAlign = 'center';
      overlay.style.padding = '10px';
      overlay.style.boxSizing = 'border-box';
    }

    accessibilityBox.style.position = 'relative';
    accessibilityBox.appendChild(overlay);

    hoverViewCheckbox.disabled = true;
    hoverViewWrapper.style.opacity = 1;
  }

  function enableHoverViewSection() {
    const overlay = document.getElementById('imageBlurOverlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }

    hoverViewCheckbox.disabled = false;
    hoverViewWrapper.style.opacity = 1;
  }
});

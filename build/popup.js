/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	// The require scope
/******/ 	var __webpack_require__ = {};
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
/*!**********************!*\
  !*** ./src/popup.js ***!
  \**********************/
__webpack_require__.r(__webpack_exports__);
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

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9wdXAuanMiLCJtYXBwaW5ncyI6Ijs7VUFBQTtVQUNBOzs7OztXQ0RBO1dBQ0E7V0FDQTtXQUNBLHVEQUF1RCxpQkFBaUI7V0FDeEU7V0FDQSxnREFBZ0QsYUFBYTtXQUM3RCxFOzs7Ozs7Ozs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLElBQUk7QUFDSjtBQUNBO0FBQ0E7QUFDQSxNQUFNO0FBQ047QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsbUNBQW1DLHNCQUFzQjtBQUN6RDtBQUNBLFFBQVE7QUFDUixtQ0FBbUMsdUJBQXVCO0FBQzFEO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQSwrQkFBK0IsOEJBQThCO0FBQzdEO0FBQ0E7QUFDQSxLQUFLO0FBQ0wsR0FBRzs7QUFFSDtBQUNBO0FBQ0EsK0JBQStCLG9DQUFvQztBQUNuRTtBQUNBLEtBQUs7QUFDTCxHQUFHOztBQUVIO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQSxLQUFLO0FBQ0wsR0FBRzs7QUFFSDtBQUNBO0FBQ0EsR0FBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQSxHQUFHOztBQUVIO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTTtBQUNOO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsQ0FBQyIsInNvdXJjZXMiOlsid2VicGFjazovL3JlbGF4ZWQtd2ViL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL3JlbGF4ZWQtd2ViL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vcmVsYXhlZC13ZWIvLi9zcmMvcG9wdXAuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gVGhlIHJlcXVpcmUgc2NvcGVcbnZhciBfX3dlYnBhY2tfcmVxdWlyZV9fID0ge307XG5cbiIsIi8vIGRlZmluZSBfX2VzTW9kdWxlIG9uIGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uciA9IChleHBvcnRzKSA9PiB7XG5cdGlmKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1N0cmluZ1RhZykge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBTeW1ib2wudG9TdHJpbmdUYWcsIHsgdmFsdWU6ICdNb2R1bGUnIH0pO1xuXHR9XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG59OyIsImRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsIGFzeW5jICgpID0+IHtcbiAgY29uc3QgdG9nZ2xlQnV0dG9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RvZ2dsZUJ1dHRvbicpO1xuICBjb25zdCBzdHlsZVNlbGVjdG9yID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N0eWxlU2VsZWN0b3InKTtcbiAgY29uc3QgY29sb3JQaWNrZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29sb3JQaWNrZXInKTtcbiAgY29uc3QgYXBwbHlDb2xvckJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhcHBseUNvbG9yQnV0dG9uJyk7XG4gIGNvbnN0IGhvdmVyVmlld0NoZWNrYm94ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hvdmVyVmlld0NoZWNrYm94Jyk7XG4gIGNvbnN0IGhvdmVyRW1vamkgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaG92ZXJFbW9qaScpO1xuICBjb25zdCBob3ZlclZpZXdXcmFwcGVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hvdmVyVmlld1dyYXBwZXInKTtcblxuICBsZXQgcHJvbXB0QXBpQXZhaWxhYmxlID0gdHJ1ZTtcbiAgaWYgKCEoJ0xhbmd1YWdlTW9kZWwnIGluIHNlbGYpKSB7XG4gICAgcHJvbXB0QXBpQXZhaWxhYmxlID0gZmFsc2U7XG4gIH0gZWxzZSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGF2YWlsYWJpbGl0eSA9IGF3YWl0IExhbmd1YWdlTW9kZWwuYXZhaWxhYmlsaXR5KCk7XG4gICAgICBwcm9tcHRBcGlBdmFpbGFibGUgPSBhdmFpbGFiaWxpdHkgIT09ICd1bmF2YWlsYWJsZSc7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLndhcm4oXCJFcnJvciBjaGVja2luZyBwcm9tcHQgQVBJIGF2YWlsYWJpbGl0eTpcIiwgZXJyKTtcbiAgICAgIHByb21wdEFwaUF2YWlsYWJsZSA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChcbiAgICBbJ2lzVGhlRXh0ZW5zaW9uT24nLCAndGV4dFN0eWxlU2VsZWN0ZWQnLCAnbGlnaHRCYXJDb2xvcicsICdob3ZlclVuYmx1cicsICdmYWxsYmFja0FjdGl2ZSddLFxuICAgIChkYXRhKSA9PiB7XG4gICAgICBjb25zdCBpc09uID0gZGF0YS5pc1RoZUV4dGVuc2lvbk9uIHx8IGZhbHNlO1xuICAgICAgY29uc3QgdGV4dFN0eWxlID0gZGF0YS50ZXh0U3R5bGVTZWxlY3RlZCB8fCAnYXMtaXMnO1xuICAgICAgY29uc3QgbGlnaHRCYXJDb2xvciA9IGRhdGEubGlnaHRCYXJDb2xvciB8fCAnIzAwODAwMCc7XG4gICAgICBjb25zdCBob3ZlclVuYmx1ciA9IGRhdGEuaG92ZXJVbmJsdXIgIT09IHVuZGVmaW5lZCA/IGRhdGEuaG92ZXJVbmJsdXIgOiB0cnVlO1xuICAgICAgY29uc3QgZmFsbGJhY2tBY3RpdmUgPSBkYXRhLmZhbGxiYWNrQWN0aXZlIHx8IGZhbHNlO1xuXG4gICAgICB1cGRhdGVCdXR0b24oaXNPbik7XG4gICAgICBzdHlsZVNlbGVjdG9yLnZhbHVlID0gdGV4dFN0eWxlO1xuICAgICAgY29sb3JQaWNrZXIudmFsdWUgPSBsaWdodEJhckNvbG9yO1xuICAgICAgaG92ZXJWaWV3Q2hlY2tib3guY2hlY2tlZCA9IGhvdmVyVW5ibHVyO1xuICAgICAgdXBkYXRlSG92ZXJFbW9qaShob3ZlclVuYmx1cik7XG5cbiAgICAgIGlmICghcHJvbXB0QXBpQXZhaWxhYmxlKSB7XG4gICAgICAgIGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7IGZhbGxiYWNrQWN0aXZlOiB0cnVlIH0pO1xuICAgICAgICBkaXNhYmxlSG92ZXJWaWV3U2VjdGlvbigpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2hyb21lLnN0b3JhZ2UubG9jYWwuc2V0KHsgZmFsbGJhY2tBY3RpdmU6IGZhbHNlIH0pO1xuICAgICAgICBlbmFibGVIb3ZlclZpZXdTZWN0aW9uKCk7XG4gICAgICB9XG4gICAgfVxuICApO1xuXG4gIHRvZ2dsZUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICBjb25zdCBpc0N1cnJlbnRseU9uID0gdG9nZ2xlQnV0dG9uLmNsYXNzTGlzdC5jb250YWlucygndG9nZ2xlLW9uJyk7XG4gICAgY29uc3QgbmV3U3RhdGUgPSAhaXNDdXJyZW50bHlPbjtcblxuICAgIGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7ICdpc1RoZUV4dGVuc2lvbk9uJzogbmV3U3RhdGUgfSwgKCkgPT4ge1xuICAgICAgdXBkYXRlQnV0dG9uKG5ld1N0YXRlKTtcbiAgICAgIGNocm9tZS50YWJzLnJlbG9hZCgpO1xuICAgIH0pO1xuICB9KTtcblxuICBzdHlsZVNlbGVjdG9yLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICBjb25zdCBzZWxlY3RlZFN0eWxlID0gc3R5bGVTZWxlY3Rvci52YWx1ZTtcbiAgICBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoeyAndGV4dFN0eWxlU2VsZWN0ZWQnOiBzZWxlY3RlZFN0eWxlIH0sICgpID0+IHtcbiAgICAgIGNocm9tZS50YWJzLnJlbG9hZCgpO1xuICAgIH0pO1xuICB9KTtcblxuICBhcHBseUNvbG9yQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgIGNvbnN0IHNlbGVjdGVkQ29sb3IgPSBjb2xvclBpY2tlci52YWx1ZTtcbiAgICBjb25zdCBob3ZlclVuYmx1ciA9IGhvdmVyVmlld0NoZWNrYm94LmNoZWNrZWQ7XG5cbiAgICBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoe1xuICAgICAgJ2xpZ2h0QmFyQ29sb3InOiBzZWxlY3RlZENvbG9yLFxuICAgICAgJ2hvdmVyVW5ibHVyJzogaG92ZXJVbmJsdXJcbiAgICB9LCAoKSA9PiB7XG4gICAgICBjaHJvbWUudGFicy5yZWxvYWQoKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgaG92ZXJWaWV3Q2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgIHVwZGF0ZUhvdmVyRW1vamkoaG92ZXJWaWV3Q2hlY2tib3guY2hlY2tlZCk7XG4gIH0pO1xuXG4gIGNvbnN0IGFkdmFuY2VkQnV0dG9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FkdmFuY2VkQnV0dG9uJyk7XG4gIGFkdmFuY2VkQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgIHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gXCJhZHZhbmNlZC5odG1sXCI7XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIHVwZGF0ZUhvdmVyRW1vamkoaXNDaGVja2VkKSB7XG4gICAgaG92ZXJFbW9qaS50ZXh0Q29udGVudCA9IGlzQ2hlY2tlZCA/IFwi4pyTXCIgOiBcIuKclVwiO1xuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlQnV0dG9uKGlzT24pIHtcbiAgICBpZiAoaXNPbikge1xuICAgICAgdG9nZ2xlQnV0dG9uLmNsYXNzTGlzdC5hZGQoJ3RvZ2dsZS1vbicpO1xuICAgICAgdG9nZ2xlQnV0dG9uLmNsYXNzTGlzdC5yZW1vdmUoJ3RvZ2dsZS1vZmYnKTtcbiAgICAgIHRvZ2dsZUJ1dHRvbi50ZXh0Q29udGVudCA9IFwiT05cIjtcbiAgICB9IGVsc2Uge1xuICAgICAgdG9nZ2xlQnV0dG9uLmNsYXNzTGlzdC5yZW1vdmUoJ3RvZ2dsZS1vbicpO1xuICAgICAgdG9nZ2xlQnV0dG9uLmNsYXNzTGlzdC5hZGQoJ3RvZ2dsZS1vZmYnKTtcbiAgICAgIHRvZ2dsZUJ1dHRvbi50ZXh0Q29udGVudCA9IFwiT0ZGXCI7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGlzYWJsZUhvdmVyVmlld1NlY3Rpb24oKSB7XG4gICAgY29uc3QgYWNjZXNzaWJpbGl0eUJveCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jaGVja2JveC1yb3cnKTtcblxuICAgIGxldCBvdmVybGF5ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ltYWdlQmx1ck92ZXJsYXknKTtcbiAgICBpZiAoIW92ZXJsYXkpIHtcbiAgICAgIG92ZXJsYXkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIG92ZXJsYXkuaWQgPSAnaW1hZ2VCbHVyT3ZlcmxheSc7XG4gICAgICBvdmVybGF5LnRleHRDb250ZW50ID0gXCJJbWFnZSBibHVycmluZyBkaXNhYmxlZCAoUmVxdWlyZXMgUHJvbXB0IEFQSSlcIjtcbiAgICAgIG92ZXJsYXkuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgICAgb3ZlcmxheS5zdHlsZS50b3AgPSAwO1xuICAgICAgb3ZlcmxheS5zdHlsZS5sZWZ0ID0gMDtcbiAgICAgIG92ZXJsYXkuc3R5bGUud2lkdGggPSAnMTAwJSc7XG4gICAgICBvdmVybGF5LnN0eWxlLmhlaWdodCA9ICcxMDAlJztcbiAgICAgIG92ZXJsYXkuc3R5bGUuYmFja2dyb3VuZCA9ICdyZ2JhKDIwMCwgMjAwLCAyMDAsIDEpJztcbiAgICAgIG92ZXJsYXkuc3R5bGUuZGlzcGxheSA9ICdmbGV4JztcbiAgICAgIG92ZXJsYXkuc3R5bGUuanVzdGlmeUNvbnRlbnQgPSAnY2VudGVyJztcbiAgICAgIG92ZXJsYXkuc3R5bGUuYWxpZ25JdGVtcyA9ICdjZW50ZXInO1xuICAgICAgb3ZlcmxheS5zdHlsZS5jb2xvciA9ICcjYzQyMTIxZmYnO1xuICAgICAgb3ZlcmxheS5zdHlsZS5mb250V2VpZ2h0ID0gJzIwMCc7XG4gICAgICBvdmVybGF5LnN0eWxlLmZvbnRTaXplID0gJzEwcHgnO1xuICAgICAgb3ZlcmxheS5zdHlsZS5ib3JkZXJSYWRpdXMgPSAnNXB4JztcbiAgICAgIG92ZXJsYXkuc3R5bGUuekluZGV4ID0gJzEwJztcbiAgICAgIG92ZXJsYXkuc3R5bGUudGV4dEFsaWduID0gJ2NlbnRlcic7XG4gICAgICBvdmVybGF5LnN0eWxlLnBhZGRpbmcgPSAnMTBweCc7XG4gICAgICBvdmVybGF5LnN0eWxlLmJveFNpemluZyA9ICdib3JkZXItYm94JztcbiAgICB9XG5cbiAgICBhY2Nlc3NpYmlsaXR5Qm94LnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcbiAgICBhY2Nlc3NpYmlsaXR5Qm94LmFwcGVuZENoaWxkKG92ZXJsYXkpO1xuXG4gICAgaG92ZXJWaWV3Q2hlY2tib3guZGlzYWJsZWQgPSB0cnVlO1xuICAgIGhvdmVyVmlld1dyYXBwZXIuc3R5bGUub3BhY2l0eSA9IDE7XG4gIH1cblxuICBmdW5jdGlvbiBlbmFibGVIb3ZlclZpZXdTZWN0aW9uKCkge1xuICAgIGNvbnN0IG92ZXJsYXkgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW1hZ2VCbHVyT3ZlcmxheScpO1xuICAgIGlmIChvdmVybGF5ICYmIG92ZXJsYXkucGFyZW50Tm9kZSkge1xuICAgICAgb3ZlcmxheS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG92ZXJsYXkpO1xuICAgIH1cblxuICAgIGhvdmVyVmlld0NoZWNrYm94LmRpc2FibGVkID0gZmFsc2U7XG4gICAgaG92ZXJWaWV3V3JhcHBlci5zdHlsZS5vcGFjaXR5ID0gMTtcbiAgfVxufSk7XG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=
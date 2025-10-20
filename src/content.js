import { BAD_WORDS } from './bad_words.js';
import { GoogleGenAI } from "@google/genai";

let geminiApiKey = null;
let geminiModel = null;

chrome.storage.local.get(["apiKey"], (result) => {
  if (result.apiKey) {
    geminiApiKey = result.apiKey;
    geminiModel = new GoogleGenAI({ apiKey: geminiApiKey }).models;
    console.log("✅ Gemini API key loaded.");
  } else {
    console.warn("⚠️ Gemini API key not found in storage.");
  }
});


const BAD_WORDS_SET = new Set(BAD_WORDS.map(w => w.toLowerCase()));
const rewriteCache = new Map();
const processedSentencesPerElement = new WeakMap();

let rewriter = null;
let lmSession = null;
let roundNumber = 1;
let isTextRoundInProgress = false;
let isImageRoundInProgress = false;
let isTheExtensionOn = false;
let globalRGB = null;

const TOXIC_SCORE_THRESHOLD = 0.7;

const BLURRED_CLASS = 'chrome-ext-blurred-image';
const CHECKED_CLASS = 'chrome-ext-checked-image';

const imageTextCache = new Map();

function splitIntoSentences(text) {
  const sentenceEndings = /([.!?])\s+/g;
  return text.split(sentenceEndings)
    .filter(Boolean)
    .map((sentence, index, array) => {
      if (index % 2 === 0) return sentence.trim() + (array[index + 1] || '').trim();
      return null;
    })
    .filter(Boolean);
}

function containsBadWord(text) {
  const words = text.toLowerCase().match(/\b\w+\b/g);
  if (!words) return false;
  return words.some(w => BAD_WORDS_SET.has(w));
}

function chunk(array, size) {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, i * size + size)
  );
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 255, b: 0 };
}

async function classifySentencesBatch(sentences) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: "classifyBatch", sentences }, (response) => {
      if (chrome.runtime.lastError || !response) resolve([]);
      else resolve(response);
    });
  });
}

async function classifyDetectedText(text) {
  if (!text || text.trim() === '') return { decision: 'no-text' };

  const cacheKey = text.trim();
  if (imageTextCache.has(cacheKey)) {
    return imageTextCache.get(cacheKey);
  }

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'classify', text }, (response) => {
      if (chrome.runtime.lastError || !response) {
        const res = { decision: 'error' };
        imageTextCache.set(cacheKey, res);
        return resolve(res);
      }

      try {
        let top = null;
        if (Array.isArray(response) && response.length > 0) top = response[0];
        else if (response && response[0]) top = response[0];

        if (!top) {
          const res = { decision: 'safe' };
          imageTextCache.set(cacheKey, res);
          return resolve(res);
        }

        const label = (top.label || '').toLowerCase();
        const score = typeof top.score === 'number' ? top.score : parseFloat(top.score || 0);
        const isToxic = label.includes('toxic') && score >= TOXIC_SCORE_THRESHOLD;

        const res = {
          decision: isToxic ? 'toxic' : 'safe',
          label,
          score
        };

        imageTextCache.set(cacheKey, res);
        resolve(res);
      } catch (err) {
        const res = { decision: 'error' };
        imageTextCache.set(cacheKey, res);
        resolve(res);
      }
    });
  });
}

async function initializeRewriter() {
  if (rewriter) return rewriter;

  if (!('Rewriter' in self)) {
    console.error('❌ Rewriter API not supported in this environment.');
    return null;
  }

  try {
    const availability = await Rewriter.availability();
    if (availability === 'unavailable') {
      console.error('❌ Rewriter API unavailable.');
      return null;
    }

    console.log('Initializing Rewriter...');

    rewriter = await Rewriter.create({
      sharedContext: 'ONLY rewriting toxic text to be nice/harmless. Only output rewrite, no intro.',
      tone: 'more-formal',
      format: 'plain-text',
      length: 'shorter',
      monitor(m) {
        m.addEventListener("downloadprogress", e => {
          try {
            console.log(`Rewriter download progress: ${Math.round((e.loaded / e.total) * 100)}%`);
          } catch (err) {
            console.log('Rewriter download progress event', e);
          }
        });
      }
    });

    console.log('Rewriter initialized.');
    return rewriter;
  } catch (err) {
    console.error("❌ Rewriter initialization failed:", err);
    return null;
  }
}

async function rewriteSentence(sentence) {
  sentence = sentence.trim();
  if (rewriteCache.has(sentence)) return rewriteCache.get(sentence);

  try {
    const rw = await initializeRewriter();
    if (rw) {
      const rewritten = await rw.rewrite(sentence, {
        context: "Rewrite so it's NOT toxic, ONLY be nicer."
      });

      if (rewritten.length > sentence.length * 3.5) {
        const secondTry = await rw.rewrite(sentence, {
          context: "ONLY SAY THE REWRITE NO INTRO OR LEAD-IN REMOVE TOXICNESS"
        });

        if (secondTry.length > sentence.length * 3.5) {
          rewriteCache.set(sentence, "REMOVED HARMFUL TEXT");
          return "REMOVED HARMFUL TEXT";
        } else {
          rewriteCache.set(sentence, secondTry);
          return secondTry;
        }
      }

      rewriteCache.set(sentence, rewritten);
      return rewritten;
    } else {
      throw new Error("Rewriter unavailable");
    }
  } catch (rewriterError) {
    console.warn("❌ Rewriter failed, falling back to Gemini:", rewriterError);

    if (!geminiModel || !geminiApiKey) {
      console.error("❌ Gemini model not available or API key missing.");
      rewriteCache.set(sentence, sentence);
      return sentence;
    }

    try {
      const response = await geminiModel.generateContent({
        model: "gemini-2.5-flash-lite",
        config: {
          systemInstruction: "You ONLY REWRITE text to be NOT toxic/offensive, and be nicer. You also rewrite text to be shorter. You include NO FORMATTING.",
        },
        contents: `Rewrite: ${sentence}`,
      });

      const rewritten = (response?.text || '').trim();

      if (!rewritten || rewritten.length > sentence.length * 3.5) {
        rewriteCache.set(sentence, "REMOVED HARMFUL TEXT");
        return "REMOVED HARMFUL TEXT";
      }

      rewriteCache.set(sentence, rewritten);
      console.log(`Gemini rewritten: "${sentence}" → "${rewritten}"`);
      return rewritten;
    } catch (geminiErr) {
      console.error("❌ Gemini rewrite failed:", geminiErr);
      rewriteCache.set(sentence, sentence);
      return sentence;
    }
  }
}



async function processElement(el) {
  if (el.querySelector('.rewritten-toxic-sentence')) return;

  const text = el.textContent.trim();
  if (!text) return;

  const sentences = splitIntoSentences(text);
  if (!processedSentencesPerElement.has(el)) {
    processedSentencesPerElement.set(el, new Set());
  }

  const processedSet = processedSentencesPerElement.get(el);
  const newSentences = sentences.filter(s => !processedSet.has(s));

  if (newSentences.length === 0) return;

  const toxicCandidates = newSentences.filter(containsBadWord);
  if (toxicCandidates.length === 0) {
    newSentences.forEach(s => {
      rewriteCache.set(s, s);
      processedSet.add(s);
    });
    return;
  }

  const results = await classifySentencesBatch(toxicCandidates);

  for (let i = 0; i < toxicCandidates.length; i++) {
    const sentence = toxicCandidates[i];
    const result = results[i];

    if (!result || !Array.isArray(result) || result.length === 0) {
      rewriteCache.set(sentence, sentence);
      processedSet.add(sentence);
      continue;
    }

    const top = result[0];
    const label = top.label.toLowerCase();
    const score = top.score;

    const isToxic = (label.includes("toxic") && score > TOXIC_SCORE_THRESHOLD);

    if (isToxic) {
      const rewritten = await rewriteSentence(sentence);
      if (rewritten && rewritten !== sentence) {
        await rewriteToxicText(el, sentence, rewritten);
        console.log(`Replaced in DOM: "${sentence}" → "${rewritten}"`);
      }
    } else {
      rewriteCache.set(sentence, sentence);
    }

    processedSet.add(sentence);
  }
}

async function rewriteToxicText(el, sentence, rewrittenSentence) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
  const textNodes = [];
  let fullText = "";

  while (walker.nextNode()) {
    const node = walker.currentNode;
    textNodes.push(node);
    fullText += node.nodeValue;
  }

  const index = fullText.indexOf(sentence);
  if (index === -1) return;

  let currentIndex = 0;
  let remaining = sentence.length;
  let started = false;
  const nodesToRemove = [];

  for (let i = 0; i < textNodes.length && remaining > 0; i++) {
    const node = textNodes[i];
    const nodeText = node.nodeValue;
    const nodeLength = nodeText.length;

    if (currentIndex + nodeLength < index) {
      currentIndex += nodeLength;
      continue;
    }

    const startInNode = Math.max(0, index - currentIndex);
    const endInNode = Math.min(nodeLength, startInNode + remaining);
    const before = nodeText.slice(0, startInNode);
    const after = nodeText.slice(endInNode);

    if (!started) {
      const span = document.createElement('span');
      span.style.color = `rgb(${globalRGB.r}, ${globalRGB.g}, ${globalRGB.b})`;
      span.classList.add('rewritten-toxic-sentence');
      span.textContent = rewrittenSentence;

      const fragment = document.createDocumentFragment();
      if (before) fragment.appendChild(document.createTextNode(before));
      fragment.appendChild(span);
      if (after) fragment.appendChild(document.createTextNode(after));

      node.parentNode.replaceChild(fragment, node);
      started = true;
    } else {
      nodesToRemove.push(node);
    }

    remaining -= (endInNode - startInNode);
    currentIndex += nodeLength;
  }

  for (const node of nodesToRemove) {
    if (node.parentNode) node.parentNode.removeChild(node);
  }
}

function hasNewUnprocessedSentences() {
  const elements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span');

  for (const el of elements) {
    if (el.querySelector('.rewritten-toxic-sentence')) continue;

    const text = el.textContent.trim();
    if (!text) continue;

    const sentences = splitIntoSentences(text);
    const processed = processedSentencesPerElement.get(el) || new Set();

    for (const s of sentences) {
      if (!processed.has(s)) return true;
    }
  }

  return false;
}

async function runTextRound() {
  createLightBar();
  isTextRoundInProgress = true;
  console.log(`🚀 Starting text round ${roundNumber}...`);

  const elements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span');
  const groups = chunk([...elements], 10);

  for (const group of groups) {
    await Promise.allSettled(group.map(processElement));
  }

  console.log(`✅ Finished text round ${roundNumber}...`);
  setTimeout(() => {
    removeLightBar();
  }, 500);

  roundNumber++;
  isTextRoundInProgress = false;
}

function createLightBar() {
  if (!document.getElementById('extension-light-bar')) {
    chrome.storage.local.get(['lightBarColor'], (data) => {
      const baseColor = data.lightBarColor || '#008000';
      const rgb = hexToRgb(baseColor);
      globalRGB = rgb;

      const lightBar = document.createElement('div');
      lightBar.id = 'extension-light-bar';
      lightBar.style.position = 'fixed';
      lightBar.style.top = '0';
      lightBar.style.left = '0';
      lightBar.style.width = '100%';
      lightBar.style.height = '50px';
      lightBar.style.zIndex = '9999';
      lightBar.style.pointerEvents = 'none';

      const startColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)`;
      const endColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`;

      lightBar.style.background = `linear-gradient(to bottom, ${startColor}, ${endColor})`;

      document.body.appendChild(lightBar);

      const style = document.createElement('style');
      style.id = 'extension-light-bar-style';
      style.innerHTML = `
        #extension-light-bar {
          animation: glow 1.5s infinite ease-in-out;
        }

        @keyframes glow {
          0% {
            background: linear-gradient(to bottom, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5), rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0));
          }
          50% {
            background: linear-gradient(to bottom, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7), rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0));
          }
          100% {
            background: linear-gradient(to bottom, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5), rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0));
          }
        }

        .rewritten-toxic-sentence {
          background: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.05);
          border-bottom: 1px dashed rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15);
          padding: 0 2px;
        }
      `;
      document.head.appendChild(style);
    });
  }
}

function removeLightBar() {
  const lightBar = document.getElementById('extension-light-bar');
  if (lightBar) {
    lightBar.remove();
  }
  const style = document.getElementById('extension-light-bar-style');
  if (style) style.remove();
}

function wrapImageIfNeeded(img) {
  if (!img || !img.parentElement) return img;

  if (img.parentElement.classList && img.parentElement.classList.contains('extension-image-wrapper')) {
    return img.parentElement;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'extension-image-wrapper';
  const computed = window.getComputedStyle(img);
  if (computed.display === 'block') wrapper.style.display = 'block';
  else wrapper.style.display = 'inline-block';

  img.parentNode.replaceChild(wrapper, img);
  wrapper.appendChild(img);
  return wrapper;
}

function createImageLightBarElement(rgb) {
  const bar = document.createElement('div');
  bar.className = 'extension-image-lightbar';
  const startColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)`;
  const endColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`;
  bar.style.background = `linear-gradient(to bottom, ${startColor}, ${endColor})`;
  bar.dataset.extensionCreatedAt = Date.now();
  return bar;
}

async function ensureImageLightBarFor(img) {
  if (!img) return null;

  let wrapper = img.parentElement;
  if (!wrapper || !wrapper.classList || !wrapper.classList.contains('extension-image-wrapper')) {
    wrapper = wrapImageIfNeeded(img);
  }

  let existing = wrapper.querySelector('.extension-image-lightbar');
  if (existing) return existing;

  let rgb = globalRGB;
  if (!rgb) {
    rgb = await new Promise((resolve) => {
      chrome.storage.local.get(['lightBarColor'], (data) => {
        const hex = data && data.lightBarColor ? data.lightBarColor : '#008000';
        resolve(hexToRgb(hex));
      });
    });
    globalRGB = rgb;
  }

  const bar = createImageLightBarElement(rgb);
  wrapper.insertBefore(bar, wrapper.firstChild);
  return bar;
}

function removeImageLightBar(img) {
  if (!img || !img.parentElement) return;
  const wrapper = img.parentElement;
  if (!wrapper.classList || !wrapper.classList.contains('extension-image-wrapper')) return;

  const bar = wrapper.querySelector('.extension-image-lightbar');
  if (bar) {
    bar.style.transition = 'opacity 220ms ease-in-out';
    bar.style.opacity = '0';
    setTimeout(() => {
      if (bar.parentElement) bar.remove();
    }, 240);
  }
}

function injectImageStyles() {
  if (document.getElementById('image-blur-styles')) return;

  const style = document.createElement('style');
  style.id = 'image-blur-styles';
  style.textContent = `
        .${BLURRED_CLASS} {
            filter: blur(8px);
            transition: filter 0.2s ease-in-out;
        }
        .${BLURRED_CLASS}:hover {
            filter: none;
        }
        .${CHECKED_CLASS} {
            /* no visual change */
        }

        .extension-image-wrapper {
            position: relative;
            display: inline-block;
            line-height: 0;
        }

        .extension-image-lightbar {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 34px;
            pointer-events: none;
            z-index: 9999;
            background: linear-gradient(to bottom, rgba(0,128,0,0.6), rgba(0,128,0,0));
            animation: extension-image-glow 1.5s infinite ease-in-out;
            border-top-left-radius: 6px;
            border-top-right-radius: 6px;
        }

        @keyframes extension-image-glow {
          0% {
            opacity: 0.85;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0.85;
          }
        }

        .extension-image-wrapper img {
            display: block;
            max-width: 100%;
            height: auto;
        }
    `;
  document.head.appendChild(style);
}

async function fetchImageAsBlob(src) {
  try {
    const response = await fetch(src);
    if (!response.ok) {
      console.warn(`Could not fetch image (CORS or other issue): ${src}`);
      return null;
    }
    return await response.blob();
  } catch (error) {
    console.error(`Error fetching image: ${src}`, error);
    return null;
  }
}

async function createImageSession() {
  if (!('LanguageModel' in self)) {
    console.error("Prompt API is not available in this browser.");
    return;
  }

  const availability = await LanguageModel.availability();
  if (availability === 'unavailable') {
    console.error("AI model is not available on this device.");
    return;
  }

  try {
    lmSession = await LanguageModel.create({
      expectedInputs: [{ type: "image" }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
      initialPrompts: [
        {
          role: "system",
          content: `You are a text extractor. For each image, extract any visible text. If no text is found, respond only with: NO TEXT.`
        }
      ]
    });
    console.log("AI image session created successfully.");
  } catch (error) {
    console.error("Failed to create AI image session:", error);
  }
}

async function processImageWithAI(img) {
  if (!img || !img.src) return;

  try {
    await ensureImageLightBarFor(img);
  } catch (err) {
    console.warn('Could not create image lightbar for', img, err);
  }

  if (img.classList.contains(BLURRED_CLASS) || img.classList.contains(CHECKED_CLASS)) {
    removeImageLightBar(img);
    return;
  }

  if (imageTextCache.has(img.src)) {
    const cached = imageTextCache.get(img.src);
    if (cached.decision === 'toxic') {
      img.classList.add(BLURRED_CLASS);
    } else {
      img.classList.add(CHECKED_CLASS);
    }
    removeImageLightBar(img);
    return;
  }

  if (lmSession && lmSession.inputQuota && lmSession.inputUsage !== undefined) {
    try {
      const usageRatio = lmSession.inputUsage / lmSession.inputQuota;
      if (usageRatio > 0.05) {
        console.log("Input quota exceeded 5%, destroying and creating a new image session.");
        try { await lmSession.destroy(); } catch (e) { /* ignore */ }
        lmSession = null;
        await createImageSession();
      }
    } catch (err) {
      console.warn("Could not read lmSession inputUsage/inputQuota:", err);
    }
  }

  try {
    const blob = await fetchImageAsBlob(img.src);
    if (!blob) {
      imageTextCache.set(img.src, { decision: 'no-text' });
      img.classList.add(CHECKED_CLASS);
      removeImageLightBar(img);
      return;
    }

    const file = new File([blob], "image.jpg", { type: blob.type });

    const prompt = [{
      role: 'user',
      content: [
        { type: 'text', value: `Extract any text from the image. If there is no text, respond only with the words "NO TEXT".` },
        { type: 'image', value: file }
      ]
    }];

    if (!lmSession) await createImageSession();
    if (!lmSession) {
      console.error("No image session available.");
      imageTextCache.set(img.src, { decision: 'error' });
      img.classList.add(CHECKED_CLASS);
      removeImageLightBar(img);
      return;
    }

    const resultRaw = await lmSession.prompt(prompt);
    const resultString = (typeof resultRaw === 'string') ? resultRaw.trim() : (resultRaw?.toString?.() || '').trim();
    const cleanResultUpper = resultString.toUpperCase();

    if (!resultString || cleanResultUpper === 'NO TEXT') {
      console.log("Result: NO TEXT for image", img.src);
      imageTextCache.set(img.src, { decision: 'no-text' });
      img.classList.add(CHECKED_CLASS);
      removeImageLightBar(img);
      return;
    }

    const detectedText = resultString;
    console.log("Detected Text (OCR):", detectedText);

    const classification = await classifyDetectedText(detectedText);

    if (classification.decision === 'toxic') {
      console.log(`Image text classified as TOXIC (label=${classification.label}, score=${classification.score}) — blurring image.`);
      img.classList.add(BLURRED_CLASS);
      imageTextCache.set(detectedText, classification);
      imageTextCache.set(img.src, classification);
    } else if (classification.decision === 'safe' || classification.decision === 'no-text') {
      console.log(`Image text classified as SAFE (${classification.label || 'none'}) — marking checked.`);
      img.classList.add(CHECKED_CLASS);
      imageTextCache.set(detectedText, classification);
      imageTextCache.set(img.src, classification);
    } else {
      console.warn("Classification error — marking as checked.");
      img.classList.add(CHECKED_CLASS);
      imageTextCache.set(img.src, { decision: 'error' });
    }

    try {
      if (lmSession && lmSession.inputUsage !== undefined && lmSession.inputQuota !== undefined) {
        console.log(`Image session usage: ${lmSession.inputUsage}/${lmSession.inputQuota}`);
      }
    } catch (err) { /* ignore */ }

    removeImageLightBar(img);

  } catch (error) {
    if (!(error instanceof DOMException && error.name === "InvalidStateError")) {
      console.error("Error processing image with AI:", img.src, error);
    }
    img.classList.add(CHECKED_CLASS);
    imageTextCache.set(img.src, { decision: 'error' });
    removeImageLightBar(img);
  }
}

function findUnprocessedImages() {
  return Array.from(document.querySelectorAll(`img:not(.${BLURRED_CLASS}):not(.${CHECKED_CLASS})`));
}

async function processImageGroup(group) {
  await Promise.allSettled(group.map(processImageWithAI));
}

async function runImageRound() {
  injectImageStyles();
  isImageRoundInProgress = true;
  console.log('🔎 Starting image round...');

  const images = findUnprocessedImages();
  if (images.length === 0) {
    isImageRoundInProgress = false;
    console.log('No new images this round.');
    return;
  }

  const groups = chunk(images, 5);
  for (const g of groups) {
    await processImageGroup(g);
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('✅ Finished image round.');
  isImageRoundInProgress = false;
}

chrome.storage.local.get('isTheExtensionOn', (result) => {
  isTheExtensionOn = result.isTheExtensionOn;
  console.log("Initial isTheExtensionOn:", isTheExtensionOn);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.isTheExtensionOn) {
    isTheExtensionOn = changes.isTheExtensionOn.newValue;
    console.log("isTheExtensionOn changed:", isTheExtensionOn);
  }
});

(async () => {
  if (isTheExtensionOn) {
    try { await runTextRound(); } catch (err) { console.error('Error starting initial text round', err); }
    try { await runImageRound(); } catch (err) { console.error('Error starting initial image round', err); }
  }

  setInterval(async () => {
    if (!isTheExtensionOn) return;
    if (isTextRoundInProgress) return;

    const foundNew = hasNewUnprocessedSentences();
    if (foundNew) {
      console.log('New unprocessed text detected. Starting text round...');
      await runTextRound();
    }
  }, 1000);

  setInterval(async () => {
    if (!isTheExtensionOn) return;
    if (isImageRoundInProgress) return;

    const newImages = findUnprocessedImages();
    if (newImages.length > 0) {
      console.log('New unprocessed images detected. Starting image round...');
      await runImageRound();
    }
  }, 1000);
})();
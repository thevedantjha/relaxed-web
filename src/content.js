import { BAD_WORDS } from './bad_words.js';
import { GoogleGenAI } from "@google/genai";

const BAD_WORDS_SET = new Set(BAD_WORDS.map(w => w.toLowerCase()));
const rewriteCache = new Map();
const processedSentencesPerElement = new WeakMap();

let rewriter = null;
let lmSession = null;
let isUsingGeminiFallback = false;
let geminiClient = null;
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

async function initializeGeminiFallback() {
  if (isUsingGeminiFallback) return;
  isUsingGeminiFallback = true;

  chrome.storage.local.set({ fallbackActive: true });

  lmSession = null;

  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey || apiKey.trim() === '') {
    console.error('❌ Gemini fallback requires an API key. Please set one in advanced settings.');
    return;
  }

  try {
    geminiClient = new GoogleGenAI({ apiKey });
    console.log('✅ Gemini fallback initialized.');
  } catch (err) {
    console.error('❌ Failed to initialize Gemini fallback:', err);
  }
}

async function initializeRewriter() {
  if (rewriter || isUsingGeminiFallback) return rewriter;

  if (!('Rewriter' in self)) {
    console.warn('⚠️ Chrome Rewriter API not supported. Falling back to Gemini...');
    await initializeGeminiFallback();
    return null;
  }

  try {
    const availability = await Rewriter.availability();
    if (availability === 'unavailable') {
      console.warn('⚠️ Chrome Rewriter API unavailable. Falling back to Gemini...');
      await initializeGeminiFallback();
      return null;
    }

    console.log('Initializing Chrome Rewriter...');
    rewriter = await Rewriter.create({
      sharedContext: 'ONLY rewrite toxic text to be kind, short, and plain text.',
      tone: 'more-formal',
      format: 'plain-text',
      length: 'shorter'
    });
    console.log('✅ Chrome Rewriter initialized.');

    chrome.storage.local.set({ fallbackActive: false });

    return rewriter;
  } catch (err) {
    console.error('❌ Rewriter initialization failed. Falling back to Gemini...', err);
    await initializeGeminiFallback();
    return null;
  }
}

async function rewriteSentence(sentence) {
  sentence = sentence.trim();
  if (rewriteCache.has(sentence)) return rewriteCache.get(sentence);

  if (isUsingGeminiFallback && geminiClient) {
    try {
      const response = await geminiClient.models.generateContent({
        model: "gemini-2.5-flash-lite",
        config: {
          systemInstruction:
            "You ONLY REWRITE text to be NOT toxic/offensive, and be nicer. You also rewrite text to be shorter. Include NO FORMATTING.",
        },
        contents: sentence,
      });

      const rewritten = response.text?.trim() || sentence;
      rewriteCache.set(sentence, rewritten);
      return rewritten;
    } catch (err) {
      console.error("Gemini rewrite failed:", err);
      rewriteCache.set(sentence, sentence);
      return sentence;
    }
  }

  try {
    const rw = await initializeRewriter();
    if (!rw && !isUsingGeminiFallback) {
      rewriteCache.set(sentence, sentence);
      return sentence;
    }

    if (isUsingGeminiFallback && geminiClient) {
      return await rewriteSentence(sentence);
    }

    const rewritten = await rw.rewrite(sentence, {
      context: "Rewrite so it's NOT toxic, ONLY be nicer."
    });

    rewriteCache.set(sentence, rewritten);
    return rewritten;
  } catch (err) {
    console.error("❌ Rewrite failed:", err);
    rewriteCache.set(sentence, sentence);
    return sentence;
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
  setTimeout(() => removeLightBar(), 500);

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
    });
  }
}

function removeLightBar() {
  const bar = document.getElementById('extension-light-bar');
  if (bar) bar.remove();
}

async function createImageSession() {
  if (isUsingGeminiFallback) {
    console.log("🧩 Gemini fallback active — skipping image AI processing.");
    return;
  }
  if (!('LanguageModel' in self)) return;
  const availability = await LanguageModel.availability();
  if (availability === 'unavailable') return;

  try {
    lmSession = await LanguageModel.create({
      expectedInputs: [{ type: "image" }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
      initialPrompts: [
        {
          role: "system",
          content: "Extract visible text. If none, respond 'NO TEXT'."
        }
      ]
    });
    console.log("AI image session created.");
  } catch (err) {
    console.error("Failed to create AI image session:", err);
  }
}

async function runImageRound() {
  if (isUsingGeminiFallback) {
    console.log("🧩 Gemini fallback active — skipping image round.");
    return;
  }
  isImageRoundInProgress = true;
  console.log('🔎 Starting image round...');
  isImageRoundInProgress = false;
}

chrome.storage.local.get('isTheExtensionOn', (result) => {
  isTheExtensionOn = result.isTheExtensionOn;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.isTheExtensionOn) {
    isTheExtensionOn = changes.isTheExtensionOn.newValue;
  }
});

(async () => {
  if (isTheExtensionOn) {
    try { await runTextRound(); } catch (err) { console.error(err); }
    try { await runImageRound(); } catch (err) { console.error(err); }
  }

  setInterval(async () => {
    if (!isTheExtensionOn || isTextRoundInProgress) return;
    if (hasNewUnprocessedSentences()) await runTextRound();
  }, 1000);
})();
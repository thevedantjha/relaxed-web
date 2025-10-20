import { pipeline } from '@huggingface/transformers';


let modelsPreloaded = false;

class PipelineSingleton {
  static task = 'text-classification';
  static model = 'Xenova/toxic-bert';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance) return this.instance;

    console.log("⏳ Loading Hugging Face model...");
    try {
      this.instance = await pipeline(this.task, this.model, {
        progress_callback
      });
      console.log("✅ Hugging Face model loaded");
    } catch (err) {
      console.warn("Failed to load Hugging Face model:", err);
      this.instance = null;
    }

    return this.instance;
  }
}

async function preloadModels() {
  if (modelsPreloaded) {
    console.log("⚠️ Models already preloaded, skipping.");
    return;
  }

  modelsPreloaded = true;
  console.log("🚀 Preloading models...");
  await PipelineSingleton.getInstance();

}

chrome.runtime.onStartup.addListener(() => {
  preloadModels();
});

chrome.runtime.onInstalled.addListener(() => {
  preloadModels();
});

async function classify(text) {
  const model = await PipelineSingleton.getInstance();
  if (!model) return null;
  return await model(text);
}

async function classifyBatch(sentences) {
  const model = await PipelineSingleton.getInstance();
  if (!model) return [];
  return await Promise.all(sentences.map(sentence => model(sentence)));
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'classify') {
    (async () => {
      try {
        const result = await classify(message.text);
        sendResponse(result);
      } catch (err) {
        console.error("❌ classify error:", err);
        sendResponse(null);
      }
    })();
    return true;
  }

  if (message.action === 'classifyBatch') {
    (async () => {
      try {
        const results = await classifyBatch(message.sentences);
        sendResponse(results);
      } catch (err) {
        console.error("❌ classifyBatch error:", err);
        sendResponse([]);
      }
    })();
    return true;
  }

});

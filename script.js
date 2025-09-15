import { GoogleGenAI } from '@google/genai';

// --- Gemini Service ---
class GeminiService {
  ai = null;

  initialize(apiKey) {
    if (!apiKey) {
      console.error("API Key is required for initialization.");
      return false;
    }
    try {
      this.ai = new GoogleGenAI({ apiKey });
      return true;
    } catch (e) {
      console.error("Failed to initialize GoogleGenAI:", e);
      this.ai = null;
      return false;
    }
  }

  async generateContent(prompt, temperature, thinkingBudget) {
    if (!this.ai) {
      throw new Error('Gemini Service has not been initialized. Please provide an API Key.');
    }
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature,
          ...(thinkingBudget !== undefined && { thinkingConfig: { thinkingBudget } })
        }
      });
      return response.text.trim();
    } catch (error) {
       console.error('Error calling Gemini API:', error);
       if (error.toString().includes('API key not valid')) {
         throw new Error('مفتاح API غير صالح. يرجى التحقق منه.');
       }
       throw new Error('فشل الاتصال بخدمة Gemini.');
    }
  }

  async verifyApiKey() {
    await this.generateContent('hi', 0, 0);
  }

  async translateText(text, sourceLangName, targetLangName) {
    const prompt = `You are a professional translator. Translate the following text from "${sourceLangName}" to "${targetLangName}". Provide only the translated text, without any additional explanations, introductions, or quotation marks.
    
Text to translate:
"${text}"`;
    return this.generateContent(prompt, 0.3, 0);
  }

  async spellCheckText(text, sourceLangName) {
    const prompt = `You are a meticulous spell and grammar checker. Correct any spelling mistakes and grammatical errors in the following text, which is in "${sourceLangName}". Respond ONLY with the corrected text. Do not add any introductions, explanations, or quotation marks. If the text is already perfect, return it as is.

Text to correct:
"${text}"`;
    return this.generateContent(prompt, 0, 0);
  }
}

// --- Application State ---
const state = {
  geminiService: new GeminiService(),
  apiKeySet: false,
  languages: [
    { code: 'en', name: 'الإنجليزية' },
    { code: 'ar', name: 'العربية (فصحى)' },
    { code: 'ar-IQ', name: 'العربية (لهجة عراقية)' },
    { code: 'ku-sorani', name: 'الكردية (سوراني)' },
    { code: 'ku-badini', name: 'الكردية (باديني)' },
    { code: 'ku-kurmanji', name: 'الكردية (كرمانجي)' },
    { code: 'fr', name: 'الفرنسية' },
    { code: 'es', name: 'الإسبانية' },
    { code: 'de', name: 'الألمانية' },
    { code: 'tr', name: 'التركية' },
  ],
  sourceLang: 'en',
  targetLang: 'ar-IQ',
  sourceText: '',
  translatedText: '',
  isLoading: false,
  isCheckingSpelling: false,
  isCopied: false,
  history: [],
  isHistoryVisible: false,
};

// --- DOM Elements ---
const dom = {
  apiKeyView: document.getElementById('api-key-view'),
  appView: document.getElementById('app-view'),
  apiKeyForm: document.getElementById('api-key-form'),
  apiKeyInput: document.getElementById('api-key-input'),
  apiKeyError: document.getElementById('api-key-error'),
  sourceLangSelect: document.getElementById('source-lang'),
  targetLangSelect: document.getElementById('target-lang'),
  swapLanguagesBtn: document.getElementById('swap-languages-btn'),
  sourceTextarea: document.getElementById('source-text'),
  sourceTextCounter: document.getElementById('source-text-counter'),
  translatedTextP: document.getElementById('translated-text'),
  translationPlaceholder: document.getElementById('translation-placeholder'),
  copyBtn: document.getElementById('copy-btn'),
  copyContainer: document.getElementById('copy-container'),
  copySuccessMsg: document.getElementById('copy-success-msg'),
  copyIcon: document.getElementById('copy-icon'),
  copiedIcon: document.getElementById('copied-icon'),
  loadingSpinner: document.getElementById('loading-spinner'),
  translateBtn: document.getElementById('translate-btn'),
  translateBtnContent: document.getElementById('translate-btn-content'),
  translateBtnLoading: document.getElementById('translate-btn-loading'),
  spellCheckBtn: document.getElementById('spell-check-btn'),
  spellCheckBtnContent: document.getElementById('spell-check-btn-content'),
  spellCheckBtnLoading: document.getElementById('spell-check-btn-loading'),
  spellCheckSuccessMsg: document.getElementById('spell-check-success-msg'),
  errorMsg: document.getElementById('error-msg'),
  toggleHistoryBtn: document.getElementById('toggle-history-btn'),
  showHistoryContent: document.getElementById('show-history-content'),
  hideHistoryContent: document.getElementById('hide-history-content'),
  historySection: document.getElementById('history-section'),
  historyListContainer: document.getElementById('history-list-container'),
  historyEmptyMsg: document.getElementById('history-empty-msg'),
  clearHistoryBtn: document.getElementById('clear-history-btn'),
};

// --- Render Functions ---
function render() {
  // Views
  dom.apiKeyView.classList.toggle('hidden', state.apiKeySet);
  dom.appView.classList.toggle('hidden', !state.apiKeySet);

  // Language selectors
  dom.sourceLangSelect.value = state.sourceLang;
  dom.targetLangSelect.value = state.targetLang;

  // Text areas
  if (dom.sourceTextarea.value !== state.sourceText) {
      dom.sourceTextarea.value = state.sourceText;
  }
  dom.sourceTextCounter.textContent = `${state.sourceText.length} / 5000`;
  dom.translatedTextP.textContent = state.translatedText;

  // Visibility based on translation state
  dom.loadingSpinner.classList.toggle('hidden', !state.isLoading);
  dom.translationPlaceholder.classList.toggle('hidden', state.isLoading || !!state.translatedText);
  dom.copyContainer.classList.toggle('hidden', !state.translatedText);

  // Buttons state
  dom.translateBtn.disabled = state.isLoading || !state.sourceText.trim();
  dom.translateBtnContent.classList.toggle('hidden', state.isLoading);
  dom.translateBtnLoading.classList.toggle('hidden', !state.isLoading);

  dom.spellCheckBtn.disabled = state.isCheckingSpelling || !state.sourceText.trim();
  dom.spellCheckBtnContent.classList.toggle('hidden', state.isCheckingSpelling);
  dom.spellCheckBtnLoading.classList.toggle('hidden', !state.isCheckingSpelling);
  
  // Copy button state
  dom.copyBtn.disabled = state.isCopied;
  dom.copySuccessMsg.classList.toggle('hidden', !state.isCopied);
  dom.copyIcon.classList.toggle('hidden', state.isCopied);
  dom.copiedIcon.classList.toggle('hidden', !state.isCopied);

  // History section
  dom.historySection.classList.toggle('hidden', !state.isHistoryVisible);
  dom.showHistoryContent.classList.toggle('hidden', state.isHistoryVisible);
  dom.hideHistoryContent.classList.toggle('hidden', !state.isHistoryVisible);
  renderHistory();
}

function renderHistory() {
    dom.historyListContainer.innerHTML = '';
    const hasHistory = state.history.length > 0;
    dom.historyEmptyMsg.classList.toggle('hidden', hasHistory);
    dom.clearHistoryBtn.classList.toggle('hidden', !hasHistory);

    state.history.forEach(item => {
        const article = document.createElement('article');
        article.className = 'bg-slate-800/50 p-4 rounded-lg border border-slate-700 hover:border-cyan-700 transition-all group';
        article.innerHTML = `
            <header class="flex justify-between items-start text-sm text-slate-400 mb-3">
              <div class="font-medium">
                <span>${item.sourceLangName}</span>
                <span class="mx-1">&rarr;</span>
                <span>${item.targetLangName}</span>
              </div>
              <span class="text-xs">${new Date(item.timestamp).toLocaleString('ar-IQ')}</span>
            </header>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4">
              <p class="font-semibold text-slate-200 mb-2 md:mb-0 line-clamp-3 break-words">${item.sourceText}</p>
              <p class="text-cyan-300 line-clamp-3 break-words">${item.translatedText}</p>
            </div>
            <footer class="flex justify-end gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button data-timestamp="${item.timestamp}" data-action="reuse" title="إعادة الاستخدام" class="p-1.5 rounded-md bg-slate-700/50 hover:bg-cyan-600/70 text-slate-300 hover:text-white transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5M20 20v-5h-5M4 20h5v-5M20 4h-5v5" />
                </svg>
              </button>
              <button data-timestamp="${item.timestamp}" data-action="delete" title="حذف" class="p-1.5 rounded-md bg-slate-700/50 hover:bg-red-600/70 text-slate-300 hover:text-white transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </footer>
        `;
        dom.historyListContainer.appendChild(article);
    });
}

function displayError(message) {
    dom.errorMsg.textContent = message;
    dom.errorMsg.classList.remove('hidden');
    setTimeout(() => dom.errorMsg.classList.add('hidden'), 4000);
}

function displaySpellCheckSuccess(message) {
    dom.spellCheckSuccessMsg.textContent = message;
    dom.spellCheckSuccessMsg.classList.remove('hidden');
    setTimeout(() => dom.spellCheckSuccessMsg.classList.add('hidden'), 3000);
}

// --- Event Handlers ---
async function saveApiKey(event) {
  event.preventDefault();
  dom.apiKeyError.classList.add('hidden');
  const key = dom.apiKeyInput.value.trim();
  if (!key) {
    dom.apiKeyError.textContent = 'يرجى إدخال مفتاح API صالح.';
    dom.apiKeyError.classList.remove('hidden');
    return;
  }
  
  if (state.geminiService.initialize(key)) {
    try {
      await state.geminiService.verifyApiKey();
      sessionStorage.setItem('geminiApiKey', key);
      state.apiKeySet = true;
      render();
    } catch (e) {
       dom.apiKeyError.textContent = 'المفتاح الذي أدخلته غير صالح أو حدث خطأ في الشبكة. يرجى التحقق منه.';
       dom.apiKeyError.classList.remove('hidden');
       console.error(e);
    }
  } else {
    dom.apiKeyError.textContent = 'فشل تهيئة خدمة Gemini. يرجى التحقق من المفتاح والمحاولة مرة أخرى.';
    dom.apiKeyError.classList.remove('hidden');
  }
}

async function handleTranslation() {
  const text = state.sourceText;
  if (!text.trim()) {
    state.translatedText = '';
    render();
    return;
  }

  state.isLoading = true;
  state.translatedText = '';
  render();

  try {
    const sourceLangName = state.languages.find(l => l.code === state.sourceLang)?.name;
    const targetLangName = state.languages.find(l => l.code === state.targetLang)?.name;
    
    const result = await state.geminiService.translateText(text, sourceLangName, targetLangName);
    state.translatedText = result;

    const newHistoryItem = {
      sourceText: text,
      translatedText: result,
      sourceLang: state.sourceLang,
      targetLang: state.targetLang,
      sourceLangName,
      targetLangName,
      timestamp: Date.now()
    };
    addHistoryItem(newHistoryItem);

  } catch (e) {
    displayError('حدث خطأ أثناء الترجمة. يرجى المحاولة مرة أخرى.');
    console.error(e);
  } finally {
    state.isLoading = false;
    render();
  }
}

async function handleSpellCheck() {
    const text = state.sourceText;
    if (!text.trim()) return;

    state.isCheckingSpelling = true;
    render();

    try {
        const sourceLangName = state.languages.find(l => l.code === state.sourceLang)?.name;
        const correctedText = await state.geminiService.spellCheckText(text, sourceLangName);
        
        if (state.sourceText !== correctedText) {
            displaySpellCheckSuccess('تم تصحيح النص بنجاح!');
        } else {
            displaySpellCheckSuccess('النص صحيح ولا يحتاج لتعديل.');
        }
        state.sourceText = correctedText;

    } catch (e) {
        displayError('حدث خطأ أثناء التدقيق الإملائي. يرجى المحاولة مرة أخرى.');
        console.error(e);
    } finally {
        state.isCheckingSpelling = false;
        render();
    }
}

function swapLanguages() {
    [state.sourceLang, state.targetLang] = [state.targetLang, state.sourceLang];
    [state.sourceText, state.translatedText] = [state.translatedText, state.sourceText];
    render();
}

function copyToClipboard() {
    if (!state.translatedText || state.isCopied) return;

    navigator.clipboard.writeText(state.translatedText).then(() => {
        state.isCopied = true;
        render();
        setTimeout(() => {
            state.isCopied = false;
            render();
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text:', err);
        displayError('فشل نسخ النص إلى الحافظة.');
    });
}

function handleHistoryClick(event) {
    const button = event.target.closest('button');
    if (!button) return;

    const action = button.dataset.action;
    const timestamp = Number(button.dataset.timestamp);

    if (action === 'reuse') {
        const item = state.history.find(h => h.timestamp === timestamp);
        if (item) {
            state.sourceLang = item.sourceLang;
            state.targetLang = item.targetLang;
            state.sourceText = item.sourceText;
            state.translatedText = item.translatedText;
            state.isHistoryVisible = false;
            render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    } else if (action === 'delete') {
        state.history = state.history.filter(item => item.timestamp !== timestamp);
        saveHistory();
        render();
    }
}


// --- History Persistence ---
function loadHistory() {
    try {
        const storedHistory = localStorage.getItem('translationHistory');
        if (storedHistory) {
            state.history = JSON.parse(storedHistory);
        }
    } catch (e) {
        console.error('Failed to load history', e);
    }
}

function saveHistory() {
    try {
        localStorage.setItem('translationHistory', JSON.stringify(state.history));
    } catch (e) {
        console.error('Failed to save history', e);
    }
}

function addHistoryItem(item) {
    state.history.unshift(item);
    if (state.history.length > 50) {
        state.history.pop();
    }
    saveHistory();
}

// --- Initialization ---
function init() {
    // Populate language dropdowns
    state.languages.forEach(lang => {
        const option1 = new Option(lang.name, lang.code);
        const option2 = new Option(lang.name, lang.code);
        dom.sourceLangSelect.add(option1);
        dom.targetLangSelect.add(option2);
    });

    // Event listeners
    dom.apiKeyForm.addEventListener('submit', saveApiKey);
    dom.sourceLangSelect.addEventListener('change', e => { state.sourceLang = e.target.value; });
    dom.targetLangSelect.addEventListener('change', e => { state.targetLang = e.target.value; });
    dom.swapLanguagesBtn.addEventListener('click', swapLanguages);
    dom.sourceTextarea.addEventListener('input', e => { 
        state.sourceText = e.target.value;
        render();
    });
    dom.translateBtn.addEventListener('click', handleTranslation);
    dom.spellCheckBtn.addEventListener('click', handleSpellCheck);

    dom.copyBtn.addEventListener('click', copyToClipboard);

    dom.toggleHistoryBtn.addEventListener('click', () => {
        state.isHistoryVisible = !state.isHistoryVisible;
        render();
    });
    dom.clearHistoryBtn.addEventListener('click', () => {
        state.history = [];
        saveHistory();
        render();
    });
    dom.historyListContainer.addEventListener('click', handleHistoryClick);

    // Initial setup
    loadHistory();
    const storedKey = sessionStorage.getItem('geminiApiKey');
    if (storedKey && state.geminiService.initialize(storedKey)) {
        state.apiKeySet = true;
    }
    
    render();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);

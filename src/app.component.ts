import { ChangeDetectionStrategy, Component, inject, signal, afterNextRender } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { GeminiService } from './gemini.service';

interface Language {
  code: string;
  name: string;
}

interface HistoryItem {
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  sourceLangName: string;
  targetLangName: string;
  timestamp: number;
}

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CommonModule],
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');

    :host {
      font-family: 'Tajawal', sans-serif;
    }

    .animate-fade-in {
      animation: fadeIn 0.5s ease-in-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .custom-scrollbar::-webkit-scrollbar {
      width: 8px;
    }

    .custom-scrollbar::-webkit-scrollbar-track {
      background: #1e293b; /* slate-800 */
      border-radius: 10px;
    }

    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #475569; /* slate-600 */
      border-radius: 10px;
    }

    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #64748b; /* slate-500 */
    }
  `],
  template: `
@if (apiKeySet()) {
<div class="min-h-screen bg-gradient-to-br from-slate-900 to-gray-800 text-white flex flex-col items-center justify-center p-4 animate-fade-in">
  <header class="text-center mb-8">
    <div class="flex items-center justify-center gap-4">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 5h12M9 3v2m4 0v2M3 17h12M9 15v2M4 11h16M12 11v10m-8-5h12a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v2a2 2 0 002 2z" />
      </svg>
      <h1 class="text-4xl md:text-5xl font-bold tracking-tight">مترجم اللغات الفوري</h1>
    </div>
    <p class="text-lg text-slate-400 mt-2">ترجمة دقيقة وفورية بين اللغات واللهجات المختلفة</p>
  </header>

  <main class="w-full max-w-4xl bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl p-6 md:p-8">
    
    <!-- Language Selectors -->
    <div class="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center mb-6">
      <div class="w-full">
        <label for="source-lang" class="block text-sm font-medium text-slate-300 mb-2">من:</label>
        <select id="source-lang" name="source-lang"
                [ngModel]="sourceLang()" (ngModelChange)="sourceLang.set($event)"
                class="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition">
          @for (lang of languages; track lang.code) {
            <option [value]="lang.code">{{ lang.name }}</option>
          }
        </select>
      </div>

      <div class="flex justify-center mt-0 md:mt-7">
        <button (click)="swapLanguages()" title="تبديل اللغات" class="p-2 rounded-full bg-slate-700 hover:bg-cyan-500 text-slate-300 hover:text-white transition-all duration-300 transform hover:rotate-180 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-cyan-500">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </button>
      </div>
      
      <div class="w-full">
        <label for="target-lang" class="block text-sm font-medium text-slate-300 mb-2">إلى:</label>
        <select id="target-lang" name="target-lang"
                [ngModel]="targetLang()" (ngModelChange)="targetLang.set($event)"
                class="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition">
          @for (lang of languages; track lang.code) {
            <option [value]="lang.code">{{ lang.name }}</option>
          }
        </select>
      </div>
    </div>

    <!-- Text Areas -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="relative">
        <textarea [(ngModel)]="sourceText" (ngModelChange)="sourceText.set($event)"
                  placeholder="اكتب النص هنا..."
                  class="w-full h-48 md:h-64 p-4 bg-slate-800/60 border border-slate-700 rounded-lg resize-none text-lg text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"></textarea>
         <span class="absolute bottom-3 left-3 text-xs text-slate-500">{{ sourceText().length }} / 5000</span>
      </div>
      <div class="relative w-full h-48 md:h-64 p-4 bg-slate-800/60 border border-slate-700 rounded-lg text-lg text-slate-100 overflow-y-auto">
        @if (isLoading()) {
          <div class="absolute inset-0 flex items-center justify-center bg-slate-800/50">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
          </div>
        }
        @if (!isLoading() && translatedText()) {
          <p class="whitespace-pre-wrap">{{ translatedText() }}</p>
          
          <div class="absolute top-3 left-3 flex items-center gap-2">
             @if (isCopied()) {
              <span class="text-sm text-green-400 transition-opacity duration-300">تم النسخ!</span>
            }
            <button (click)="copyToClipboard()"
                    [disabled]="isCopied()"
                    title="نسخ إلى الحافظة"
                    class="p-1.5 rounded-md bg-slate-700/50 hover:bg-cyan-600/70 text-slate-300 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-cyan-500 disabled:cursor-wait disabled:hover:bg-slate-700/50">
              @if (isCopied()) {
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              } @else {
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              }
            </button>
          </div>
        }
        @if (!isLoading() && !translatedText()) {
           <span class="text-slate-500">الترجمة...</span>
        }
      </div>
    </div>
    
    <!-- Action Buttons & Messages -->
    <div class="mt-6 flex flex-col items-center gap-4">
      @if (spellCheckSuccess()) {
        <div class="text-sm text-green-300 bg-green-900/40 border border-green-700 rounded-lg px-4 py-2 transition-opacity duration-300">
          {{ spellCheckSuccess() }}
        </div>
      }

      <div class="flex flex-col sm:flex-row gap-4 w-full justify-center">
        <button (click)="handleSpellCheck()"
                [disabled]="isCheckingSpelling() || !sourceText().trim()"
                class="w-full sm:w-auto px-8 py-3 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-lg text-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-slate-500/50 flex items-center justify-center gap-2">
          @if (isCheckingSpelling()) {
            <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>جاري التدقيق...</span>
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>تدقيق إملائي</span>
          }
        </button>

        <button (click)="handleTranslation()" 
              [disabled]="isLoading() || !sourceText().trim()"
              class="w-full sm:w-auto px-10 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold rounded-lg text-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 flex items-center justify-center gap-2">
          @if (isLoading()) {
            <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>جاري الترجمة...</span>
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>ترجمة</span>
          }
        </button>
      </div>

      @if (error()) {
        <div class="text-center text-red-400 bg-red-900/50 border border-red-700 rounded-lg px-4 py-2">
          {{ error() }}
        </div>
      }
    </div>

    <!-- History Toggle -->
    <div class="mt-6 text-center">
      <button (click)="toggleHistory()" class="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded-md px-3 py-1">
        @if (isHistoryVisible()) {
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
          </svg>
          <span>إخفاء سجل الترجمة</span>
        } @else {
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <span>عرض سجل الترجمة</span>
        }
      </button>
    </div>

    <!-- History Section -->
    @if (isHistoryVisible()) {
      <section class="mt-8 border-t border-white/10 pt-6 animate-fade-in">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-semibold text-slate-200">سجل الترجمة</h2>
          @if (history().length > 0) {
            <button (click)="clearHistory()" class="inline-flex items-center gap-1 text-sm text-red-400 hover:text-red-300 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded-md px-2 py-1">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>مسح السجل</span>
            </button>
          }
        </div>
    
        @if (history().length === 0) {
          <div class="text-center text-slate-400 py-8 bg-slate-800/30 rounded-lg">
            <p>لا يوجد سجل ترجمة حتى الآن.</p>
          </div>
        } @else {
          <div class="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
            @for (item of history(); track item.timestamp) {
              <article class="bg-slate-800/50 p-4 rounded-lg border border-slate-700 hover:border-cyan-700 transition-all group">
                <header class="flex justify-between items-start text-sm text-slate-400 mb-3">
                  <div class="font-medium">
                    <span>{{ item.sourceLangName }}</span>
                    <span class="mx-1">&rarr;</span>
                    <span>{{ item.targetLangName }}</span>
                  </div>
                  <span class="text-xs">{{ formatTimestamp(item.timestamp) }}</span>
                </header>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                  <p class="font-semibold text-slate-200 mb-2 md:mb-0 line-clamp-3 break-words">{{ item.sourceText }}</p>
                  <p class="text-cyan-300 line-clamp-3 break-words">{{ item.translatedText }}</p>
                </div>
                <footer class="flex justify-end gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button (click)="reuseTranslation(item)" title="إعادة الاستخدام" class="p-1.5 rounded-md bg-slate-700/50 hover:bg-cyan-600/70 text-slate-300 hover:text-white transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5M20 20v-5h-5M4 20h5v-5M20 4h-5v5" />
                    </svg>
                  </button>
                  <button (click)="deleteHistoryItem(item.timestamp)" title="حذف" class="p-1.5 rounded-md bg-slate-700/50 hover:bg-red-600/70 text-slate-300 hover:text-white transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </footer>
              </article>
            }
          </div>
        }
      </section>
    }

  </main>
  
  <footer class="text-center mt-8 text-slate-500 text-sm">
    <p>مدعوم بواسطة Gemini API</p>
  </footer>
</div>
} @else {
<div class="fixed inset-0 bg-gradient-to-br from-slate-900 to-gray-800 z-50 flex items-center justify-center p-4">
  <div class="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl animate-fade-in">
    <div class="text-center">
      <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <h2 class="mt-4 text-2xl font-bold text-white">مطلوب مفتاح Gemini API</h2>
      <p class="mt-2 text-sm text-slate-400">
        لاستخدام المترجم، يرجى إدخال مفتاح Gemini API الخاص بك. سيتم حفظه بأمان في هذه الجلسة فقط.
      </p>
    </div>
    <form (submit)="saveApiKey(); $event.preventDefault()" class="mt-6">
      <div>
        <label for="api-key" class="sr-only">Gemini API Key</label>
        <input id="api-key" name="api-key" type="password"
               [ngModel]="apiKey()" (ngModelChange)="apiKey.set($event)"
               placeholder="أدخل مفتاح API هنا"
               class="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-3 px-4 text-white text-center focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition" />
      </div>

      @if (apiKeyError()) {
        <p class="mt-2 text-sm text-red-400 text-center">{{ apiKeyError() }}</p>
      }

      <div class="mt-6">
        <button type="submit"
                class="w-full px-8 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 text-white font-bold rounded-lg text-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 flex items-center justify-center gap-2">
          <span>حفظ ومتابعة</span>
        </button>
      </div>
    </form>
    <p class="mt-6 text-xs text-slate-500 text-center">
      يمكنك الحصول على مفتاح API من Google AI Studio.
    </p>
  </div>
</div>
}
  `
})
export class AppComponent {
  private readonly geminiService = inject(GeminiService);

  // --- State for API Key ---
  apiKey = signal<string>('');
  apiKeySet = signal<boolean>(false);
  apiKeyError = signal<string | null>(null);

  // --- State for Translator ---
  languages: Language[] = [
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
  ];

  sourceLang = signal<string>('en');
  targetLang = signal<string>('ar-IQ');
  sourceText = signal<string>('');
  translatedText = signal<string>('');
  isLoading = signal<boolean>(false);
  isCheckingSpelling = signal<boolean>(false);
  error = signal<string | null>(null);
  spellCheckSuccess = signal<string | null>(null);
  isCopied = signal<boolean>(false);
  history = signal<HistoryItem[]>([]);
  isHistoryVisible = signal<boolean>(false);

  constructor() {
    afterNextRender(() => {
      this.loadHistory();
      // Check for API key in session storage on startup
      const storedKey = sessionStorage.getItem('geminiApiKey');
      if (storedKey) {
        if (this.geminiService.initialize(storedKey)) {
          this.apiKeySet.set(true);
        } else {
          // Remove invalid key
          sessionStorage.removeItem('geminiApiKey');
        }
      }
    });
  }
  
  // --- API Key Methods ---
  async saveApiKey(): Promise<void> {
    this.apiKeyError.set(null);
    const key = this.apiKey().trim();
    if (!key) {
      this.apiKeyError.set('يرجى إدخال مفتاح API صالح.');
      return;
    }
    
    // Initialize the service and then perform a quick test call
    if (this.geminiService.initialize(key)) {
      try {
        // Test call to verify the key is valid
        await this.geminiService.verifyApiKey();
        sessionStorage.setItem('geminiApiKey', key);
        this.apiKeySet.set(true);
      } catch (e) {
         this.apiKeyError.set('المفتاح الذي أدخلته غير صالح أو حدث خطأ في الشبكة. يرجى التحقق منه.');
         console.error(e);
      }
    } else {
      this.apiKeyError.set('فشل تهيئة خدمة Gemini. يرجى التحقق من المفتاح والمحاولة مرة أخرى.');
    }
  }

  // --- Translation Methods ---
  async handleTranslation(): Promise<void> {
    const text = this.sourceText();
    if (!text.trim()) {
      this.translatedText.set('');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);
    this.translatedText.set('');

    try {
      const sourceLangName = this.languages.find(l => l.code === this.sourceLang())?.name || 'English';
      const targetLangName = this.languages.find(l => l.code === this.targetLang())?.name || 'Arabic (Iraqi dialect)';
      
      const result = await this.geminiService.translateText(text, sourceLangName, targetLangName);
      this.translatedText.set(result);

      const newHistoryItem: HistoryItem = {
        sourceText: text,
        translatedText: result,
        sourceLang: this.sourceLang(),
        targetLang: this.targetLang(),
        sourceLangName,
        targetLangName,
        timestamp: Date.now()
      };
      this.addHistoryItem(newHistoryItem);

    } catch (e) {
      this.error.set('حدث خطأ أثناء الترجمة. يرجى المحاولة مرة أخرى.');
      console.error(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async handleSpellCheck(): Promise<void> {
    const text = this.sourceText();
    if (!text.trim()) {
      return;
    }

    this.isCheckingSpelling.set(true);
    this.error.set(null);
    this.spellCheckSuccess.set(null);

    try {
      const sourceLangName = this.languages.find(l => l.code === this.sourceLang())?.name || 'English';
      const correctedText = await this.geminiService.spellCheckText(text, sourceLangName);
      this.sourceText.set(correctedText);
      if (text !== correctedText) {
        this.spellCheckSuccess.set('تم تصحيح النص بنجاح!');
      } else {
        this.spellCheckSuccess.set('النص صحيح ولا يحتاج لتعديل.');
      }
      setTimeout(() => this.spellCheckSuccess.set(null), 3000);
    } catch (e) {
      this.error.set('حدث خطأ أثناء التدقيق الإملائي. يرجى المحاولة مرة أخرى.');
      console.error(e);
    } finally {
      this.isCheckingSpelling.set(false);
    }
  }

  swapLanguages(): void {
    const currentSource = this.sourceLang();
    const currentTarget = this.targetLang();
    this.sourceLang.set(currentTarget);
    this.targetLang.set(currentSource);

    const currentSourceText = this.sourceText();
    const currentTranslatedText = this.translatedText();
    this.sourceText.set(currentTranslatedText);
    this.translatedText.set(currentSourceText);
  }

  copyToClipboard(): void {
    const text = this.translatedText();
    if (!text || this.isCopied()) {
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      this.isCopied.set(true);
      setTimeout(() => this.isCopied.set(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text to clipboard:', err);
      this.error.set('فشل نسخ النص إلى الحافظة.');
      setTimeout(() => this.error.set(null), 3000);
    });
  }

  // --- History Methods ---
  toggleHistory(): void {
    this.isHistoryVisible.update(visible => !visible);
  }

  reuseTranslation(item: HistoryItem): void {
    this.sourceLang.set(item.sourceLang);
    this.targetLang.set(item.targetLang);
    this.sourceText.set(item.sourceText);
    this.translatedText.set(item.translatedText);
    this.isHistoryVisible.set(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  deleteHistoryItem(timestamp: number): void {
    this.history.update(current => current.filter(item => item.timestamp !== timestamp));
    this.saveHistory();
  }
  
  clearHistory(): void {
    this.history.set([]);
    this.saveHistory();
  }

  formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString('ar-IQ');
  }
  
  private loadHistory(): void {
    try {
      const storedHistory = localStorage.getItem('translationHistory');
      if (storedHistory) {
        this.history.set(JSON.parse(storedHistory));
      }
    } catch (e) {
      console.error('Failed to load history from localStorage', e);
    }
  }
  
  private saveHistory(): void {
    try {
      localStorage.setItem('translationHistory', JSON.stringify(this.history()));
    } catch (e) {
      console.error('Failed to save history to localStorage', e);
    }
  }
  
  private addHistoryItem(item: HistoryItem): void {
    this.history.update(current => [item, ...current].slice(0, 50));
    this.saveHistory();
  }
}
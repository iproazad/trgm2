import { ChangeDetectionStrategy, Component, inject, signal, afterNextRender } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { GeminiService } from './services/gemini.service';

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
  templateUrl: './app.component.html',
  styleUrls: ['../styles.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CommonModule],
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
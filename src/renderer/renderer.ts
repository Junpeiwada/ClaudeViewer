// レンダラープロセス（フロントエンド）のメインファイル

class ClaudeViewerRenderer {
  private statusText: HTMLElement | null = null;
  private versionSpan: HTMLElement | null = null;
  private themeStatus: HTMLElement | null = null;
  private themeIndicator: HTMLElement | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // DOM要素の取得
    this.statusText = document.getElementById('status-text');
    this.versionSpan = document.getElementById('app-version');
    this.themeStatus = document.getElementById('theme-status');
    this.themeIndicator = document.getElementById('theme-indicator');

    // 初期化処理
    await this.initializeApp();
    this.setupThemeHandling();
    this.updateStatus('Ready');
  }

  private async initializeApp(): Promise<void> {
    try {
      // アプリバージョンの取得
      if (this.versionSpan) {
        this.versionSpan.textContent = '1.0.0'; // 仮の値
      }

      this.updateStatus('アプリケーション初期化完了');
    } catch (error) {
      console.error('初期化エラー:', error);
      this.updateStatus('初期化エラー');
    }
  }

  private setupThemeHandling(): void {
    // 初期テーマの設定
    this.updateTheme();

    // テーマ変更の監視（将来的にElectronのAPIと連携）
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', () => {
        this.updateTheme();
      });
    }
  }

  private updateTheme(): void {
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // テーマの適用
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    
    // UI更新
    if (this.themeStatus) {
      this.themeStatus.textContent = isDark ? 'ダーク' : 'ライト';
    }
    
    if (this.themeIndicator) {
      this.themeIndicator.textContent = isDark ? '🌙' : '☀️';
    }
  }

  private updateStatus(message: string): void {
    if (this.statusText) {
      this.statusText.textContent = message;
    }
    console.log(`[Status] ${message}`);
  }
}

// DOM読み込み完了後にアプリケーション開始
document.addEventListener('DOMContentLoaded', () => {
  new ClaudeViewerRenderer();
});
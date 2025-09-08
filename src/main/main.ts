import { app, BrowserWindow, nativeTheme, Menu, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ClaudeExtractor } from '../lib/claudeExtractor';

class ClaudeViewer {
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // アプリの準備完了まで待機
    await app.whenReady();

    // メインウィンドウを作成
    this.createMainWindow();
    
    // アプリメニューを設定
    this.setupMenu();
    
    // IPCハンドラを設定
    this.setupIPCHandlers();

    // macOSでのウィンドウ管理（不要 - ウィンドウが閉じたらアプリ終了）
    // app.on('activate', () => {
    //   if (BrowserWindow.getAllWindows().length === 0) {
    //     this.createMainWindow();
    //   }
    // });

    // 全てのウィンドウが閉じられたときの処理
    app.on('window-all-closed', () => {
      // macOSでもウィンドウが閉じたらアプリを終了
      app.quit();
    });

    // テーマ変更の監視
    nativeTheme.on('updated', () => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('theme-changed', {
          shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
          themeSource: nativeTheme.themeSource,
        });
      }
    });
  }

  private createMainWindow(): void {
    // メインウィンドウの作成
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      titleBarStyle: 'default',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../renderer', 'preload.js'),
      },
      show: false, // 準備完了後に表示
    });

    // HTMLファイルの読み込み（Webpack出力）
    this.mainWindow.loadFile(path.join(__dirname, '../../renderer', 'index.html'));

    // 準備完了後にウィンドウを表示
    this.mainWindow.once('ready-to-show', () => {
      if (this.mainWindow) {
        this.mainWindow.show();
        
        // F12キーでDevToolsを開閉（安定化版）
        let f12LastPressed = 0;
        this.mainWindow.webContents.on('before-input-event', (event, input) => {
          if (input.key === 'F12' && input.type === 'keyDown') {
            const now = Date.now();
            // デバウンス：200ms以内の連続操作を無視
            if (now - f12LastPressed < 200) {
              return;
            }
            f12LastPressed = now;
            
            // DevTools開閉処理
            setTimeout(() => {
              if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                if (this.mainWindow.webContents.isDevToolsOpened()) {
                  this.mainWindow.webContents.closeDevTools();
                } else {
                  this.mainWindow.webContents.openDevTools();
                }
              }
            }, 10);
          }
        });
        
        // デフォルトではDevToolsを開かない
        // F12キーまたはメニューから開く
      }
    });

    // ウィンドウが閉じられたときの処理
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // ウィンドウタイトルの設定
    this.mainWindow.setTitle('Claude Code Viewer');
  }

  private setupMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'Claude Code Viewer',
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: '表示',
        submenu: [
          {
            label: '開発者ツール',
            accelerator: 'F12',
            click: () => {
              if (this.mainWindow?.webContents.isDevToolsOpened()) {
                this.mainWindow.webContents.closeDevTools();
              } else {
                this.mainWindow?.webContents.openDevTools();
              }
            }
          },
          { type: 'separator' },
          { role: 'reload' },
          { role: 'forceReload' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'ウィンドウ',
        submenu: [
          { role: 'minimize' },
          { role: 'close' }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private setupIPCHandlers(): void {
    // プロジェクト一覧取得
    ipcMain.handle('get-projects', async () => {
      try {
        const claudeProjectsPath = path.join(os.homedir(), '.claude', 'projects');
        
        if (!fs.existsSync(claudeProjectsPath)) {
          throw new Error('Claude projects folder not found');
        }

        const entries = fs.readdirSync(claudeProjectsPath, { withFileTypes: true });
        const projects = entries
          .filter(entry => entry.isDirectory())
          .map(entry => {
            const fullPath = path.join(claudeProjectsPath, entry.name);
            
            // フォルダ名をそのまま使用（編集なし）
            return {
              name: entry.name,
              path: fullPath
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        return projects;
      } catch (error) {
        console.error('Error loading projects:', error);
        return [];
      }
    });

    // プロジェクト内ファイル一覧取得
    ipcMain.handle('get-project-files', async (_, projectPath: string) => {
      try {
        if (!fs.existsSync(projectPath)) {
          return [];
        }

        const entries = fs.readdirSync(projectPath, { withFileTypes: true });
        const files = entries
          .filter(entry => entry.isFile() && entry.name.endsWith('.jsonl'))
          .map(entry => {
            const filePath = path.join(projectPath, entry.name);
            const stats = fs.statSync(filePath);
            
            return {
              name: entry.name,
              date: stats.mtime.toLocaleDateString('ja-JP') + ' ' + 
                    stats.mtime.toLocaleTimeString('ja-JP', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    }),
              size: (stats.size / (1024 * 1024)).toFixed(1) + 'MB',
              fullPath: filePath,
              mtime: stats.mtime
            };
          });

        return files;
      } catch (error) {
        console.error('Error loading project files:', error);
        return [];
      }
    });

    // エラーダイアログ表示
    ipcMain.handle('show-error-dialog', async (_, title: string, message: string) => {
      if (this.mainWindow) {
        await dialog.showMessageBox(this.mainWindow, {
          type: 'error',
          title: title,
          message: message,
          buttons: ['OK']
        });
      }
    });

    // Finder表示
    ipcMain.handle('show-in-finder', async (_, filePath: string) => {
      try {
        if (fs.existsSync(filePath)) {
          shell.showItemInFolder(filePath);
        } else {
          console.error('File not found for Finder display:', filePath);
        }
      } catch (error) {
        console.error('Error showing in Finder:', error);
      }
    });

    // 新しいTypeScript版JSONL→MD変換

    ipcMain.handle('convert-jsonl-to-md', async (_, jsonlPath: string) => {
      try {
        const extractor = new ClaudeExtractor();
        const mdContent = await extractor.convertFile(jsonlPath);
        return { success: true, mdContent };
      } catch (error) {
        console.error('JSONL→MD変換エラー:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : `変換エラー: ${error}` 
        };
      }
    });

    // ファイル読み込み
    ipcMain.handle('read-file', async (_, filePath: string) => {
      try {
        if (!fs.existsSync(filePath)) {
          throw new Error('File not found');
        }
        return fs.readFileSync(filePath, 'utf-8');
      } catch (error) {
        console.error('Error reading file:', error);
        throw error;
      }
    });

    // MD→HTML変換
    ipcMain.handle('convert-md-to-html', async (_, mdContent: string) => {
      try {
        // シンプルなMarkdown→HTML変換
        const htmlContent = this.convertMarkdownToHtml(mdContent);
        return { success: true, html: htmlContent };
      } catch (error) {
        console.error('MD→HTML変換エラー:', error);
        return { success: false, error: `変換エラー: ${error}` };
      }
    });
  }

  // Markdown→HTML変換（Claude会話スタイル）
  private convertMarkdownToHtml(mdContent: string): string {
    // MDヘッダー情報を抽出
    const lines = mdContent.split('\n');
    let sessionId = '';
    let date = '';
    
    // ヘッダー情報を抽出
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i];
      if (line.startsWith('Session ID:')) {
        sessionId = line.replace('Session ID: ', '').trim();
      } else if (line.startsWith('Date:')) {
        date = line.replace('Date: ', '').trim();
      }
    }
    
    // メッセージセクションを抽出（元版準拠・シンプル化）
    const sections = mdContent.split(/^---$/gm);
    const messages: { type: 'user' | 'claude', content: string }[] = [];
    
    for (const section of sections) {
      const trimmedSection = section.trim();
      if (trimmedSection.startsWith('## 👤 User')) {
        const content = trimmedSection.replace(/^## 👤 User\s*/, '').trim();
        if (content) {
          messages.push({ type: 'user', content });
        }
      } else if (trimmedSection.startsWith('## 🤖 Claude')) {
        const content = trimmedSection.replace(/^## 🤖 Claude\s*/, '').trim();
        if (content) {
          messages.push({ type: 'claude', content });
        }
      }
    }
    
    // HTMLメッセージを生成
    const messagesHtml = messages.map(message => this.generateMessageHtml(message)).join('\n');
    
    // 完全なHTMLページを生成（構造簡素化）
    const fullHtml = `
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Claude Code会話履歴 - ${sessionId ? sessionId.substring(0, 8) : 'conversation'}</title>
        <link rel="stylesheet" href="chat-simple.css">
        <style>
          /* 確実に適用されるインラインスタイル */
          body { margin: 0; padding: 8px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: linear-gradient(to bottom, #e0f2fe, #f0f9ff); }
          .chat-msg { display: flex; align-items: center; gap: 8px; margin: 8px 0; padding: 10px 14px; background: white; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); word-wrap: break-word; }
          .chat-msg.user { flex-direction: row-reverse; background: white; margin-left: 80px; margin-right: 8px; }
          .chat-msg.claude { background: #f5f5f5; margin-left: 8px; margin-right: 80px; }
          .chat-icon { width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
          .chat-msg.user .chat-icon { background: linear-gradient(135deg, #1e40af, #3b82f6); }
          .chat-msg.claude .chat-icon { background: linear-gradient(135deg, #7c3aed, #a78bfa); }
          .chat-text { flex: 1; font-size: 0.95rem; line-height: 1.4; word-break: break-word; }
        </style>
      </head>
      <body>
        <div class="chat-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 10px 16px; text-align: center; border-radius: 8px; margin-bottom: 12px;">
          <h1 style="font-size: 1.3rem; margin: 0 0 4px 0;">🤖 Claude Code会話履歴</h1>
          <p style="font-size: 0.9rem; margin: 0; opacity: 0.9;">Session: ${sessionId ? sessionId.substring(0, 8) + '...' : 'Unknown'} | ${date ? new Date(date).toLocaleString('ja-JP') : 'Unknown Date'}</p>
        </div>
        
        <div class="chat-container">
          ${messagesHtml}
        </div>
        
        <script>
          // デバッグ用ログ
          console.log('🤖 Claude Code会話履歴が読み込まれました');
          console.log('メッセージ数:', document.querySelectorAll('.chat-msg').length);
          
          // スタイル適用確認
          const firstMsg = document.querySelector('.chat-msg');
          if (firstMsg) {
            console.log('メッセージスタイル確認:', window.getComputedStyle(firstMsg).display);
          } else {
            console.warn('⚠️ メッセージ要素が見つかりません');
          }
          
          // スクロール制御
          window.addEventListener('load', function() {
            window.scrollTo(0, 0);
            console.log('📜 ページトップにスクロールしました');
          });
        </script>
      </body>
      </html>
    `;
    
    return fullHtml;
  }

  // シンプルな2層構造でメッセージHTML生成
  private generateMessageHtml(message: { type: 'user' | 'claude', content: string }): string {
    const icon = message.type === 'user' ? '👤' : '🤖';
    const processedContent = this.processMessageContent(message.content);
    
    return `
      <div class="chat-msg ${message.type}">
        <span class="chat-icon">${icon}</span>
        <div class="chat-text">${processedContent}</div>
      </div>
    `;
  }

  // メッセージ内容の処理（Markdown → HTML）
  private processMessageContent(content: string): string {
    return content
      // detailsタグをそのまま保持（HTMLとして処理）
      .replace(/(<details[^>]*>[\s\S]*?<\/details>)/g, '$1')
      // コードブロック処理（```で囲まれた部分）
      .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        // detailsタグ内のコードブロックは特別処理
        if (match.includes('<details')) {
          return match;
        }
        return `<div class="code-block">${this.escapeHtml(code)}</div>`;
      })
      // インラインコード処理（`で囲まれた部分）
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // 太字処理
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // 斜体処理  
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // リンク処理
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      // 改行処理（detailsタグ内は改行保持）
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
  }

  // HTMLエスケープ
  private escapeHtml(text: string): string {
    const div = { innerHTML: '' } as any;
    div.textContent = text;
    return div.innerHTML || text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 会話用CSSスタイル
  private getConversationStyles(): string {
    return `
      :root {
        --bg-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        --user-gradient: linear-gradient(135deg, #1e40af, #3b82f6);
        --claude-gradient: linear-gradient(135deg, #7c3aed, #a78bfa);
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      /* 全てのテキスト要素のマージンをリセット */
      p, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, div {
        margin: 0 !important;
        padding: 0 !important;
      }

      /* 必要最小限の余白のみ */
      p + p, li, h1, h2, h3, h4, h5, h6 {
        margin-top: 0.25rem !important;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(to bottom, #e0f2fe, #f0f9ff);
        color: #1f2937;
        line-height: 1.6;
        min-height: 100vh;
        scroll-behavior: auto !important; /* スクロールアニメーション無効化 */
      }

      .header {
        background: var(--bg-gradient);
        color: white;
        padding: 2rem;
        text-align: center;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }

      .header h1 {
        font-size: 2rem;
        margin-bottom: 0.5rem;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 1rem;
      }

      .conversation {
        background: white;
        border-radius: 1rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        padding: 1rem;
      }

      .message {
        margin-bottom: 0.5rem;
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        animation: fadeIn 0.3s ease-in;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .message.user {
        flex-direction: row-reverse;
      }

      .message-icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        flex-shrink: 0;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .message.user .message-icon {
        background: var(--user-gradient);
      }

      .message.claude .message-icon {
        background: var(--claude-gradient);
      }

      .message-content {
        flex: 1;
        max-width: 80%;
      }

      .message.user .message-content {
        text-align: right;
      }

      .message-bubble {
        display: inline-block;
        padding: 0.5rem 0.75rem;
        border-radius: 1rem;
        background: #f3f4f6;
        position: relative;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        line-height: 1.4;
      }

      /* メッセージバブル内の全要素の余白を最小限に */
      .message-bubble * {
        margin: 0 !important;
        padding: 0 !important;
        line-height: 1.4 !important;
      }

      /* 連続するテキスト要素間のみ最小の余白 */
      .message-bubble p + p,
      .message-bubble p + div,
      .message-bubble div + p,
      .message-bubble div + div {
        margin-top: 0.125rem !important;
      }

      .message.user .message-bubble {
        background: linear-gradient(135deg, #dbeafe, #e0f2fe);
        color: #1e40af;
        text-align: left;
      }

      .message.claude .message-bubble {
        background: linear-gradient(135deg, #ede9fe, #f3e8ff);
        color: #5b21b6;
      }

      .code-block {
        background: #1f2937;
        color: #e5e7eb;
        padding: 1rem;
        border-radius: 0.5rem;
        font-family: 'Courier New', monospace;
        font-size: 0.875rem;
        margin: 0.5rem 0;
        overflow-x: auto;
        white-space: pre-wrap;
      }

      code {
        background: rgba(0, 0, 0, 0.1);
        padding: 0.2em 0.4em;
        border-radius: 3px;
        font-family: 'Monaco', 'Consolas', monospace;
        font-size: 0.9em;
      }

      strong {
        font-weight: 600;
      }

      a {
        color: #3b82f6;
        text-decoration: none;
      }

      a:hover {
        text-decoration: underline;
      }

      /* 折り畳み機能のスタイル */
      details.tool-result, details.command-result {
        margin: 1rem 0;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        overflow: hidden;
        background: rgba(248, 250, 252, 0.8);
      }

      details.tool-result summary, details.command-result summary {
        padding: 0.75rem 1rem;
        background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
        cursor: pointer;
        font-weight: 600;
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      details.tool-result summary:hover, details.command-result summary:hover {
        background: linear-gradient(135deg, #e2e8f0, #cbd5e1);
      }

      details.tool-result[open] summary, details.command-result[open] summary {
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      }

      details.tool-result pre, details.command-result pre {
        margin: 0;
        padding: 1rem;
        background: #1f2937;
        color: #e5e7eb;
        font-family: 'Monaco', 'Consolas', monospace;
        font-size: 0.875rem;
        overflow-x: auto;
        white-space: pre-wrap;
      }

      /* ツール種別による色分け */
      details.tool-result.read-tool summary {
        background: linear-gradient(135deg, #dbeafe, #bfdbfe);
      }

      details.tool-result.edit-tool summary {
        background: linear-gradient(135deg, #fef3c7, #fde68a);
      }

      details.command-result summary {
        background: linear-gradient(135deg, #dcfce7, #bbf7d0);
      }

      /* アイコン付きの summary */
      summary::marker {
        content: '';
      }

      summary::before {
        content: '▶️';
        margin-right: 0.5rem;
        transition: transform 0.2s ease;
      }

      details[open] summary::before {
        content: '🔽';
        transform: rotate(0deg);
      }

      /* Plan Proposal特別スタイル */
      .plan-proposal {
        margin: 1.5rem 0;
        border: 2px solid #8b5cf6;
        border-radius: 12px;
        background: linear-gradient(135deg, #faf5ff, #f3e8ff);
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2);
      }

      .plan-proposal summary {
        padding: 1rem 1.5rem;
        background: linear-gradient(135deg, #8b5cf6, #a78bfa);
        color: white;
        font-weight: 700;
        font-size: 1.1rem;
        border-radius: 10px 10px 0 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .plan-proposal summary:hover {
        background: linear-gradient(135deg, #7c3aed, #8b5cf6);
      }

      .plan-proposal summary::before {
        content: '📋';
        font-size: 1.2rem;
      }

      .plan-proposal[open] summary::before {
        content: '📋';
      }

      /* System message スタイル */
      .message.system .message-icon {
        background: linear-gradient(135deg, #10b981, #34d399);
      }

      .message.system .message-bubble {
        background: linear-gradient(135deg, #d1fae5, #a7f3d0);
        color: #065f46;
        border: 1px solid #6ee7b7;
      }

      /* Plan message スタイル */
      .message.plan .message-icon {
        background: linear-gradient(135deg, #8b5cf6, #a78bfa);
      }

      .message.plan .message-bubble {
        background: linear-gradient(135deg, #faf5ff, #f3e8ff);
        color: #5b21b6;
        border: 2px solid #c4b5fd;
      }
    `;
  }


}

// アプリケーション起動
new ClaudeViewer();
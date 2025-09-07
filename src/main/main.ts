import { app, BrowserWindow, nativeTheme, Menu, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';

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
            // 共通パス部分を除去してクリーンな名前を生成
            let cleanName = entry.name;
            
            // ユーザーパスやDocuments/Projectパスのパターンを除去
            const userHome = os.homedir();
            const pathPattern = new RegExp(`^.*?${path.sep}([^${path.sep}]+)$`);
            
            // パスの最後の部分のみを取得（実際のプロジェクト名）
            const match = fullPath.match(pathPattern);
            if (match && match[1]) {
              cleanName = match[1];
            }
            
            // 実際のプロジェクト名パターンに基づく除去
            // 例: "-Users-junpeiwada-Documents-Project-HLGTimeLapse" → "HLGTimeLapse"
            cleanName = cleanName
              .replace(/^-?Users-[^-]+-Documents-Project-/, '') // -Users-username-Documents-Project- を除去
              .replace(/^-?[^-]+-Documents-Project-/, '') // -username-Documents-Project- を除去
              .replace(/^-?Documents-Project-/, '') // -Documents-Project- を除去
              .replace(/^-/, ''); // 先頭の - を除去
            
            // もし空になった場合は元の名前を使用
            if (!cleanName) {
              cleanName = entry.name;
            }
            
            return {
              name: cleanName,
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

    // セッション一覧取得
    ipcMain.handle('get-sessions', async (_, projectPath: string) => {
      return new Promise((resolve) => {
        try {
          const venvPath = '/Users/junpeiwada/Documents/Project/ClaudeViewer/claude-extractor-env';
          const claudeExtractPath = path.join(venvPath, 'bin', 'claude-extract');
          
          const listProcess = spawn(claudeExtractPath, ['--list', '--limit', '50'], {
            env: { ...process.env, PATH: `${path.join(venvPath, 'bin')}:${process.env.PATH}` },
            cwd: projectPath
          });

          let stdout = '';
          listProcess.stdout?.on('data', (data) => {
            stdout += data.toString();
          });

          listProcess.on('close', (code) => {
            if (code === 0) {
              // セッション情報をパース
              const sessions = this.parseSessionList(stdout);
              resolve({ success: true, sessions });
            } else {
              resolve({ success: false, sessions: [] });
            }
          });
        } catch (error) {
          resolve({ success: false, sessions: [] });
        }
      });
    });

    // JSONL→MD変換
    ipcMain.handle('convert-jsonl-to-md', async (_, jsonlPath: string, outputDir: string) => {
      return new Promise(async (resolve) => {
        try {
          // venv環境のclaude-extractコマンドを実行
          const venvPath = '/Users/junpeiwada/Documents/Project/ClaudeViewer/claude-extractor-env';
          const claudeExtractPath = path.join(venvPath, 'bin', 'claude-extract');
          
          // 出力ディレクトリを作成
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          // JSONLファイルが含まれているプロジェクトディレクトリを取得
          const projectDir = path.dirname(jsonlPath);
          
          // ファイル名からセッション番号を特定
          const sessionNumber = await this.findSessionNumber(jsonlPath, projectDir);
          
          // claude-extractプロセスを起動（特定のセッションを変換）
          const claudeProcess = spawn(claudeExtractPath, [
            '--extract', sessionNumber.toString(),
            '--output', outputDir
          ], {
            env: { ...process.env, PATH: `${path.join(venvPath, 'bin')}:${process.env.PATH}` },
            cwd: projectDir // JSONLファイルがあるプロジェクトディレクトリから実行
          });

          let stdout = '';
          let stderr = '';

          claudeProcess.stdout?.on('data', (data) => {
            stdout += data.toString();
          });

          claudeProcess.stderr?.on('data', (data) => {
            stderr += data.toString();
          });

          claudeProcess.on('close', (code) => {
            if (code === 0) {
              // 生成されたMDファイルを探す
              const outputFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.md'));
              const mdPath = outputFiles.length > 0 ? path.join(outputDir, outputFiles[0]) : null;
              
              resolve({ 
                success: true, 
                mdPath: mdPath,
                stdout: stdout 
              });
            } else {
              resolve({ 
                success: false, 
                error: `変換プロセスエラー (code: ${code}): ${stderr}` 
              });
            }
          });

          claudeProcess.on('error', (error) => {
            resolve({ 
              success: false, 
              error: `プロセス起動エラー: ${error.message}` 
            });
          });

        } catch (error) {
          resolve({ 
            success: false, 
            error: `変換エラー: ${error}` 
          });
        }
      });
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
    
    // メッセージセクションを抽出
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
    
    // 完全なHTMLページを生成
    const fullHtml = `
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Claude Code会話履歴 - ${sessionId ? sessionId.substring(0, 8) : 'conversation'}</title>
        <style>
          ${this.getConversationStyles()}
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🤖 Claude Code会話履歴</h1>
          <p>Session: ${sessionId ? sessionId.substring(0, 8) + '...' : 'Unknown'}</p>
          ${date ? `<p>Date: ${new Date(date).toLocaleString('ja-JP')}</p>` : ''}
        </div>
        
        <div class="container">
          <div class="conversation">
            ${messagesHtml}
          </div>
        </div>
        
        <script>
          // ページ読み込み時に必ずトップにスクロール
          window.addEventListener('load', function() {
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
            document.documentElement.scrollTop = 0;
          });
          
          // DOM読み込み完了時にもスクロールリセット
          document.addEventListener('DOMContentLoaded', function() {
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
            document.documentElement.scrollTop = 0;
          });
        </script>
      </body>
      </html>
    `;
    
    return fullHtml;
  }

  // 個別メッセージのHTML生成
  private generateMessageHtml(message: { type: 'user' | 'claude', content: string }): string {
    const icon = message.type === 'user' ? '👤' : '🤖';
    const processedContent = this.processMessageContent(message.content);
    
    return `
      <div class="message ${message.type}">
        <div class="message-icon">${icon}</div>
        <div class="message-content">
          <div class="message-bubble">
            ${processedContent}
          </div>
        </div>
      </div>
    `;
  }

  // メッセージ内容の処理（Markdown → HTML）
  private processMessageContent(content: string): string {
    return content
      // コードブロック処理（```で囲まれた部分）
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<div class="code-block">$2</div>')
      // インラインコード処理（`で囲まれた部分）
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // 太字処理
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // 斜体処理  
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // リンク処理
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      // 改行処理
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
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

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(to bottom, #e0f2fe, #f0f9ff);
        color: #1f2937;
        line-height: 1.6;
        min-height: 100vh;
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
        padding: 2rem;
      }

      .conversation {
        background: white;
        border-radius: 1rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        padding: 2rem;
      }

      .message {
        margin-bottom: 1.5rem;
        display: flex;
        align-items: flex-start;
        gap: 1rem;
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
        padding: 1rem 1.25rem;
        border-radius: 1rem;
        background: #f3f4f6;
        position: relative;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
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
    `;
  }

  // セッション一覧のパース
  private parseSessionList(stdout: string): Array<{number: number, sessionId: string}> {
    const lines = stdout.split('\n');
    const sessions: Array<{number: number, sessionId: string}> = [];
    
    for (const line of lines) {
      // "1. -Users-junpeiwada-Documents-Project-ClaudeViewer" の形式を解析
      const match = line.match(/^(\d+)\.\s+.*Session:\s+([a-f0-9-]+)/);
      if (match) {
        sessions.push({
          number: parseInt(match[1]),
          sessionId: match[2].replace(/\.\.\.$/, '') // "..." を除去
        });
      }
    }
    
    return sessions;
  }

  // ファイル名からセッション番号を特定
  private async findSessionNumber(jsonlPath: string, projectDir: string): Promise<number> {
    return new Promise((resolve) => {
      try {
        const venvPath = '/Users/junpeiwada/Documents/Project/ClaudeViewer/claude-extractor-env';
        const claudeExtractPath = path.join(venvPath, 'bin', 'claude-extract');
        
        const listProcess = spawn(claudeExtractPath, ['--list', '--limit', '50'], {
          env: { ...process.env, PATH: `${path.join(venvPath, 'bin')}:${process.env.PATH}` },
          cwd: projectDir
        });

        let stdout = '';
        listProcess.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        listProcess.on('close', (code) => {
          if (code === 0) {
            // ファイル名からセッションIDを抽出
            const fileName = path.basename(jsonlPath, '.jsonl');
            const fileSessionId = fileName; // ファイル名がセッションID
            
            // セッション一覧をパース
            const lines = stdout.split('\n');
            for (const line of lines) {
              // セッション行の解析："1. ... Session: a3b6a6fd..."
              const match = line.match(/^(\d+)\.\s+.*Session:\s+([a-f0-9-]+)/);
              if (match) {
                const sessionNumber = parseInt(match[1]);
                const sessionIdPrefix = match[2];
                
                // ファイル名のセッションIDとマッチするかチェック
                if (fileSessionId.startsWith(sessionIdPrefix)) {
                  resolve(sessionNumber);
                  return;
                }
              }
            }
            
            // マッチするセッションが見つからない場合は1を返す
            console.warn(`セッション番号が見つかりません: ${fileName}, デフォルトで1を使用`);
            resolve(1);
          } else {
            resolve(1); // エラー時はデフォルトで1
          }
        });
      } catch (error) {
        console.error('セッション番号特定エラー:', error);
        resolve(1); // エラー時はデフォルトで1
      }
    });
  }
}

// アプリケーション起動
new ClaudeViewer();
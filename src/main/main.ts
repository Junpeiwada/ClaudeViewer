import { app, BrowserWindow, nativeTheme, Menu, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

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
        preload: path.join(__dirname, '../../renderer/renderer/preload.js'),
      },
      show: false, // 準備完了後に表示
    });

    // HTMLファイルの読み込み
    this.mainWindow.loadFile(path.join(__dirname, '../../renderer/renderer/index.html'));

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
  }
}

// アプリケーション起動
new ClaudeViewer();
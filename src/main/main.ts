import { app, BrowserWindow, nativeTheme, Menu } from 'electron';
import * as path from 'path';

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
}

// アプリケーション起動
new ClaudeViewer();
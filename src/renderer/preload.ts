import { contextBridge, ipcRenderer } from 'electron';

// レンダラープロセスに安全にAPIを公開
contextBridge.exposeInMainWorld('electronAPI', {
  // テーマ関連
  getTheme: () => ({
    shouldUseDarkColors: ipcRenderer.sendSync('get-theme'),
  }),
  
  onThemeChanged: (callback: (theme: { shouldUseDarkColors: boolean }) => void) => {
    ipcRenderer.on('theme-changed', (_, theme) => callback(theme));
  },

  // アプリ情報
  getVersion: () => ipcRenderer.sendSync('get-version'),
  
  // ファイルシステム関連（今後実装）
  // selectDirectory: () => ipcRenderer.invoke('select-directory'),
  // readDirectory: (path: string) => ipcRenderer.invoke('read-directory', path),
});

// TypeScript用の型定義
declare global {
  interface Window {
    electronAPI: {
      getTheme: () => { shouldUseDarkColors: boolean };
      onThemeChanged: (callback: (theme: { shouldUseDarkColors: boolean }) => void) => void;
      getVersion: () => string;
    };
  }
}
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
  onDebugLog: (callback: (message: string) => void) => {
    ipcRenderer.on('debug-log', (_, message) => callback(message));
  },

  // アプリ情報
  getVersion: () => ipcRenderer.sendSync('get-version'),

  // ファイルシステム関連
  getProjects: () => ipcRenderer.invoke('get-projects'),
  getProjectFiles: (projectPath: string) => ipcRenderer.invoke('get-project-files', projectPath),

  // エラーハンドリング
  showErrorDialog: (title: string, message: string) =>
    ipcRenderer.invoke('show-error-dialog', title, message),

  // システム操作
  showInFinder: (filePath: string) => ipcRenderer.invoke('show-in-finder', filePath),

  // ファイル変換（新しいTypeScript版）
  convertJsonlToMd: (jsonlPath: string) => ipcRenderer.invoke('convert-jsonl-to-md', jsonlPath),
  convertMdToHtml: (mdContent: string) => ipcRenderer.invoke('convert-md-to-html', mdContent),

  // ファイル操作
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
});

// TypeScript用の型定義
export interface Project {
  name: string;
  path: string;
}

export interface ConversationFile {
  name: string;
  date: string;
  size: string;
  fullPath: string;
  mtime: Date;
}

declare global {
  interface Window {
    electronAPI: {
      getTheme: () => { shouldUseDarkColors: boolean };
      onThemeChanged: (callback: (theme: { shouldUseDarkColors: boolean }) => void) => void;
      onDebugLog: (callback: (message: string) => void) => void;
      getVersion: () => string;
      getProjects: () => Promise<Project[]>;
      getProjectFiles: (projectPath: string) => Promise<ConversationFile[]>;
      showErrorDialog: (title: string, message: string) => Promise<void>;
      showInFinder: (filePath: string) => Promise<void>;
      convertJsonlToMd: (
        jsonlPath: string
      ) => Promise<{ success: boolean; mdContent?: string; error?: string }>;
      convertMdToHtml: (
        mdContent: string
      ) => Promise<{ success: boolean; html?: string; error?: string }>;
      readFile: (filePath: string) => Promise<string>;
    };
  }
}

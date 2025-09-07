// レンダラープロセス（フロントエンド）のメインファイル
import { mockProjects, mockFiles, Project, ConversationFile } from './mockData';

class ClaudeViewerRenderer {
  private statusText: HTMLElement | null = null;
  private themeIndicator: HTMLElement | null = null;
  private selectionInfo: HTMLElement | null = null;
  private projectList: HTMLElement | null = null;
  private fileListBody: HTMLElement | null = null;
  private fileCount: HTMLElement | null = null;
  // projectSelectorは削除（プロジェクト一覧から直接選択）

  private selectedProject: Project | null = null;
  private selectedFile: ConversationFile | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // DOM要素の取得
    this.statusText = document.getElementById('status-text');
    this.themeIndicator = document.getElementById('theme-indicator');
    this.selectionInfo = document.getElementById('selection-info');
    this.projectList = document.getElementById('project-list');
    this.fileListBody = document.getElementById('file-list-body');
    this.fileCount = document.getElementById('file-count');
    // projectSelectorは削除

    // 初期化処理
    await this.initializeApp();
    this.setupThemeHandling();
    this.setupEventListeners();
    this.loadProjects();
    this.updateStatus('Ready');
  }

  private async initializeApp(): Promise<void> {
    try {
      this.updateStatus('アプリケーション初期化完了');
    } catch (error) {
      console.error('初期化エラー:', error);
      this.updateStatus('初期化エラー');
    }
  }

  private setupEventListeners(): void {
    // ツールバーボタンのイベント
    const refreshBtn = document.getElementById('refresh-btn');
    const settingsBtn = document.getElementById('settings-btn');
    
    refreshBtn?.addEventListener('click', () => {
      this.refreshProjects();
    });
    
    settingsBtn?.addEventListener('click', () => {
      this.openSettings();
    });

    // プロジェクト選択はサイドバーのクリックのみで対応
  }

  private loadProjects(): void {
    console.log('loadProjects called');
    console.log('projectList element:', this.projectList);
    console.log('mockProjects:', mockProjects);
    
    if (!this.projectList) {
      console.error('projectList element not found!');
      return;
    }

    // プロジェクト一覧をクリア
    this.projectList.innerHTML = '';
    
    // サイドバーにプロジェクトを追加
    mockProjects.forEach(project => {
      const projectElement = document.createElement('div');
      projectElement.className = 'project-item';
      projectElement.innerHTML = `
        <span class="project-icon">📁</span>
        <span class="project-name">${project.name}</span>
      `;
      
      projectElement.addEventListener('click', () => {
        this.selectProject(project);
      });
      
      if (this.projectList) {
        this.projectList.appendChild(projectElement);
      }
    });
  }

  private selectProject(project: Project): void {
    this.selectedProject = project;
    
    // プロジェクト選択状態を更新
    document.querySelectorAll('.project-item').forEach(item => {
      item.classList.remove('selected');
    });
    
    const projectElements = Array.from(document.querySelectorAll('.project-item'));
    const selectedElement = projectElements.find(element => 
      element.querySelector('.project-name')?.textContent === project.name
    );
    selectedElement?.classList.add('selected');
    
    // ファイル一覧を読み込み
    this.loadFiles();
    
    // ステータス更新
    this.updateSelectionInfo();
  }

  // selectProjectByNameメソッドは削除（ドロップダウン削除に伴い）

  private loadFiles(): void {
    if (!this.fileListBody || !this.selectedProject) return;

    // ファイル一覧をクリア
    this.fileListBody.innerHTML = '';
    
    // モックファイル一覧を表示
    mockFiles.forEach(file => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>📄 ${file.name}</td>
        <td>${file.date}</td>
        <td>${file.size}</td>
      `;
      
      row.addEventListener('click', () => {
        this.selectFile(file);
      });
      
      row.addEventListener('dblclick', () => {
        this.openFile(file);
      });
      
      if (this.fileListBody) {
        this.fileListBody.appendChild(row);
      }
    });

    // ファイル数を更新
    if (this.fileCount) {
      this.fileCount.textContent = `${mockFiles.length} files`;
    }
  }

  private selectFile(file: ConversationFile): void {
    this.selectedFile = file;
    
    // ファイル選択状態を更新
    document.querySelectorAll('.file-list tbody tr').forEach(row => {
      row.classList.remove('selected');
    });
    
    const fileRows = Array.from(document.querySelectorAll('.file-list tbody tr'));
    const selectedRow = fileRows.find(row => 
      row.textContent?.includes(file.name)
    );
    selectedRow?.classList.add('selected');
    
    this.updateSelectionInfo();
  }

  private openFile(file: ConversationFile): void {
    // TODO: Phase 7で実装予定 - モーダル表示
    console.log(`Opening file: ${file.name}`);
    this.updateStatus(`ファイル開く: ${file.name}`);
    
    // 仮の動作確認
    setTimeout(() => {
      this.updateStatus('Ready');
    }, 1000);
  }

  private refreshProjects(): void {
    this.updateStatus('更新中...');
    
    // 仮の更新処理
    setTimeout(() => {
      this.loadProjects();
      this.updateStatus('更新完了');
      setTimeout(() => this.updateStatus('Ready'), 1000);
    }, 500);
  }

  private openSettings(): void {
    // TODO: Phase 9で実装予定 - 設定ダイアログ
    this.updateStatus('設定画面（未実装）');
    setTimeout(() => this.updateStatus('Ready'), 1000);
  }

  private updateSelectionInfo(): void {
    if (!this.selectionInfo) return;
    
    let info = '';
    if (this.selectedProject) {
      info = `${this.selectedProject.name}`;
      if (this.selectedFile) {
        info += ` - ${this.selectedFile.name}`;
      }
    } else {
      info = 'プロジェクト未選択';
    }
    
    this.selectionInfo.textContent = info;
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
    // テーマステータスの表示は不要（UI改修により削除）
    
    if (this.themeIndicator) {
      this.themeIndicator.textContent = isDark ? '🌙' : '☀️';
    }
  }

  private updateStatus(message: string): void {
    const statusMessage = document.getElementById('status-message');
    if (statusMessage) {
      statusMessage.textContent = message;
    }
    console.log(`[Status] ${message}`);
  }
}

// DOM読み込み完了後にアプリケーション開始
document.addEventListener('DOMContentLoaded', () => {
  new ClaudeViewerRenderer();
});
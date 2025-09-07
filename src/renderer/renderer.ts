import './styles.css';

// 型定義
interface Project {
  name: string;
  path: string;
}

interface ConversationFile {
  name: string;
  date: string;
  size: string;
  fullPath: string;
  mtime: Date;
}

// アプリケーション状態
let projects: Project[] = [];
let selectedProject: Project | null = null;
let selectedFile: ConversationFile | null = null;
let currentSort = { column: 'date', ascending: false };
let currentFiles: ConversationFile[] = [];
let contextMenuTarget: { path: string; isFile: boolean } | null = null;

// ステータス更新
function updateStatus(message: string): void {
  const statusElement = document.getElementById('status-message');
  if (statusElement) {
    statusElement.textContent = message;
  }
}

// 選択情報更新
function updateSelectionInfo(): void {
  const selectionElement = document.getElementById('selection-info');
  if (!selectionElement) return;

  let info = '';
  if (selectedProject) {
    const fileCount = currentFiles.length;
    info = `${selectedProject.name} - ${fileCount} files`;
    if (selectedFile) {
      info += ` - ${selectedFile.name}`;
    }
  } else {
    info = 'プロジェクト未選択';
  }
  selectionElement.textContent = info;
}

// プロジェクト一覧読み込み
async function loadProjects(): Promise<void> {
  const projectList = document.getElementById('project-list');
  if (!projectList) return;

  try {
    updateStatus('プロジェクト検索中...');
    projects = await window.electronAPI.getProjects();
    projectList.innerHTML = '';

    if (projects.length === 0) {
      await window.electronAPI.showErrorDialog(
        'Claude Projectsが見つかりません',
        'Claude Codeを使用していますか?\n~/.claude/projects フォルダが見つかりません。'
      );
      updateStatus('プロジェクトが見つかりません');
      return;
    }

    projects.forEach(project => {
      const projectElement = document.createElement('div');
      projectElement.className = 'project-item';
      projectElement.innerHTML = `
        <span class="project-icon">📁</span>
        <span class="project-name">${project.name}</span>
      `;

      projectElement.addEventListener('click', () => {
        selectProject(project);
      });

      projectElement.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, project.path, false);
      });

      projectList.appendChild(projectElement);
    });

    updateStatus(`${projects.length}個のプロジェクトが見つかりました`);
    setTimeout(() => updateStatus('Ready'), 1500);
  } catch (error) {
    console.error('Error loading projects:', error);
    updateStatus('プロジェクト読み込みエラー');
  }
}

// プロジェクト選択
async function selectProject(project: Project): Promise<void> {
  selectedProject = project;
  selectedFile = null;

  document.querySelectorAll('.project-item').forEach(item => {
    item.classList.remove('selected');
  });

  const projectElements = Array.from(document.querySelectorAll('.project-item'));
  const selectedElement = projectElements.find(element =>
    element.querySelector('.project-name')?.textContent === project.name
  );
  selectedElement?.classList.add('selected');

  await loadFiles();
  updateSelectionInfo();
}

// ファイル一覧読み込み
async function loadFiles(): Promise<void> {
  const fileListBody = document.getElementById('file-list-body');
  if (!fileListBody || !selectedProject) return;

  try {
    updateStatus(`${selectedProject.name} のファイルを読み込み中...`);
    currentFiles = await window.electronAPI.getProjectFiles(selectedProject.path);
    fileListBody.innerHTML = '';

    if (currentFiles.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td colspan="3" style="text-align: center; color: var(--text-secondary); padding: 2rem;">
          JSONLファイルが見つかりません
        </td>
      `;
      fileListBody.appendChild(row);
      updateStatus('ファイルが見つかりません');
      return;
    }

    const sortedFiles = sortFiles(currentFiles, currentSort.column, currentSort.ascending);
    
    sortedFiles.forEach(file => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>📄 ${file.name}</td>
        <td>${file.date}</td>
        <td>${file.size}</td>
      `;

      row.addEventListener('click', () => {
        selectFile(file);
      });

      row.addEventListener('dblclick', async () => {
        await openFile(file);
      });

      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, file.fullPath, true);
      });

      fileListBody.appendChild(row);
    });

    updateSortHeaders();
    updateStatus(`${currentFiles.length}個のファイルを読み込みました`);
    setTimeout(() => updateStatus('Ready'), 1500);
  } catch (error) {
    console.error('Error loading files:', error);
    updateStatus('ファイル読み込みエラー');
  }
}

// ファイル選択
function selectFile(file: ConversationFile): void {
  selectedFile = file;

  document.querySelectorAll('.file-list tbody tr').forEach(row => {
    row.classList.remove('selected');
  });

  const fileRows = Array.from(document.querySelectorAll('.file-list tbody tr'));
  const selectedRow = fileRows.find(row =>
    row.textContent?.includes(file.name)
  );
  selectedRow?.classList.add('selected');

  updateSelectionInfo();
}

// ファイルを開く（変換・表示）
async function openFile(file: ConversationFile): Promise<void> {
  try {
    updateStatus(`変換準備中: ${file.name}`);
    
    const outputDir = '/tmp/claude-viewer-conversion';
    updateStatus(`変換中: ${file.name}`);
    
    const result = await window.electronAPI.convertJsonlToMd(file.fullPath, outputDir);
    
    if (result.success && result.mdPath) {
      updateStatus(`変換完了: ${file.name}`);
      
      // 簡単なモーダル表示（後でHTML変換機能を追加）
      showHtmlModal(file.name, `
        <div style="padding: 2rem;">
          <h2>✅ 変換成功</h2>
          <p><strong>ファイル:</strong> ${file.name}</p>
          <p><strong>MDファイル:</strong> ${result.mdPath}</p>
          <p>変換は正常に完了しました。</p>
        </div>
      `);
      
      updateStatus(`表示完了: ${file.name}`);
      setTimeout(() => updateStatus('Ready'), 2000);
    } else {
      throw new Error(result.error || '変換に失敗しました');
    }
  } catch (error) {
    console.error('File conversion error:', error);
    updateStatus('変換エラー');
    await window.electronAPI.showErrorDialog(
      '変換エラー',
      `ファイルの変換に失敗しました:\n${error.message || error}`
    );
    setTimeout(() => updateStatus('Ready'), 1000);
  }
}

// ソート機能
function sortFiles(files: ConversationFile[], column: string, ascending: boolean): ConversationFile[] {
  return [...files].sort((a, b) => {
    let valueA: any, valueB: any;

    switch (column) {
      case 'name':
        valueA = a.name.toLowerCase();
        valueB = b.name.toLowerCase();
        break;
      case 'date':
        if (a.mtime && b.mtime) {
          valueA = new Date(a.mtime);
          valueB = new Date(b.mtime);
        } else {
          valueA = new Date(a.date.replace(' ', 'T'));
          valueB = new Date(b.date.replace(' ', 'T'));
        }
        break;
      case 'size':
        valueA = parseFloat(a.size.replace('MB', ''));
        valueB = parseFloat(b.size.replace('MB', ''));
        break;
      default:
        return 0;
    }

    if (valueA < valueB) return ascending ? -1 : 1;
    if (valueA > valueB) return ascending ? 1 : -1;
    return 0;
  });
}

// ソートヘッダー更新
function updateSortHeaders(): void {
  document.querySelectorAll('.sortable').forEach(th => {
    th.classList.remove('active');
    const arrow = th.querySelector('.sort-arrow') as HTMLElement;
    if (arrow) arrow.textContent = '';
  });

  const activeHeader = document.querySelector(`[data-sort="${currentSort.column}"]`);
  if (activeHeader) {
    activeHeader.classList.add('active');
    const arrow = activeHeader.querySelector('.sort-arrow') as HTMLElement;
    if (arrow) {
      arrow.textContent = currentSort.ascending ? '▲' : '▼';
    }
  }
}

// コンテキストメニュー表示
function showContextMenu(x: number, y: number, targetPath: string, isFile = true): void {
  const contextMenu = document.getElementById('context-menu');
  if (!contextMenu) return;

  contextMenuTarget = { path: targetPath, isFile };

  const rect = document.body.getBoundingClientRect();
  const menuWidth = 150;
  const menuHeight = 50;

  const adjustedX = Math.min(x, rect.width - menuWidth);
  const adjustedY = Math.min(y, rect.height - menuHeight);

  contextMenu.style.left = adjustedX + 'px';
  contextMenu.style.top = adjustedY + 'px';
  contextMenu.style.display = 'block';
}

// コンテキストメニュー非表示
function hideContextMenu(): void {
  const contextMenu = document.getElementById('context-menu');
  if (contextMenu) {
    contextMenu.style.display = 'none';
  }
  contextMenuTarget = null;
}

// HTMLモーダル表示
function showHtmlModal(fileName: string, htmlContent: string): void {
  const modal = document.getElementById('html-modal');
  const modalFileName = document.getElementById('modal-file-name');
  const modalHtmlContent = document.getElementById('modal-html-content');

  if (!modal || !modalFileName || !modalHtmlContent) return;

  modalFileName.textContent = fileName;
  modalHtmlContent.innerHTML = htmlContent;
  modal.style.display = 'block';
}

// HTMLモーダル非表示
function hideHtmlModal(): void {
  const modal = document.getElementById('html-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// テーマ更新
function updateTheme(): void {
  const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

  const themeIndicator = document.getElementById('theme-indicator');
  if (themeIndicator) {
    themeIndicator.textContent = isDark ? '🌙' : '☀️';
  }
}

// DOM読み込み完了時の初期化
document.addEventListener('DOMContentLoaded', () => {
  // ボタンイベント
  const refreshBtn = document.getElementById('refresh-btn');
  const settingsBtn = document.getElementById('settings-btn');

  refreshBtn?.addEventListener('click', async () => {
    updateStatus('更新中...');
    try {
      await loadProjects();
      updateStatus('更新完了');
      setTimeout(() => updateStatus('Ready'), 1000);
    } catch (error) {
      console.error('Error refreshing projects:', error);
      updateStatus('更新エラー');
    }
  });

  settingsBtn?.addEventListener('click', () => {
    updateStatus('設定画面（未実装）');
    setTimeout(() => updateStatus('Ready'), 1000);
  });

  // ソートイベント
  document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const column = th.getAttribute('data-sort');
      if (!column) return;

      if (currentSort.column === column) {
        currentSort.ascending = !currentSort.ascending;
      } else {
        currentSort.column = column;
        currentSort.ascending = false;
      }

      if (selectedProject) {
        loadFiles();
      }
    });
  });

  // コンテキストメニューイベント
  const contextShowInFinder = document.getElementById('context-show-in-finder');
  contextShowInFinder?.addEventListener('click', async () => {
    if (contextMenuTarget && contextMenuTarget.path) {
      await window.electronAPI.showInFinder(contextMenuTarget.path);
      updateStatus(`Finderで表示: ${contextMenuTarget.path.split('/').pop()}`);
      setTimeout(() => updateStatus('Ready'), 1500);
    }
    hideContextMenu();
  });

  document.addEventListener('click', () => {
    hideContextMenu();
  });

  // モーダルイベント
  const modalClose = document.getElementById('modal-close');
  const modalOverlay = document.querySelector('.modal-overlay');

  modalClose?.addEventListener('click', () => {
    hideHtmlModal();
  });

  modalOverlay?.addEventListener('click', () => {
    hideHtmlModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideContextMenu();
      hideHtmlModal();
    }
  });

  // テーマ初期化
  updateTheme();
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateTheme);
  }

  // アプリ初期化
  loadProjects();
  updateStatus('Ready');
});
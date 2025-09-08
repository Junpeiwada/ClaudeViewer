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

interface TreeNode {
  id: string;
  name: string;
  type: 'project' | 'file';
  expanded?: boolean;
  children?: TreeNode[];
  filePath?: string;
  fileData?: ConversationFile;
}

// アプリケーション状態
let projects: Project[] = [];
let selectedProject: Project | null = null;
let selectedFile: ConversationFile | null = null;
let currentSort = { column: 'date', ascending: false };
let currentFiles: ConversationFile[] = [];
let contextMenuTarget: { path: string; isFile: boolean } | null = null;

// Tree View用の状態管理
let treeData: TreeNode[] = [];
let selectedNode: TreeNode | null = null;
let currentHtmlContent: string = '';
let isConverting: boolean = false;

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

// Tree構造の構築
async function buildTreeStructure(): Promise<void> {
  try {
    updateStatus('Tree構造構築中...');
    projects = await window.electronAPI.getProjects();
    
    if (projects.length === 0) {
      await window.electronAPI.showErrorDialog(
        'Claude Projectsが見つかりません',
        'Claude Codeを使用していますか?\n~/.claude/projects フォルダが見つかりません。'
      );
      updateStatus('プロジェクトが見つかりません');
      return;
    }

    // Tree構造データを構築
    treeData = [];
    for (const project of projects) {
      const projectNode: TreeNode = {
        id: `project-${project.name}`,
        name: project.name,
        type: 'project',
        expanded: false,
        children: [],
        filePath: project.path
      };

      // プロジェクト内のファイルを取得
      const files = await window.electronAPI.getProjectFiles(project.path);
      for (const file of files) {
        const fileNode: TreeNode = {
          id: `file-${project.name}-${file.name}`,
          name: file.name,
          type: 'file',
          filePath: file.fullPath,
          fileData: file
        };
        projectNode.children!.push(fileNode);
      }

      treeData.push(projectNode);
    }

    renderTreeView();
    updateStatus(`${projects.length}個のプロジェクトが見つかりました`);
    setTimeout(() => updateStatus('Ready'), 1500);
  } catch (error) {
    console.error('Error building tree structure:', error);
    updateStatus('Tree構築エラー');
  }
}

// 古いloadProjects関数は削除（Tree View版で置換済み）

// Tree View描画
function renderTreeView(): void {
  const projectList = document.getElementById('project-list');
  if (!projectList) return;

  projectList.innerHTML = '';
  
  for (const node of treeData) {
    const projectElement = createTreeNodeElement(node);
    projectList.appendChild(projectElement);
  }
}

// Tree Node要素作成
function createTreeNodeElement(node: TreeNode): HTMLElement {
  const nodeElement = document.createElement('div');
  nodeElement.className = `tree-node tree-${node.type}`;
  nodeElement.setAttribute('data-node-id', node.id);
  
  if (node.type === 'project') {
    // プロジェクトノード
    const expandIcon = node.expanded ? '📂' : '📁';
    const expanderClass = node.expanded ? 'expanded' : 'collapsed';
    const fileCount = node.children?.length || 0;
    
    nodeElement.innerHTML = `
      <div class="tree-node-content project-node">
        <span class="tree-expander ${expanderClass}">${node.expanded ? '▼' : '▶'}</span>
        <span class="tree-icon">${expandIcon}</span>
        <span class="tree-label">${node.name}</span>
        <span class="tree-badge">${fileCount}</span>
      </div>
    `;
    
    // 展開/折り畳みイベント
    const expanderElement = nodeElement.querySelector('.tree-expander');
    expanderElement?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleProjectExpansion(node);
    });
    
    // プロジェクト選択イベント
    nodeElement.addEventListener('click', () => {
      selectTreeProject(node);
    });
    
    // 子ノード（ファイル）の描画
    if (node.expanded && node.children) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-children';
      
      for (const child of node.children) {
        const childElement = createTreeNodeElement(child);
        childrenContainer.appendChild(childElement);
      }
      
      nodeElement.appendChild(childrenContainer);
    }
  } else {
    // ファイルノード
    const fileData = node.fileData;
    const sessionId = node.name.substring(0, 8);
    
    nodeElement.innerHTML = `
      <div class="tree-node-content file-node ${selectedNode?.id === node.id ? 'selected' : ''}">
        <span class="tree-indent"></span>
        <span class="tree-icon">📄</span>
        <span class="tree-label">${sessionId}...</span>
        <span class="tree-meta">${fileData?.date || ''}</span>
      </div>
    `;
    
    // ファイル選択イベント
    nodeElement.addEventListener('click', () => {
      selectTreeFile(node);
    });
    
    // 右クリックメニュー
    nodeElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, node.filePath || '', true);
    });
  }
  
  return nodeElement;
}

// プロジェクトの展開/折り畳み
function toggleProjectExpansion(projectNode: TreeNode): void {
  projectNode.expanded = !projectNode.expanded;
  renderTreeView();
}

// Tree経由でのプロジェクト選択
function selectTreeProject(projectNode: TreeNode): void {
  if (!projectNode.expanded) {
    projectNode.expanded = true;
    renderTreeView();
  }
}

// Tree経由でのファイル選択
async function selectTreeFile(fileNode: TreeNode): Promise<void> {
  if (isConverting) return; // 変換中は無視
  
  // 前の選択をクリア
  if (selectedNode) {
    selectedNode = null;
  }
  
  selectedNode = fileNode;
  renderTreeView(); // 選択状態の更新
  
  if (fileNode.fileData) {
    await displayHtmlInline(fileNode.fileData);
  }
}

// インラインHTML表示（新機能）
async function displayHtmlInline(file: ConversationFile): Promise<void> {
  if (isConverting) return;
  
  try {
    isConverting = true;
    updateStatus(`🔄 変換中: ${file.name}`);
    
    const htmlContentArea = document.getElementById('html-content-area');
    if (!htmlContentArea) return;
    
    // 即座変換・表示
    const mdResult = await window.electronAPI.convertJsonlToMd(file.fullPath);
    
    if (mdResult.success && mdResult.mdContent) {
      const messageCount = (mdResult.mdContent.match(/## 👤|## 🤖/g) || []).length;
      updateStatus(`🎨 HTML変換中: ${file.name} (${messageCount}メッセージ)`);
      
      const htmlResult = await window.electronAPI.convertMdToHtml(mdResult.mdContent);
      
      if (htmlResult.success && htmlResult.html) {
        currentHtmlContent = htmlResult.html;
        htmlContentArea.innerHTML = htmlResult.html;
        
        // スクロール位置を一番上にリセット
        htmlContentArea.scrollTop = 0;
        htmlContentArea.scrollLeft = 0;
        
        // より確実なスクロールリセット（複数レベル）
        setTimeout(() => {
          htmlContentArea.scrollTo(0, 0);
          
          // 親コンテナもリセット
          const container = htmlContentArea.parentElement;
          if (container) {
            container.scrollTop = 0;
            container.scrollLeft = 0;
          }
          
          // HTML内部のbody要素もリセット
          const bodyElement = htmlContentArea.querySelector('body');
          if (bodyElement) {
            bodyElement.scrollTo(0, 0);
          }
          
          console.log('✅ Scroll position reset to top');
        }, 50);
        
        // テキスト選択を有効化
        enableTextSelection(htmlContentArea);
        
        updateStatus(`✅ 表示完了: ${file.name} (${messageCount}メッセージ)`);
        updateSelectionInfo();
        setTimeout(() => updateStatus('Ready'), 2000);
      } else {
        throw new Error(htmlResult.error || 'HTML変換に失敗しました');
      }
    } else {
      throw new Error(mdResult.error || 'JSONL変換に失敗しました');
    }
  } catch (error) {
    console.error('Inline HTML display error:', error);
    updateStatus('❌ 変換エラー');
    const htmlContentArea = document.getElementById('html-content-area');
    if (htmlContentArea) {
      htmlContentArea.innerHTML = `<div class="error-message">変換エラー: ${error.message}</div>`;
    }
  } finally {
    isConverting = false;
  }
}

// HTML領域のテキスト選択有効化
function enableTextSelection(element: HTMLElement): void {
  element.style.userSelect = 'text';
  (element.style as any).webkitUserSelect = 'text';
  (element.style as any).mozUserSelect = 'text';
  (element.style as any).msUserSelect = 'text';
  
  // すべての子要素にも適用
  const allElements = element.querySelectorAll('*');
  allElements.forEach(el => {
    const htmlEl = el as HTMLElement;
    if (!htmlEl.matches('button, .btn, summary')) {
      htmlEl.style.userSelect = 'text';
      (htmlEl.style as any).webkitUserSelect = 'text';
      (htmlEl.style as any).mozUserSelect = 'text';
      (htmlEl.style as any).msUserSelect = 'text';
    }
  });
}

// 古いloadProjects関数は削除済み（Tree View版で置換）

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
    // 📊 Step 1: 変換準備
    updateStatus(`🔍 解析準備中: ${file.name}`);
    console.log(`Starting enhanced conversion: ${file.name} (${file.fullPath})`);
    
    // ファイルサイズに応じた処理時間の予測表示
    const fileSizeMB = parseFloat(file.size.replace('MB', ''));
    const estimatedTime = fileSizeMB > 5 ? '数秒' : fileSizeMB > 2 ? '1-2秒' : '1秒未満';
    updateStatus(`📈 JSONL解析中: ${file.name} (予想時間: ${estimatedTime})`);
    
    // Step 2: TypeScript版 JSONL→MD変換（改良版）
    const mdResult = await window.electronAPI.convertJsonlToMd(file.fullPath);
    console.log('Enhanced MD conversion result:', {
      success: mdResult.success,
      contentLength: mdResult.success ? mdResult.mdContent?.length : 'N/A',
      error: mdResult.error || 'None'
    });
    
    if (mdResult.success && mdResult.mdContent) {
      // シンプル化されたMD内容の分析
      const messageCount = (mdResult.mdContent.match(/## 👤|## 🤖/g) || []).length;
      const codeBlocks = (mdResult.mdContent.match(/```/g) || []).length / 2; // 開始・終了ペア
      
      updateStatus(`🎨 HTML変換中: ${file.name} (${messageCount}メッセージ, ${codeBlocks}コードブロック)`);
      console.log(`Simplified MD analysis: ${messageCount} messages, ${codeBlocks} code blocks`);
      
      // Step 3: MD→HTML変換
      const htmlResult = await window.electronAPI.convertMdToHtml(mdResult.mdContent);
      console.log('Enhanced HTML conversion result:', htmlResult.success ? 'Success' : htmlResult.error);
      
      if (htmlResult.success && htmlResult.html) {
        updateStatus(`✨ 表示準備完了: ${file.name}`);
        
        // Step 4: 改善されたHTMLモーダル表示
        showHtmlModal(file.name, htmlResult.html);
        
        updateStatus(`🎉 表示完了: ${file.name} (${messageCount}メッセージ)`);
        setTimeout(() => updateStatus('Ready'), 3000);
      } else {
        throw new Error(htmlResult.error || 'HTML変換に失敗しました');
      }
    } else {
      throw new Error(mdResult.error || 'JSONL変換に失敗しました');
    }
  } catch (error) {
    console.error('Enhanced file conversion error:', error);
    updateStatus('❌ 変換エラー');
    await window.electronAPI.showErrorDialog(
      '変換エラー',
      `改善された変換処理でエラーが発生しました:\n${error.message || error}\n\nツール実行結果の処理中にエラーが発生した可能性があります。`
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

// HTMLモーダル表示（テキスト選択対応改善）
function showHtmlModal(fileName: string, htmlContent: string): void {
  const modal = document.getElementById('html-modal');
  const modalFileName = document.getElementById('modal-file-name');
  const modalHtmlContent = document.getElementById('modal-html-content');

  if (!modal || !modalFileName || !modalHtmlContent) return;

  modalFileName.textContent = fileName;
  modalHtmlContent.innerHTML = htmlContent;
  
  // テキスト選択の有効化を確実に実行
  modalHtmlContent.style.userSelect = 'text';
  (modalHtmlContent.style as any).webkitUserSelect = 'text';
  (modalHtmlContent.style as any).mozUserSelect = 'text';
  (modalHtmlContent.style as any).msUserSelect = 'text';
  
  // 複数レベルでスクロール位置をリセット
  modalHtmlContent.scrollTop = 0;
  modalHtmlContent.scrollLeft = 0;
  
  // HTMLコンテンツの読み込み後にテキスト選択とスクロールを設定
  setTimeout(() => {
    modalHtmlContent.scrollTo(0, 0);
    
    // すべての子要素にもテキスト選択を適用
    const allElements = modalHtmlContent.querySelectorAll('*');
    allElements.forEach(element => {
      const el = element as HTMLElement;
      // ボタンや操作系要素以外はテキスト選択を有効化
      if (!el.matches('button, .modal-btn, summary, .modal-close')) {
        el.style.userSelect = 'text';
        (el.style as any).webkitUserSelect = 'text';
        (el.style as any).mozUserSelect = 'text';
        (el.style as any).msUserSelect = 'text';
      }
    });
    
    // 内部のHTMLページのbody要素もリセット
    const iframe = modalHtmlContent.querySelector('iframe') as HTMLIFrameElement;
    if (iframe?.contentDocument?.body) {
      iframe.contentDocument.body.scrollTo(0, 0);
    }
    
    console.log('✅ HTML modal displayed with text selection enabled');
  }, 100);
  
  modal.style.display = 'block';
}

// HTMLモーダル非表示
function hideHtmlModal(): void {
  const modal = document.getElementById('html-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// モーダル内容の全選択
function selectAllModalContent(): void {
  const modalHtmlContent = document.getElementById('modal-html-content');
  if (modalHtmlContent) {
    const range = document.createRange();
    range.selectNodeContents(modalHtmlContent);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    
    updateStatus('📋 全選択完了 (Cmd+C でコピー)');
    setTimeout(() => updateStatus('Ready'), 2000);
    
    console.log('✅ Modal content selected');
  }
}

// HTML領域の全選択
function selectAllHtmlContent(): void {
  const htmlContentArea = document.getElementById('html-content-area');
  if (htmlContentArea) {
    const range = document.createRange();
    range.selectNodeContents(htmlContentArea);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    
    updateStatus('📋 全選択完了 (Cmd+C でコピー)');
    setTimeout(() => updateStatus('Ready'), 2000);
    console.log('✅ HTML content selected');
  }
}

// HTML領域の選択内容をコピー
function copySelectedHtmlContent(): void {
  try {
    if (window.getSelection()?.toString()) {
      document.execCommand('copy');
      
      const selectedText = window.getSelection()?.toString();
      const charCount = selectedText?.length || 0;
      
      updateStatus(`✅ コピー完了 (${charCount}文字)`);
      setTimeout(() => updateStatus('Ready'), 2000);
      
      console.log(`✅ Copied ${charCount} characters to clipboard`);
    } else {
      updateStatus('⚠️ テキストが選択されていません');
      setTimeout(() => updateStatus('Ready'), 1500);
    }
  } catch (error) {
    console.error('Copy failed:', error);
    updateStatus('❌ コピーエラー');
    setTimeout(() => updateStatus('Ready'), 1500);
  }
}

// 選択されたモーダル内容をクリップボードにコピー（後方互換性）
function copySelectedModalContent(): void {
  try {
    if (window.getSelection()?.toString()) {
      // ブラウザの標準的なコピー機能を使用
      document.execCommand('copy');
      
      const selectedText = window.getSelection()?.toString();
      const charCount = selectedText?.length || 0;
      
      updateStatus(`✅ コピー完了 (${charCount}文字)`);
      setTimeout(() => updateStatus('Ready'), 2000);
      
      console.log(`✅ Copied ${charCount} characters to clipboard`);
    } else {
      updateStatus('⚠️ テキストが選択されていません');
      setTimeout(() => updateStatus('Ready'), 1500);
    }
  } catch (error) {
    console.error('Copy failed:', error);
    updateStatus('❌ コピーエラー');
    setTimeout(() => updateStatus('Ready'), 1500);
  }
}

// Tree Viewキーボードナビゲーション
function navigateTreeWithKeyboard(moveDown: boolean): void {
  if (treeData.length === 0) return;
  
  // 全てのナビゲート可能なノードを取得
  const allNodes: TreeNode[] = [];
  for (const project of treeData) {
    allNodes.push(project);
    if (project.expanded && project.children) {
      allNodes.push(...project.children);
    }
  }
  
  if (allNodes.length === 0) return;
  
  let currentIndex = selectedNode ? allNodes.findIndex(node => node.id === selectedNode!.id) : -1;
  
  if (moveDown) {
    currentIndex = currentIndex < allNodes.length - 1 ? currentIndex + 1 : 0;
  } else {
    currentIndex = currentIndex > 0 ? currentIndex - 1 : allNodes.length - 1;
  }
  
  const newSelectedNode = allNodes[currentIndex];
  
  if (newSelectedNode.type === 'file') {
    selectTreeFile(newSelectedNode);
  } else {
    selectedNode = newSelectedNode;
    renderTreeView();
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
  // デバッグログの受信
  window.electronAPI.onDebugLog((message: string) => {
    console.log('[DEBUG FROM MAIN]:', message);
  });

  // ボタンイベント
  const refreshBtn = document.getElementById('refresh-btn');
  const settingsBtn = document.getElementById('settings-btn');

  refreshBtn?.addEventListener('click', async () => {
    updateStatus('更新中...');
    try {
      await buildTreeStructure(); // 新しいTree構造で更新
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
  const modalSelectAll = document.getElementById('modal-select-all');
  const modalCopy = document.getElementById('modal-copy');

  modalClose?.addEventListener('click', () => {
    hideHtmlModal();
  });

  modalOverlay?.addEventListener('click', () => {
    hideHtmlModal();
  });

  modalSelectAll?.addEventListener('click', () => {
    selectAllModalContent();
  });

  modalCopy?.addEventListener('click', () => {
    copySelectedModalContent();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideContextMenu();
      hideHtmlModal();
    }
    
    // Tree View・HTML表示エリア用のキーボードショートカット
    const htmlContentArea = document.getElementById('html-content-area');
    
    // 全画面でのショートカット
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      // Cmd+A: HTML表示エリアが存在し、ウェルカム画面でない場合
      if (htmlContentArea && !htmlContentArea.querySelector('.welcome-html')) {
        e.preventDefault();
        selectAllHtmlContent();
      }
    }
    
    if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
      // Cmd+C: コピー
      if (htmlContentArea && !htmlContentArea.querySelector('.welcome-html')) {
        copySelectedHtmlContent();
      }
    }
    
    // Tree View ナビゲーション
    if (treeData.length > 0) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        navigateTreeWithKeyboard(e.key === 'ArrowDown');
      }
      
      if (e.key === 'Enter' || e.key === ' ') {
        if (selectedNode && selectedNode.type === 'file') {
          e.preventDefault();
          // 既に選択済みの場合は何もしない（重複防止）
        }
      }
      
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (selectedNode && selectedNode.type === 'project') {
          e.preventDefault();
          const shouldExpand = e.key === 'ArrowRight';
          if (selectedNode.expanded !== shouldExpand) {
            toggleProjectExpansion(selectedNode);
          }
        }
      }
    }
    
    // HTMLモーダル表示中のキーボードショートカット（後方互換性）
    const htmlModal = document.getElementById('html-modal');
    if (htmlModal && htmlModal.style.display === 'block') {
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        selectAllModalContent();
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        copySelectedModalContent();
      }
    }
  });

  // テーマ初期化
  updateTheme();
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateTheme);
  }

  // 新しいHTMLツールバーのイベント
  const htmlSelectAll = document.getElementById('html-select-all');
  const htmlCopy = document.getElementById('html-copy');
  const htmlExport = document.getElementById('html-export');
  const htmlSearch = document.getElementById('html-search');

  htmlSelectAll?.addEventListener('click', () => {
    selectAllHtmlContent();
  });

  htmlCopy?.addEventListener('click', () => {
    copySelectedHtmlContent();
  });

  htmlExport?.addEventListener('click', () => {
    updateStatus('エクスポート機能（未実装）');
    setTimeout(() => updateStatus('Ready'), 1000);
  });

  htmlSearch?.addEventListener('click', () => {
    updateStatus('検索機能（未実装）');
    setTimeout(() => updateStatus('Ready'), 1000);
  });

  // アプリ初期化（Tree View版）
  buildTreeStructure();
  updateStatus('Ready');
});
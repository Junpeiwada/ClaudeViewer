# Claude Code会話ログビューア

## 概要
Claude Codeのログファイル（jsonl形式）をHTMLビューアーで閲覧するElectronアプリケーション

## 主要機能

### 1. ファイル変換処理
- **claude-conversation-extractor**: 
  - MITライセンスで再頒布可能
  - PyInstallerでバイナリ化してアプリに同梱
  - Node.jsの子プロセス（spawn）として実行
  - コマンド: `claude-logs --extract <file> --output <output_file>`
- **MD→HTML変換**: TypeScriptで実装（参考: `/Users/junpeiwada/Documents/Project/AISandbox/claudecode-jsonl/claude_md_to_html.py`）
- **HTMLスタイル**: 既存実装と同等のデザイン（グラデーション、メッセージバブル、ツール結果の折りたたみ表示）

### 2. プロジェクト管理
- **ベースディレクトリ**: `~/.claude/projects`
- **プロジェクト検出**: フォルダ一覧を表示
- **エラーハンドリング**: projectsフォルダが存在しない場合はユーザーに通知

### 3. ファイル一覧機能
- **ソート**: クリック可能なカラムヘッダーによるソート
  - ファイル名順（昇順/降順）
  - 更新日時順（昇順/降順）- デフォルト：降順（最新が上）
  - ファイルサイズ順（昇順/降順）
  - ソート状態をカラムヘッダーに矢印で表示（▲▼）
- **表示項目**: ファイル名、更新日時、ファイルサイズ
- **フィルタリング**: jsonl形式のファイルのみ表示

### 4. 変換・表示機能
- **表示方式**: モーダルウィンドウでHTML表示
- **モーダル仕様**: 
  - サイズ: 画面の80%（最小: 800x600px）
  - 背景: 半透明オーバーレイ
  - 閉じる方法: Escキー、×ボタン、オーバーレイクリック
- **プログレス表示**: 大きなjsonlファイル処理時（1MB以上で表示）
  - 段階ベース: 「準備中...」→「変換中...」→「処理中...」→「完了」
  - 進捗率は段階ごとに更新（正確な%表示より動作確認を優先）
- **キャンセル機能**: 処理中断可能（SIGTERM送信）
- **ナビゲーション**: モーダル内で前後のファイルに移動可能
- **キャッシュシステム**: 
  - 変換済みHTMLをキャッシュ
  - jsonl更新時（mtime変更）はキャッシュ無効化
  - キャッシュ場所: `~/Library/Application Support/Claude Code Viewer/cache`（macOS）
  - キャッシュファイル名: `${projectName}_${fileHash}.html`

### 5. エクスポート機能
- **HTML**: 生成したHTMLファイルをエクスポート
- **PDF**: HTML→PDF変換（Electronの`webContents.printToPDF()`使用）
- **形式選択**: ダイアログでHTML/PDFを選択
- **保存先**: システムの「ダウンロード」フォルダがデフォルト
- **ファイル名**: `claude-conversation-${sessionId}-${date}.{html|pdf}`

### 6. エラーハンドリング
- claude-conversation-extractor実行失敗時の通知
- ファイル読み込みエラーの処理
- 変換処理中のエラー通知
- バイナリファイル不足時の警告

### 7. テーマシステム
- **自動切り替え**: システム設定（ダーク/ライト）に連動
- **API**: `nativeTheme.shouldUseDarkColors`
- **CSS変数**: テーマごとのカラーパレット定義
- **リアルタイム切り替え**: システム設定変更を即座に反映

### 8. 更新・リロード機能
- **手動リロード**: メニューまたはキーボードショートカット（Cmd+R）
- **プロジェクト一覧更新**: 新しいプロジェクト検出
- **ファイル一覧更新**: 新しいjsonlファイル検出
- **自動更新チェック**: アプリ起動時にGitHub Releasesをチェック

## 技術スタック
- **フレームワーク**: Electron
- **言語**: TypeScript
- **UI**: HTML/CSS（既存デザイン踏襲）
- **変換ツール**: claude-conversation-extractor（PyInstallerでバイナリ化）
- **HTML生成**: 自前実装（TypeScript）
- **ビルドツール**: electron-builder
- **テーマ**: システム設定連動（ダーク/ライト）
- **自動更新**: electron-updater（GitHub Releases）

## 配布・更新
### 1. 配布方法
- **プラットフォーム**: macOS (.dmg)
- **配布先**: GitHub Releases
- **ダウンロード**: 手動ダウンロード

### 2. 自動更新
- **ライブラリ**: electron-updater
- **更新チェック**: アプリ起動時
- **更新ソース**: GitHub Releases API
- **更新プロセス**: バックグラウンドダウンロード→再起動時適用

### 3. claude-conversation-extractor組み込み
- **バイナリ化**: PyInstaller使用
- **配置場所**: `resources/bin/claude-logs`（macOS）
- **実行方法**: child_process.spawn()
- **ライセンス表記**: アプリ内「About」画面に記載

## 開発・ビルド設定
### 1. プロジェクト構成
```
ClaudeViewer/
├── src/
│   ├── main/           # メインプロセス
│   ├── renderer/       # レンダラープロセス
│   └── shared/         # 共通ライブラリ
├── resources/
│   └── bin/
│       └── claude-logs # バイナリ
├── dist/              # ビルド出力
└── package.json
```

### 2. electron-builder設定
```json
{
  "build": {
    "appId": "com.example.claude-viewer",
    "productName": "Claude Code Viewer",
    "directories": {
      "output": "dist"
    },
    "files": [
      "src/**/*",
      "resources/**/*"
    ],
    "mac": {
      "category": "public.app-category.developer-tools",
      "target": "dmg"
    },
    "publish": {
      "provider": "github",
      "owner": "your-username",
      "repo": "claude-viewer"
    }
  }
}
```


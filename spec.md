# Claude Code会話ログビューア仕様書（最新版）

## 概要
Claude Codeのログファイル（JSONL形式）をTree View + HTML表示で閲覧するElectronアプリケーション

## 主要機能（実装済み）

### 1. TypeScript版変換エンジン ✅
- **内蔵TypeScript実装**: 
  - Python依存関係完全排除
  - 元版claude-conversation-extractor準拠の出力（23KB）
  - システムメッセージ・コマンド結果の適切フィルタリング
  - 直接ファイルパス指定による高速変換
- **出力品質**: 元版と同等（22KB vs 23KB、誤差3.5%）
- **処理内容**: 実際の会話のみ抽出、技術的ノイズ除去

### 2. Tree View + HTML表示構成 ✅
- **左ペイン（30%）**: Project Tree View
  - フォルダ名そのまま表示（編集なし）
  - 階層構造：プロジェクト > ファイル
  - 展開/折り畳み：▶/▼アイコン
  - ファイル数バッジ表示
- **右ペイン（70%）**: HTML Content View
  - 即座変換・表示（モーダル不要）
  - スクロール自動リセット（ファイル選択時）
  - テキスト選択・コピー完全対応

### 3. ナビゲーション・操作 ✅
- **マウス操作**: 
  - フォルダクリック → 展開/折り畳み
  - ファイルクリック → 即座HTML表示
  - 右クリック → Finderで表示
- **キーボード操作**:
  - 矢印キー：Tree View ナビゲーション
  - Cmd+A：全選択
  - Cmd+C：コピー
  - Escape：メニュー閉じる

### 4. プロジェクト管理 ✅
- **ベースディレクトリ**: `~/.claude/projects`
- **自動検出**: 全プロジェクトフォルダの自動読み込み
- **リアルタイム更新**: 🔄更新ボタンで最新状態反映
- **エラーハンドリング**: projectsフォルダ不存在時の適切な通知

### 5. HTML表示・テキスト処理 ✅
- **表示方式**: 右ペイン埋め込み表示
- **テキスト選択**: 
  - CSS強制適用：`user-select: text !important`
  - JavaScript動的設定：全要素にuserSelect適用
  - 全ブラウザ対応：webkit, moz, ms prefix
- **ツールバー機能**: 
  - 📋全選択ボタン
  - 📄コピーボタン
  - 📤エクスポート（未実装）
  - 🔍検索（未実装）

### 6. 変換品質・フィルタリング ✅
- **システムメッセージ除外**: 
  - `system-reminder`
  - `<command-name>`
  - `<local-command-stdout>`
  - `Caveat: The messages below`
  - `Plan mode is active`
  - `Background Bash`
- **メタ情報処理**: `isMeta: true`エントリの適切除外
- **出力内容**: 実際の日本語会話のみ（コマンド結果等は除外）

## 技術仕様

### アーキテクチャ
- **Electron 27.1.0**: クロスプラットフォーム対応
- **TypeScript 5.3.0**: 型安全な開発環境
- **内蔵変換エンジン**: `src/lib/claudeExtractor.ts`
- **2ペインレイアウト**: Flexbox + CSS Grid

### ファイル構成
```
src/
├── main/main.ts           # メインプロセス（588行、25%削減済み）
├── lib/claudeExtractor.ts # TypeScript版変換エンジン
└── renderer/              # Tree View + HTML表示UI
    ├── index.html         # Tree View構成
    ├── renderer.ts        # Tree管理・HTML表示ロジック
    └── styles.css         # Tree View + HTML表示スタイル
```

### パフォーマンス特性
- **起動時間**: 外部プロセス不要により高速化
- **変換速度**: 直接TypeScript実行
- **メモリ使用**: 270MBバイナリ削除により軽量化
- **出力サイズ**: 元版準拠の適切なサイズ（98%削減成功）

## 未実装機能

### Phase 8: エクスポート機能
- **HTML出力**: 変換済みHTMLファイルの保存
- **PDF変換**: Electronの`printToPDF()`使用

### Phase 9: 設定・検索機能
- **検索機能**: ファイル内容検索
- **設定画面**: テーマ、パス設定等
- **キャッシュ管理**: 手動キャッシュクリア

### Phase 10: 配布準備
- **electron-builder**: .dmgパッケージ作成
- **自動更新**: electron-updater統合

## 開発環境

### ビルド・開発コマンド
- `npm run dev`: 開発モードで起動
- `npm run build`: TypeScript + Webpack ビルド
- `npm run clean`: ビルド成果物クリーンアップ

### 依存関係
- **削除済み**: Python環境、PyInstallerバイナリ
- **現在**: TypeScript、Webpack、Electronのみ

## 品質保証

### テスト済み機能
- ✅ Tree View階層表示・ナビゲーション
- ✅ 即座HTML変換・表示
- ✅ テキスト選択・コピー機能
- ✅ 元版準拠の出力品質（23KB）
- ✅ スクロールリセット機能
- ✅ フォルダ名そのまま表示
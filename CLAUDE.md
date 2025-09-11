# CLAUDE.md

このファイルは、このリポジトリでのコード作業時にClaude Code (claude.ai/code) へのガイダンスを提供します。

### 重要

コードを書くときはフォールバックをしてはいけません。エラーにすべきで、そうしないとエラーがわからなくなってしまいます。意図した挙動をしない場合の処理は必ずエラーを出すようにしてください

## 開発コマンド

### ビルドと開発

- `npm run dev` - 開発モードでElectronアプリをビルド・起動
- `npm run build` - メインプロセスとレンダラープロセスの両方をビルド
- `npm run build:main` - メインプロセスのみビルド（TypeScript → JavaScript）
- `npm run build:renderer` - レンダラープロセスのみビルド（TypeScript → JavaScript）

### 開発ワークフロー

- `npm run watch` - メインとレンダラーの両方を監視（並列実行）
- `npm run watch:main` - メインプロセスファイルのみを監視
- `npm run watch:renderer` - レンダラープロセスファイルのみを監視

### コード品質

- `npm run lint` - TypeScriptファイルでESLintを実行
- `npm run lint:fix` - ESLintを自動修正付きで実行
- `npm run format` - Prettierでコードをフォーマット

### 配布

- `npm run dist` - 配布可能なパッケージをビルド・作成
- `npm run dist:mac` - macOS .dmgパッケージを作成
- `npm run clean` - distディレクトリをクリーン

### macOS DMGパッケージ作成手順

#### 1. ユニバーサルバイナリDMG作成

```bash
# フルビルドとDMGパッケージ作成
npm run dist:mac

# 出力ファイル: dist/build/Claude Code Viewer-1.0.0-universal.dmg
# サイズ: 約170MB (Intel + Apple Silicon両対応)
```

#### 2. 生成される配布ファイル

- **メイン配布ファイル**: `Claude Code Viewer-1.0.0-universal.dmg`
  - ユニバーサルバイナリ（Intel Mac + Apple Silicon対応）
  - 署名済み（macOSセキュリティ対応）
  - macOS 10.15 (Catalina) 以降で動作
- **Block Map**: `.dmg.blockmap`（差分更新用、自動生成）

#### 3. ビルド設定詳細

```json
{
  "mac": {
    "target": { "target": "dmg", "arch": "universal" },
    "mergeASARs": true,
    "category": "public.app-category.developer-tools",
    "icon": "icon/ClaudeViewer.icns"
  }
}
```

#### 4. 必要な前提条件

- **Node.js 18+** インストール済み
- **Xcode Command Line Tools** インストール済み
- **開発者証明書** (任意、署名用)
- **アイコンファイル**: `icon/ClaudeViewer.icns` 配置済み

#### 5. 配布ファイルのクリーンアップ

```bash
# 不要なビルドファイル削除（ユニバーサル版のみ保持）
cd dist/build
ls -la  # 配布ファイル確認
# 残すファイル: Claude Code Viewer-1.0.0-universal.dmg のみ
```

#### 6. 配布・インストール

- **配布方法**: DMGファイルをWebサイト・GitHubリリース等で公開
- **ユーザー側**: DMGダブルクリック → Applicationsフォルダにドラッグ
- **対応環境**: Intel Mac・Apple Silicon Mac両方で同一ファイル使用可能

## アーキテクチャ概要

このプロジェクトは、Claude Codeの会話ログ（JSONLファイル）をHTML表示機能付きで閲覧するElectronアプリケーションです。以下のドキュメントに従って開発されています:

- **`implPlan.md`**: 10フェーズに分かれた詳細な実装計画とタスク管理
- **`spec.md`**: アプリケーションの機能仕様と技術要件
- **`ui.md`**: UI/UXの詳細設計とインタラクション定義

### プロジェクト構造

```
src/
├── main/           # Electronメインプロセス（Node.jsバックエンド）
│   └── main.ts     # アプリケーションのメインエントリーポイント、ウィンドウ管理
├── renderer/       # Electronレンダラープロセス（フロントエンド）
│   ├── index.html  # メインUI HTMLテンプレート
│   ├── styles.css  # ダーク/ライトテーマ対応のアプリケーションスタイル
│   ├── renderer.ts # フロントエンドJavaScriptロジック
│   └── preload.ts  # メインとレンダラーの安全なブリッジ
dist/               # コンパイル済み出力ディレクトリ
```

### 主要技術

- **Electron 27.1.0** - クロスプラットフォームデスクトップアプリフレームワーク
- **TypeScript 5.3.0** - 型安全なJavaScript開発
- **ESLint + Prettier** - コード品質とフォーマット
- **electron-builder** - アプリのパッケージ化と配布
- **TypeScript版claude-extractor** - 内蔵JSONL会話ログ抽出機能

### アプリケーションアーキテクチャ

**メインプロセス（`src/main/main.ts`）**:

- BrowserWindowの作成とライフサイクル管理
- システムテーマ検出と更新処理
- 開発者ツールアクセス付きのネイティブメニュー提供
- 単一ウィンドウモード設定（ウィンドウ終了時にアプリ終了）

**レンダラープロセス（`src/renderer/renderer.ts`）**:

- UI初期化とテーマ管理
- 2ペインレイアウト（プロジェクト一覧 + ファイル一覧）
- JSONL→HTML変換とモーダル表示機能

**セキュリティモデル**:

- `nodeIntegration: false` - レンダラーでのNode.js直接アクセス無効
- `contextIsolation: true` - 分離された実行コンテキスト
- プリロードスクリプトがメイン-レンダラー間の安全な通信をブリッジ

## 開発フェーズ状況

プロジェクトは段階的開発アプローチに従います（`implPlan.md`参照）:

- ✅ **フェーズ1-6**: TypeScript + Electron基盤、UI、ファイルシステム統合、JSONL処理 - **完了**
- 🎯 **現在**: TypeScript版claude-extractor実装完了、Python依存関係削除済み
- **次回**: エクスポート機能、設定画面、配布準備

## ビルド設定

**TypeScript設定**:

- `tsconfig.main.json` - メインプロセスコンパイル設定
- `tsconfig.renderer.json` - レンダラープロセスコンパイル設定
- ターゲット: ES2020、strictモード有効

**出力構造**:

```
dist/
├── main/
│   ├── main/       # コンパイル済みメインプロセス
│   └── lib/        # TypeScript版claude-extractor
└── renderer/       # コンパイル済みレンダラー + アセット
```

## 開発中の主要機能

1. **Claude Projects統合**: `~/.claude/projects`からのプロジェクト自動検出 ✅
2. **JSONL処理**: TypeScript版claude-extractorによる会話ログ解析 ✅
3. **HTML表示**: テーマ対応スタイルでのMarkdownからHTML変換 ✅
4. **モーダルビューア**: ナビゲーション付きオーバーレイウィンドウでの会話表示 ✅
5. **エクスポート機能**: HTML/PDFエクスポート機能（未実装）

## プロジェクトドキュメント

### 実装計画（`implPlan.md`）

10段階のフェーズベース開発で進行中。現在フェーズ2（メインUIレイアウト）実装中:

**完了済み**:

- ✅ フェーズ1: TypeScript + Electron基盤構築
- ✅ フェーズ2: 2ペインレイアウト（プロジェクト一覧 + ファイル一覧）
- ✅ フェーズ3-4: ファイルシステム統合とJSONL管理
- ✅ フェーズ5-6: TypeScript版claude-extractor統合とHTML変換

**今後の予定**:

- フェーズ7-8: エクスポート機能とUI最適化
- フェーズ9-10: 設定機能と配布準備

### 機能仕様（`spec.md`）

主要機能要件:

- **プロジェクト管理**: `~/.claude/projects`からの自動検出
- **JSONL処理**: TypeScript版claude-extractor統合
- **HTML変換**: カスタムMarkdown→HTML変換エンジン
- **モーダル表示**: 画面80%サイズのオーバーレイビューア
- **エクスポート**: HTML/PDF出力機能
- **キャッシュシステム**: `~/Library/Application Support/Claude Code Viewer/cache`
- **テーマ**: システム設定連動（ダーク/ライト自動切替）

### UI設計（`ui.md`）

詳細なレイアウト設計:

- **2ペインレイアウト**: 左250px（プロジェクト）+ 右70%（ファイル一覧）
- **モーダル仕様**: 800x600px最小、半透明オーバーレイ
- **ナビゲーション**: [◀][▶]で前後ファイル移動
- **プログレス表示**: 4段階（準備→変換→処理→完了）
- **キーボードショートカット**: Cmd+R（更新）、Escape（閉じる）等

## TypeScript版claude-extractor

### 内蔵機能

**完全TypeScript実装**: `src/lib/claudeExtractor.ts`

- 外部依存なしの純粋TypeScript実装
- Python版と同等のJSONL解析・Markdown生成機能
- 直接ファイルパス指定による高速変換
- 複雑なセッション番号特定ロジック不要

### 主要クラス・メソッド

```typescript
class ClaudeExtractor {
  async convertFile(jsonlPath: string): Promise<string>;
  private parseJsonl(filePath: string): ConversationData;
  private extractTextContent(content: any): string;
  private generateMarkdown(data: ConversationData): string;
}
```

## 開発メモ

- F12キーで開発者ツールの開閉
- システムテーマ検出と手動オーバーライド機能を使用
- 単一ウィンドウパターンのウィンドウ管理（macOSでもドック非永続化）
- パス解決問題回避のため絶対パスを使用
- アセット（HTML/CSS）はバンドルではなくビルド時にコピー
- 各フェーズ完了時はユーザー承認後に次フェーズ進行

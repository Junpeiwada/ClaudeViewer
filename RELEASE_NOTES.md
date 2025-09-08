# Claude Code Viewer v1.0.0 - Universal Edition

🎉 **初回リリース - Claude CodeのJSONL会話ログを美しく閲覧するElectronアプリケーション**

## 📥 ダウンロード

### macOS Universal Binary （推奨）
[![Download DMG](https://img.shields.io/badge/Download-DMG%20170MB-blue?style=for-the-badge&logo=apple)](https://github.com/yourusername/claude-code-viewer/raw/main/dist/build/Claude%20Code%20Viewer-1.0.0-universal.dmg)

- **ファイル**: `Claude Code Viewer-1.0.0-universal.dmg`
- **サイズ**: 170MB
- **対応CPU**: Intel Mac + Apple Silicon (M1/M2/M3)
- **対応OS**: macOS 10.15 (Catalina) 以降

### インストール方法
1. 上記リンクからDMGファイルをダウンロード
2. DMGファイルをダブルクリックして開く
3. Claude Code Viewer.appを「アプリケーション」フォルダにドラッグ
4. Launchpadまたは「アプリケーション」フォルダから起動

## ✨ 主要機能

### 🔍 Tree View ナビゲーション
- `~/.claude/projects` から自動プロジェクト検出
- Finder風の直感的フォルダ階層表示
- ファイル情報表示（サイズ・日付）、最新ファイルが上に自動ソート

### 💬 最適化された会話表示
- **チャット風UI**: LINEやiMessage風の美しい会話レイアウト
- **明確な視覚区別**: 
  - 👤 ユーザーメッセージ: 白背景、右寄せ配置
  - 🤖 Claudeメッセージ: 薄グレー背景、左寄せ配置
- **余白最適化**: より多くの会話内容を一画面で表示
- **長いURL対応**: 自動折り返しで横スクロール不要

### ⚡ 高速変換エンジン
- **TypeScript内蔵エンジン**: Python依存なし、外部プロセス不要
- **即座変換**: ファイル選択と同時に瞬時変換・表示
- **高品質フィルタリング**: システムメッセージ除去、実際の会話のみ抽出

### 📤 HTMLエクスポート
- **スタンドアロンHTML**: インラインCSS付きでどこでも表示可能
- **自動ファイル名**: `Session_{セッションID}_{日付}.html`
- **システム統合**: ネイティブファイル保存ダイアログ
- **ワンクリック保存**: 📤ボタンから即座エクスポート

### 🎨 テキスト操作
- **全選択**: Cmd+A または 📋ボタン
- **コピー**: Cmd+C または 📄ボタン
- **テキスト選択**: ドラッグ選択対応

## 🚀 技術的特徴

### vs Python版 claude-conversation-extractor
| 項目 | Python版 | Claude Code Viewer |
|------|----------|-------------------|
| **依存関係** | Python + 270MBバイナリ | TypeScript内蔵エンジン |
| **起動時間** | 数秒 | 瞬時 |
| **変換速度** | 外部プロセス | 直接実行 |
| **UI** | コマンドライン | 美しいGUI |
| **出力品質** | 23KB | 22KB（同等） |
| **プラットフォーム** | 要Python環境 | ユニバーサルmacOSアプリ |

### アーキテクチャ
- **Electron 27.1.0**: 最新クロスプラットフォーム基盤
- **TypeScript 5.3.0**: 型安全な開発環境
- **内蔵変換エンジン**: `claude-conversation-extractor` 準拠の完全TypeScript実装
- **セキュア設計**: `contextIsolation: true`, `nodeIntegration: false`

## 🎯 使用方法

1. **アプリ起動**: LaunchpadまたはApplicationsフォルダから起動
2. **プロジェクト選択**: 左ペインでフォルダをクリックして展開
3. **会話閲覧**: ファイルをクリックで即座に会話表示
4. **HTMLエクスポート**: 📤ボタン → ファイル保存先選択 → 保存完了

## 🔧 開発者向け情報

### ソースからビルド
```bash
git clone https://github.com/yourusername/claude-code-viewer.git
cd claude-code-viewer
npm install
npm run dist:mac  # DMGパッケージ作成
```

### 開発モード
```bash
npm run dev       # 開発モードで起動
npm run watch     # ファイル監視モード
```

## 🙏 謝辞

このプロジェクトは [claude-conversation-extractor](https://github.com/ZeroSumQuant/claude-conversation-extractor) を参考に、GUIビューアとしてTypeScriptで完全に再実装されました。

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルをご覧ください。

---

**Claude Code Viewer** で、あなたのAI開発体験をより豊かにしましょう！ 🚀
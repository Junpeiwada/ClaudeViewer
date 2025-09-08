# Electronアプリケーションアイコン設定方法

このファイルは、Electronアプリケーションでアイコンを正しく設定する方法を記録しています。

## 必要なアイコンファイル

以下のファイルを`icon/`ディレクトリに配置してください：

- `[APP_NAME].icns` - macOS用アイコン（ウィンドウ用）
- `[APP_NAME].ico` - Windows用アイコン（ウィンドウ用）
- `[APP_NAME].png` - macOS Dock用アイコン（高解像度対応）

## main.jsでの設定方法

### 1. ウィンドウアイコンの設定

```javascript
// BrowserWindow作成時にプラットフォーム別アイコンを指定
const iconPath = process.platform === 'darwin' 
  ? path.join(__dirname, 'icon', '[APP_NAME].icns')
  : path.join(__dirname, 'icon', '[APP_NAME].ico');

mainWindow = new BrowserWindow({
  // その他の設定...
  icon: iconPath,
  // その他の設定...
});
```

### 2. macOS Dockアイコンの設定

```javascript
// app.whenReady()内で設定
app.whenReady().then(async () => {
  try {
    // Dockアイコンを設定（macOS）- PNGファイルを使用
    if (process.platform === 'darwin' && app.dock) {
      const dockIconPath = path.join(__dirname, 'icon', '[APP_NAME].png');
      
      if (fsSync.existsSync(dockIconPath)) {
        try {
          app.dock.setIcon(dockIconPath);
          console.log('Dockアイコンを設定しました:', dockIconPath);
        } catch (iconError) {
          console.error('Dockアイコン設定エラー:', iconError);
        }
      }
    }
    
    await createWindow();
  } catch (error) {
    console.error('アプリケーション起動エラー:', error);
    app.quit();
  }
});
```

## package.jsonでの設定

```json
{
  "name": "[PACKAGE_NAME]",
  "version": "1.0.0",
  "description": "[APP_DESCRIPTION]",
  "main": "main.js",
  "icon": "icon/[APP_NAME].icns",
  // その他の設定...
}
```

## 重要なポイント

1. **ファイル形式の使い分け**：
   - `.icns`：macOSウィンドウアイコン用
   - `.ico`：Windowsウィンドウアイコン用
   - `.png`：macOS Dockアイコン用（icnsファイルで問題が発生する場合の代替）

2. **Dockアイコンの注意点**：
   - icnsファイルでエラーが発生する場合は、PNGファイルを使用する
   - `app.dock.setIcon()`は`app.whenReady()`内で実行する

3. **ファイル存在確認**：
   - `fsSync.existsSync()`でファイルの存在を確認してからアイコンを設定する
   - エラーハンドリングを適切に行う

4. **デバッグ用ログ**：
   - アイコンパスとファイル存在確認のログを出力する
   - 設定成功/失敗のログを出力する

## Claude Code向けプロンプト

```
Electronアプリケーションのアイコンを設定してください。以下の要件に従ってください：

1. icon/ディレクトリにある以下のファイルを使用：
   - [APP_NAME].icns（macOS用）
   - [APP_NAME].ico（Windows用）
   - [APP_NAME].png（macOS Dock用）

2. main.jsで以下を実装：
   - BrowserWindow作成時にプラットフォーム別アイコンを設定
   - macOS Dockアイコンをapp.whenReady()内でPNGファイルを使用して設定
   - ファイル存在確認とエラーハンドリングを追加
   - デバッグ用のログ出力を追加

3. package.jsonにiconフィールドを追加

4. アイコンファイルの形式確認：
   - fileコマンドでファイル形式を確認
   - 必要に応じてアイコンファイルを再生成

この設定により、ウィンドウタイトルバーとDockの両方にカスタムアイコンが表示されます。
```

## トラブルシューティング

- **icnsファイルでエラーが発生する場合**：PNGファイルを代替として使用
- **アイコンが表示されない場合**：ファイルパスとファイル存在を確認
- **Dockアイコンが更新されない場合**：アプリケーションを完全に再起動

## ファイル例

成功例のファイルサイズ（参考値）：
- [APP_NAME].icns: 約70KB（"it32"タイプ）
- [APP_NAME].ico: 約370KB（7アイコン、256x256ピクセル）
- [APP_NAME].png: 約40KB（高解像度PNG）

## プレースホルダー説明

- `[APP_NAME]`: アプリケーション名（例: VideoPlayer, HLGTimeLapse）
- `[PACKAGE_NAME]`: パッケージ名（例: video-viewer, hlg-timelapse）
- `[APP_DESCRIPTION]`: アプリケーションの説明
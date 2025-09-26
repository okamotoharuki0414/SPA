# 実用シフト管理SPA システム

スマホ完全対応の本格的なシフト管理Single Page Applicationです。

## 🎯 主要機能

### 📱 実用シフト管理システム
- **ファイル**: `practical-shift-system.html`
- ドラッグ&ドロップによる直感的なシフト編集
- 社員管理（追加・編集・削除）
- データのエクスポート/インポート
- 統計情報表示
- スマホ完全対応（タッチ操作・レスポンシブデザイン）

### 🏢 プロフェッショナル版デモ
- **ファイル**: `professional-shift-demo.html`
- リアルタイム更新機能
- Server-Sent Events統合
- 高度なシフト管理機能
- 日本語完全対応

## 🛠️ 技術スタック

### フロントエンド
- **JavaScript ES6+** with jQuery
- **HTML5** + CSS3
- **レスポンシブデザイン** (Bootstrap風)
- **タッチジェスチャー対応**

### バックエンド API
- **PHP Zend Framework 1**
- **PostgreSQL** データベース
- **REST API** エンドポイント
- **Redis** pub/sub メッセージング

### リアルタイム通信
- **Node.js** Server-Sent Events サーバー
- **WebSocket** 代替実装
- **自動再接続** 機能

## 📁 ファイル構成

```
SPA/
├── practical-shift-system.html    # メインSPAアプリ
├── professional-shift-demo.html   # プロフェッショナル版
├── js/
│   ├── practical-shift-manager.js    # メイン管理JS
│   └── professional-shift-manager.js # 高度版JS
├── application/
│   ├── controllers/
│   │   ├── ShiftSpaController.php     # REST API
│   │   └── ShiftApiController.php     # 基本API
│   ├── models/
│   │   └── Shift.php                  # データモデル
│   └── views/
└── scripts/
    └── node/
        ├── professional-sse-server.js # SSEサーバー
        ├── simple-sse-server.js       # シンプル版
        └── sse-server.js               # 基本版
```

## 🚀 起動方法

### 1. シンプル起動（HTMLのみ）
```bash
# practical-shift-system.html をブラウザで開く
open practical-shift-system.html
```

### 2. フル機能版（SSE付き）
```bash
# Node.js SSEサーバー起動
node scripts/node/professional-sse-server.js

# professional-shift-demo.html をブラウザで開く
open professional-shift-demo.html
```

### 3. バックエンドAPI（PHP）
```bash
# PHP開発サーバー起動（要設定）
php -S localhost:8080
```

## 💾 データ管理

- **ローカルストレージ**: ブラウザ内永続保存
- **JSON出力**: データバックアップ機能
- **インポート**: JSONファイルからデータ復元

## 📱 スマートフォン対応

- **タッチ操作**: ドラッグ&ドロップ
- **長押しメニュー**: シフト選択
- **レスポンシブ**: 画面サイズ自動調整
- **iOS/Android**: 完全対応

## 🔧 カスタマイズ

### シフトパターン追加
`js/practical-shift-manager.js` の `initShiftPatterns()` を編集

### 社員データ初期化
`loadEmployees()` メソッドでデフォルト社員を設定

### API接続
`application/controllers/` でバックエンド連携

## 📈 統計機能

- 社員数
- 今月シフト数
- 未割当数
- 競合チェック

## 🎨 テーマ

- モダンなグラデーションデザイン
- 直感的なUI/UX
- 日本語フォント最適化
- アクセシビリティ対応

---

**開発**: OO Studio
**技術**: Next.js + PHP + Node.js
**ライセンス**: MIT
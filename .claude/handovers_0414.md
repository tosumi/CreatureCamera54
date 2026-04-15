# CreatureCamera54 セッション引き継ぎ — 2026-04-14

## プロジェクト概要

- **場所**: `C:\Users\tosum\Projects\CreatureCamera54\`
- **内容**: Expo SDK 54 / React Native 0.81.5 / React 19.1.0 のシングルファイルアプリ
- **メインファイル**: `App.js`（約 2110 行）
- **動作環境**: Expo Go App Store 版 54.0.2（SDK 55+ は使用不可）
- **起動コマンド**: `npx expo start`

---

## 今セッションの変更内容

### 1. 海の生き物フレーム画像を更新

- `assets/frame-ocean.png` を新しい画像（795KB）に差し替え

### 2. アプリアイコンを更新（2回）

- `assets/icon.png` / `assets/adaptive-icon.png` / `assets/favicon.png` の3ファイルを更新
- 最終的なアイコン：白背景＋カメライラスト＋カメレオン（`C:\Users\tosum\Downloads\creature_camera_icon.png`）

### 3. 本番用デバッグ機能の一時非表示

以下をコメントアウト（復元は該当箇所のコメントを外すだけ）：

| 場所 | 内容 |
|---|---|
| 全画面モード（line ~1812） | ✕ボタン |
| フレームモード（line ~1831） | ✕ボタン |
| 設定画面（line ~2091） | デバッグ設定セクション＋divider |

`debugMode` は常時 `false` のままになるため、デバッグオーバーレイも表示されない。

### 4. App Store 提出用 app.json 修正

```json
// 変更前
"name": "CreatureCamera54"

// 変更後
"name": "CreatureCamera"
```

```json
// 追加
"NSPhotoLibraryUsageDescription": "撮影した生き物の写真をギャラリーで表示します"
```

`slug` は EAS 連携のため `"CreatureCamera54"` のまま据え置き。

---

## App Store 提出状況チェックリスト

| 項目 | 状態 |
|---|---|
| アイコン 1024×1024 | ✅ |
| NSCameraUsageDescription | ✅ |
| NSPhotoLibraryUsageDescription | ✅（今セッション追加） |
| NSPhotoLibraryAddUsageDescription | ✅ |
| ITSAppUsesNonExemptEncryption: false | ✅ |
| bundleIdentifier | ✅ `com.tosumi.CreatureCamera` |
| EAS autoIncrement | ✅ |
| アプリ名（"54"なし） | ✅（今セッション修正） |
| デバッグ機能非表示 | ✅（今セッション対応） |
| サポートURL | ⬜ 未設定（GitHub等） |
| プライバシーポリシーURL | ⬜ 未作成 |
| スプラッシュ画像（推奨1284×2778） | ⬜ 現状940×1671 |

### App Store 登録用文言（今セッション作成）

- 説明文（日本語・英語）、キーワード（98文字）、年齢レーティング（4+）、カテゴリ（写真/ビデオ）はセッション中に確定済み
- プライバシーポリシーは app-privacy-policy-generator 等で作成 → GitHub Pages 等に掲載が必要
- Content Rights：BGM・SE・フレーム画像の素材元ライセンスを確認してから回答

---

## 残課題（TODO）

| 優先度 | 内容 |
|---|---|
| 🔴 | プライバシーポリシーページの作成・公開 |
| 🔴 | サポートURLの準備（GitHub等） |
| 🟡 | `DEBUG_UNLOCKED` / `DEBUG_FRAME_COUNTS` 変数名をリネーム（line 698-699） |
| 🟡 | スプラッシュ画像を推奨サイズ（1284×2778px）に更新 |
| 🟡 | Android adaptive-icon の backgroundColor を `#1a1030` 等ダーク系に変更 |

---

## 改善ロードマップ（討論議事録より）

### 📋 議事録の保存場所

```
C:\Users\tosum\.claude\plans\abundant-spinning-goblet.md
```

3ペルソナ（P1リアリストエンジニア・P2スピリチュアルデザイナー・P3インベスター）による
7トピックの討論録。提案1〜11 と優先実装ロードマップが含まれる。

### 優先実装ロードマップ（サマリー）

| 優先度 | 提案 | 実装コスト |
|---|---|---|
| 🔴 最優先 | 初回チュートリアル | 中 |
| 🔴 最優先 | 初回アイテム確定出現（最初の10枚以内） | 低 |
| 🔴 最優先 | 英語ローカライズ | 中 |
| 🟡 優先 | フレーム画像クオリティ向上 | デザイン依存 |
| 🟡 優先 | 各テーマの生き物を5体→8体に増加 | 低 |
| 🟡 優先 | 天井補正（出現率漸増） | 低 |
| 🟡 優先 | アニメーションのランダム複数パターン化 | 中 |
| 🟢 中期 | 生き物出現予兆演出（BGM変化・画面エフェクト） | 中 |
| 🟢 中期 | 季節限定テーマ・アイテム | 中 |
| 🟢 中期 | 新アイテム追加（強制召喚・カメラエフェクト） | 低〜中 |
| 🟢 中期 | **[提案11]** 生き物をオリジナルイラストへ移行 | 高 |

---

## 定数・設定値（変更なし）

```js
const ALBUM_NAME         = 'CreatureCamera';
const SETTINGS_KEY       = 'creature_camera_settings';
const SAVED_PHOTOS_KEY   = '@creature_camera_saved_photos';
const AUTO_DELETE_KEY    = '@creature_camera_auto_delete';
const AUDIO_SETTINGS_KEY = '@creature_camera_audio';
const PHOTO_LIMIT        = 30;
const OVERFLOW_LIMIT     = 80;
const PROTECT_LIMIT      = 20;
const FRAME_MAX          = 20;
const SPECIAL_ITEM_CHANCE = 0.05;
```

---

## Z-index 順序（変更なし）

| 要素 | zIndex |
|---|---|
| デバッグオーバーレイ（現在非表示） | 100 |
| 設定オーバーレイ | 200 |
| controlPanel | 30 |
| camera finder | 20 |
| ScopeOverlay | 15 |
| creature | 10 |
| camera / compositing | 0 |

---

## 既知の注意点・バグ修正履歴（累積）

1. **ビューワー close フラッシュ**: `setValue` は `closeViewer` 内で呼ばない
2. **compositing `setCompositing(null)`**: Alert OK ハンドラ内で呼ぶ
3. **`useCallback([])` stale closure**: ref 経由で最新値を参照
4. **iOS MediaLibrary**: `getAssetsAsync` は `ph://` URI → `getAssetInfoAsync(asset).localUri` が必要
5. **カメラファインダーフラッシュ**: 常時マウント＋opacity 制御で修正済み
6. **設定画面 fullScreen 切替で再アニメーション**: Modal→絶対配置Viewに変更で修正済み
7. **自動削除がアラート前に実行**: OK押下後に移動して修正済み
8. **スコープ座標飛び**: ポーリング廃止・最終座標への1本アニメーションで修正済み
9. **二重超過 Alert 防止**: `skipOverflowAlertRef.current = true` してから `setOverflowMode(true)`

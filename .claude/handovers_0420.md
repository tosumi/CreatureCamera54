# CreatureCamera54 セッション引き継ぎ — 2026-04-20

## プロジェクト概要

- **場所**: `C:\Users\tosum\Projects\CreatureCamera54\`
- **内容**: Expo SDK 54 / React Native 0.81.5 / React 19.1.0 のシングルファイルアプリ
- **メインファイル**: `App.js`（約 3250 行）
- **動作環境**: Expo Go App Store 版 54.0.2（SDK 55+ は使用不可）
- **起動コマンド**: `npx expo start`
- **現在のバージョン**: `1.1.0`（build 9）— App Store Connect 提出済み

---

## 今セッションの変更内容

### 1. ScopeOverlay 追尾アニメーション起点修正

**問題**: `creatureActive` が true になったとき、`leftAnim.stopAnimation()` をコールバックなしで呼び出した後、`leftAnim._value` を読んでいた。`_value` は浮遊アニメーション中の補間値を正確に反映しないため、追尾アニメーションがスコープの出現位置（初期値）から始まってしまっていた。

**解決**: `stopAnimation(callback)` 形式に変更し、コールバックで実際の停止座標を受け取ってから距離計算を行うように修正。

```js
// 変更前
leftAnim.stopAnimation();
topAnim.stopAnimation();
const dx = targetLeft - leftAnim._value;
const dy = targetTop  - topAnim._value;

// 変更後
let startLeft = SCREEN_W / 2 - SIZE / 2;
let startTop  = SCREEN_H / 2 - SIZE / 2;
leftAnim.stopAnimation((vl) => { startLeft = vl; });
topAnim.stopAnimation((vt)  => { startTop  = vt; });
const dx = targetLeft - startLeft;
const dy = targetTop  - startTop;
```

---

### 2. ScopeOverlay 浮遊範囲をフレームあり時に制限

**問題**: カメラフレームあり（`fullScreen=false`）のとき、スコープが画面下部のコントロールパネル領域（下20%）まで浮遊してしまっていた。浮遊範囲が `SCREEN_H` 全体を基準にしていたため。

**解決**: `ScopeOverlay` に `fullScreen` prop を追加し、有効高さを切り替え。

```js
// ScopeOverlay の props に fullScreen を追加
function ScopeOverlay({ ..., fullScreen }) {
  const areaH = fullScreen ? SCREEN_H : CAMERA_AREA_H;
  // topAnim 初期値・drift の SH/my を areaH ベースに変更
}
```

呼び出し側に `fullScreen={fullScreen}` を追加。

---

### 3. 全テーマ取得済み時の「新テーマ」アイテム挙動変更

**変更前**: 全テーマ取得済みの場合、「すでにすべてのテーマを取得済みです！」と表示するだけで何も付与しなかった。

**変更後**: 取得済みテーマの中からランダムに1つ選び、フレーム+5を付与。メッセージも変更。

```js
// else ブランチ（全テーマ取得済み時）
const targetId = unlockedThemes[Math.floor(Math.random() * unlockedThemes.length)];
const newCount = Math.min(FRAME_MAX, (frameCountsRef.current[targetId] ?? 0) + 5);
// ... frameCounts 更新・保存 ...
const label = t('theme_' + targetId);
playSE(SE_ITEM_FRAME);
Alert.alert(t('alert_theme_all_title'), t('alert_theme_all_body', { label }));
```

翻訳キーも更新：
- `alert_theme_all_body` (ja): `'「{label}」のテーマは既に入手済みです。\n「{label}」のテーマにフレームを追加します。'`
- `alert_theme_all_body` (en): `'You already have the "{label}" theme.\nAdding frames to the "{label}" theme.'`

---

### 4. アセット更新

| ファイル | 内容 |
|---|---|
| `assets/splash-icon.png` | 新スプラッシュ画像（1286×2778px）に更新 |
| `assets/icon.png` | 新アプリアイコン（1024×1024px）に更新 |
| `assets/frame-default.png` | デフォルトフレーム更新 |
| `assets/frame-flower.png` | フローラルフレーム更新 |
| `assets/frame-stylish.png` | おしゃれフレーム更新 |
| `assets/frame-ocean.png` | 海の生き物フレーム更新 |
| `assets/frame-forest.png` | 森の生き物フレーム更新 |
| `assets/frame-savanna.png` | サバンナの生き物フレーム更新 |

`app.json` の `splash.backgroundColor` を `#1a0a00` → `#c8aee0`（ラベンダー）に変更。

---

### 5. EAS ビルド・提出関連の設定変更

#### `eas.json` に `ascAppId` を追加

**問題**: `--submit` オプション付きで EAS ビルドを実行したところ、`eas.json` の submit プロファイルに `ascAppId` が未設定のため提出が失敗した。

**解決**: `eas.json` の `submit.production.ios` に追加。

```json
"submit": {
  "production": {
    "ios": {
      "ascAppId": "6762171872"
    }
  }
}
```

#### バージョン `1.0.0` → `1.1.0` に更新

**問題**: 2回目の提出でも「このバージョンは既に提出済み」エラー。先のビルド（build 8）が v1.0.0 で App Store Connect に送信済みだったため。

**解決**: `app.json` の `version` を `1.1.0` に更新して再ビルド。

**結果**: v1.1.0 (build 9) として App Store Connect への提出完了。

---

## 定数・設定値（現在）

```js
const ALBUM_NAME              = 'CreatureCamera';
const SETTINGS_KEY            = 'creature_camera_settings';
const SAVED_PHOTOS_KEY        = '@creature_camera_saved_photos';
const AUTO_DELETE_KEY         = '@creature_camera_auto_delete';
const AUDIO_SETTINGS_KEY      = '@creature_camera_audio';
const TUTORIAL_KEY            = '@creature_camera_tutorial_done';
const SKIP_FORCED_ITEM_KEY    = '@creature_camera_skip_forced_item';
const PITY_COUNTER_KEY        = '@creature_camera_pity_counter';
const PHOTO_LIMIT             = 30;
const OVERFLOW_LIMIT          = 80;
const PROTECT_LIMIT           = 20;
const FRAME_MAX               = 20;
const SPECIAL_ITEM_CHANCE     = 0.10;
const TUTORIAL_CREATURE_SIZE  = 120;
const PITY_THRESHOLD          = 10;
```

---

## Z-index 順序

| 要素 | zIndex |
|---|---|
| チュートリアルオーバーレイ | 300 |
| 設定オーバーレイ | 200 |
| controlPanel | 30 |
| camera finder | 20 |
| ScopeOverlay | 15 |
| creature | 10 |
| camera / compositing | 0 |

---

## チュートリアルのステップ一覧

| step | 画面 | 内容 | 次へトリガー |
|---|---|---|---|
| 1 | スプラッシュ後 | バイリンガル開始確認（日本語/Englishボタン） | 言語選択ボタン押下 |
| 2 | メイン | シャッターボタン説明 ⬇️ | 次へ（宇宙人強制出現・画面上半分） |
| 3 | メイン（宇宙人停止中） | シャッターを押して（スキップなし） | シャッター押下 or 10秒タイマー |
| 4 | メイン | ギャラリーアイコン説明 ↙️ | 次へ（ギャラリー自動オープン） |
| 5 | ギャラリー一覧 | 写真タップ説明 ⬇️ | 写真タップ |
| 6 | ビューワー | ゴミ箱アイコン説明 ↘️ | 次へ |
| 7 | ビューワー | ハートアイコン説明 ↙️ | 次へ |
| 8 | ビューワー | 閉じ方説明 ↗️ | 次へ（closeViewer） |
| 9 | ギャラリー一覧 | 選択☑️説明 ↗️ | 次へ |
| 10 | ギャラリー一覧 | 閉じ方説明 ↗️ | 次へ（ギャラリー強制クローズ） |
| 11 | メイン | アイテム予告音説明 🔔 | 次へ（SE再生→テーマアイテム強制出現・画面上半分） |
| 12 | メイン（テーマアイテム停止中） | アイテム撮影説明 ⬇️（スキップなし） | シャッター押下 or 10秒タイマー |
| 14 | メイン | 設定アイコン説明 ↘️ | 次へ（設定自動オープン） |
| 15 | 設定画面 | テーマ選択説明 ⬇️ | 次へ（テーマ以外無効化中） |
| 17 | 設定画面 | 閉じ方説明 ↗️ | 次へ（設定自動クローズ） |
| 18 | メイン | 終了メッセージ | 次へ（completeTutorial） |

---

## 残課題（TODO）

| 優先度 | 内容 |
|---|---|
| 🟡 | 各テーマの生き物を5体→8体に増加 |
| 🟡 | アニメーションのランダム複数パターン化 |

---

## 改善ロードマップ

| 優先度 | 提案 | 状況 |
|---|---|---|
| ✅ 完了 | 初回チュートリアル | 実装済み |
| ✅ 完了 | 特殊アイテム出現率10%・天井補正 | 実装済み |
| ✅ 完了 | チュートリアルスキップ後5枚目強制特殊アイテム | 実装済み |
| ✅ 完了 | 英語ローカライズ + 設定画面言語切替 | 実装済み |
| ✅ 完了 | スプラッシュ画像を推奨サイズに更新 | 今セッションで対応 |
| ✅ 完了 | フレーム画像・アイコン更新 | 今セッションで対応 |
| 🟡 優先 | 各テーマの生き物を5体→8体に増加 | 未実装 |
| 🟡 優先 | アニメーションのランダム複数パターン化 | 未実装 |

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
10. **チュートリアルメッセージがギャラリーの裏に表示**: ギャラリー Modal 内にも `renderTutorialOverlay()` を追加して解決
11. **ギャラリービューワーの削除・保護アイコン非表示**: `pointerEvents` 制御用Viewに `StyleSheet.absoluteFill` を追加して解決
12. **`t()` のstale closure**: モジュールレベル `_langRef` + レンダー毎同期で解決（Alert等のコールバックでも正常動作）
13. **ScopeOverlay 追尾アニメーション起点ズレ**: `stopAnimation(callback)` で実座標を取得してから計算するよう修正
14. **ScopeOverlay がフレームあり時に下まで浮遊**: `fullScreen` prop を追加し、浮遊範囲を `CAMERA_AREA_H` に制限

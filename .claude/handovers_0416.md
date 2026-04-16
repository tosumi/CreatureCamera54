# CreatureCamera54 セッション引き継ぎ — 2026-04-16/17

## プロジェクト概要

- **場所**: `C:\Users\tosum\Projects\CreatureCamera54\`
- **内容**: Expo SDK 54 / React Native 0.81.5 / React 19.1.0 のシングルファイルアプリ
- **メインファイル**: `App.js`（約 2650 行）
- **動作環境**: Expo Go App Store 版 54.0.2（SDK 55+ は使用不可）
- **起動コマンド**: `npx expo start`

---

## 今セッションの変更内容

### 1. ギャラリービューワーの削除・保護アイコン非表示バグ修正

**原因**: チュートリアルの `pointerEvents` 制御用に追加した `<View>` に `style` が未指定だったため、`position: 'absolute'` な子要素（🗑・☆/⭐・✕・カウンター）がゼロサイズのViewを基準に配置されて見えなくなっていた。

**修正**: 当該 `<View>` に `style={StyleSheet.absoluteFill}` を追加。

---

### 2. チュートリアル UX 改善

#### 生き物・アイテム出現位置を上半分に固定（step3・step12）
- `advanceTutorial` の step2（宇宙人出現）・step11（テーマアイテム出現）で viewport を `h: SCREEN_H * 0.5` に変更
- メッセージバブル（下半分：`bubbleY: SCREEN_H * 0.52` / `0.42`）と重ならないよう固定

#### スキップボタンをstep3・step12で非表示
- `renderTutorialOverlay()` のスキップボタン表示条件に `tutorialStep !== 3 && tutorialStep !== 12` を追加
- 宇宙人／アイテム撮影待ち中の誤スキップを防止（10秒自動撮影フォールバックは健在）

---

### 3. チュートリアルスキップ後の5枚目強制特殊アイテム

**仕様**: チュートリアルを「いいえ」またはstep12到達前に「スキップ」した場合、5枚目の撮影で強制的に特殊アイテムが出現する（中身はランダム）

**実装**:

| 定数 | 値 |
|---|---|
| `SKIP_FORCED_ITEM_KEY` | `'@creature_camera_skip_forced_item'` |

| ref | 役割 |
|---|---|
| `skipForcedItemRef` | 残りカウント（4→3→2→1→0） |
| `forceNextSpecialItemRef` | 次の scheduleNextCreature で強制フラグ |

**フロー**:
1. `skipTutorial()` 呼び出し時に `tutorialStepRef.current < 12` なら `skipForcedItemRef.current = 4` をセット、AsyncStorageに保存
2. 通常撮影の「OK」押下後にカウンタをデクリメント、AsyncStorage更新
3. カウンタが0になったら `forceNextSpecialItemRef.current = true` をセット
4. `scheduleNextCreature` のタイマー発火時に `forceNextSpecialItemRef` を検知 → SE再生 → 1秒後に特殊アイテム強制出現
5. アプリ再起動時は `initMediaLibrary` でAsyncStorageからカウンタを復元

---

### 4. 特殊アイテム出現確率を10%に変更

```js
const SPECIAL_ITEM_CHANCE = 0.10; // 5% → 10%
```

---

### 5. 天井補正（連続通常撮影で出現率漸増）

**仕様**: 10回連続で特殊アイテムなしの場合、11回目以降は1回ごとに+1%

| 定数 | 値 |
|---|---|
| `PITY_COUNTER_KEY` | `'@creature_camera_pity_counter'` |
| `PITY_THRESHOLD` | `10` |

**確率式**: `SPECIAL_ITEM_CHANCE + max(0, (counter - 10) * 0.01)`

| 連続通常撮影 | 有効出現率 |
|---|---|
| 0〜10回 | 10% |
| 11回 | 11% |
| 20回 | 20% |
| 100回 | 100%（事実上確定） |

**ref**: `pityCounterRef`
- 通常撮影の「OK」後にインクリメント
- 特殊アイテム撮影時にリセット（0）
- アプリ再起動時に `initMediaLibrary` で復元

---

### 6. 特殊アイテム予兆SEと出現アニメーションを1秒ずらす

**変更前**: SE再生 → 即座に `setActiveCreature`（出現アニメーション開始）  
**変更後**: SE再生 → 1秒待機 → `setActiveCreature`

**実装**: `scheduleNextCreature` のタイマー内、通常抽選・強制出現の両パスで `timerRef.current = setTimeout(() => setActiveCreature(...), 1000)` に変更

**スコープへの影響なし**: `ScopeOverlay` は `creatureActive={!!activeCreature}` をトリガーに追跡開始するため、`setActiveCreature` が1秒遅れても動作は正常（SE後に生き物が出現→スコープが追跡開始）

---

### 7. デバッグ機能の削除

削除したもの：
- `debugMode` state
- デバッグオーバーレイ JSX（画面中央に座標・サイズを表示）
- コメントアウト済みのデバッグON/OFFスイッチUI
- 【開発用】全データリセットボタン

リネーム：
- `DEBUG_UNLOCKED` → `initialUnlocked`
- `DEBUG_FRAME_COUNTS` → `initialFrameCounts`

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
const SPECIAL_ITEM_CHANCE     = 0.10;   // 10%
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

※ ギャラリー（Modal）内のチュートリアルオーバーレイは Modal 内の最後の要素として描画

---

## チュートリアルのステップ一覧（最新）

| step | 画面 | 内容 | 次へトリガー |
|---|---|---|---|
| 1 | スプラッシュ後 | 開始確認（はい/いいえ） | はい |
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
| 🔴 | App Store Connect のサポートURLを `http://tosumi.github.io/CreatureCamera54` に更新（コード外） |
| 🔴 | App Review へ返信（フレーム解放手順の説明・チュートリアルで確認可能な旨） |
| 🔴 | 新しいビルドを EAS で作成して App Store Connect に再提出 |
| 🟡 | チュートリアルの実機テスト（Expo Go で動作確認） |
| 🟡 | スプラッシュ画像を推奨サイズ（1284×2778px）に更新 |

---

## 改善ロードマップ

| 優先度 | 提案 | 状況 |
|---|---|---|
| ✅ 完了 | 初回チュートリアル | 実装済み |
| ✅ 完了 | 特殊アイテム出現率10%・天井補正 | 実装済み |
| ✅ 完了 | チュートリアルスキップ後5枚目強制特殊アイテム | 実装済み |
| 🔴 最優先 | 英語ローカライズ | 未実装 |
| 🟡 優先 | フレーム画像クオリティ向上 | デザイン依存 |
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

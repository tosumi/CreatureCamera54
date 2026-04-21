# CreatureCamera54 セッション引き継ぎ — 2026-04-22

## プロジェクト概要

- **場所**: `C:\Users\tosum\Projects\CreatureCamera54\`
- **内容**: Expo SDK 54 / React Native 0.81.5 / React 19.1.0 のシングルファイルアプリ
- **メインファイル**: `App.js`（約 3450 行）
- **動作環境**: Expo Go App Store 版 54.0.2（SDK 55+ は使用不可）
- **起動コマンド**: `npx expo start`
- **現在のバージョン**: `1.1.1`（build 10）— App Store Connect 提出済み

---

## 今セッションの変更内容

### 1. bounce アニメーション改善（縦の放物線追加）

**問題**: 横移動のみで、top アニメーションと同じ印象だった。

**解決**: `Animated.parallel` で横移動と縦の放物線バウンドを同時進行させる形に変更。

```js
// initTop を床レベルに変更
const initTop = isBounce ? sf.bottom - creature.size  // 床レベルから横バウンド開始

// アニメーション
Animated.parallel([
  // 横: 画面横外から中央へ（合計1000ms）
  Animated.timing(leftAnim, { toValue: targetLeft, duration: 1000, useNativeDriver: false }),
  // 縦: 大小の放物線（合計1000ms）
  Animated.sequence([
    Animated.timing(topAnim, { toValue: peakY1,  duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: false }),
    Animated.timing(topAnim, { toValue: groundY, duration: 280, easing: Easing.in(Easing.quad),  useNativeDriver: false }),
    Animated.timing(topAnim, { toValue: peakY2,  duration: 210, easing: Easing.out(Easing.quad), useNativeDriver: false }),
    Animated.timing(topAnim, { toValue: groundY, duration: 210, easing: Easing.in(Easing.quad),  useNativeDriver: false }),
  ]),
]).start(...)
```

- `peakY1 = groundY - safeH * 0.55`（大きな弧の頂点）
- `peakY2 = groundY - safeH * 0.25`（小さな弧の頂点）
- `groundY = sf.bottom - creature.size`（着地する床の高さ）
- `Easing` を react-native からインポートに追加

---

### 2. フラワーテーマから bounce を除外

**変更**: フラワーテーマの特殊アニメーションから bounce を削除。

```js
// 変更前
flower:  ['float_up', 'bounce'  ],  // 花びらが浮かぶ・落ちてくる

// 変更後
flower:  ['float_up', 'spin_in' ],  // 花びらが浮かぶ・ひらひら回転出現
```

---

### 3. 設定・ギャラリー遷移時にアニメーション停止＆再開

**問題**: 設定画面やギャラリー画面を開いている間も、バックグラウンドで生き物の出現タイマーが動いており、閉じた瞬間にアニメーションが始まってしまう場合があった。

**解決**: `settingsVisible` と `galleryVisible` を監視する `useEffect` を追加。

```js
// 設定・ギャラリーが開いたらアニメーション停止、閉じたら再スケジュール
const wasOverlayOpenRef = useRef(false);
useEffect(() => {
  const isOpen = settingsVisible || galleryVisible;
  if (isOpen) {
    clearTimeout(timerRef.current);
    setActiveCreature(null);
    capturableRef.current = false;
    setCreatureCapturable(false);
    wasOverlayOpenRef.current = true;
  } else if (wasOverlayOpenRef.current) {
    wasOverlayOpenRef.current = false;
    if (tutorialStepRef.current === 0) scheduleNextCreatureRef.current?.();
  }
}, [settingsVisible, galleryVisible]);
```

- 開いた瞬間: タイマークリア＋生き物消去＋capturable リセット
- 閉じた瞬間: チュートリアル外なら `scheduleNextCreature` を再実行
- `scheduleNextCreatureRef.current` を使用して stale closure を回避

---

### 4. フレーム合成の Y 座標ズレ修正

**問題**: 非fullScreenモード（フレームあり）でカメラプレビューが `CAMERA_AREA_H`（画面の80%）に表示されるのに対し、合成時の写真は `absoluteFill`（画面100%）で表示されるため、スケールが異なって生き物の Y 座標がずれていた。

**最初の修正（失敗）**: 写真コンテナ高さを `CAMERA_AREA_H` に制限 → 下部に白帯が発生。

**最終修正**: 写真は全画面表示のままにして、生き物の Y 座標を合成時にスケール補正。

```js
// 非fullScreenモードで Y 座標を補正
const yScale = compositing.fullScreen ? 1 : SCREEN_H / CAMERA_AREA_H;  // = 1.25
const adjTop  = (top) => top * yScale;

// 生き物配置時に適用
top: adjTop(compositing.creatureSnapshot.pos.top),
// harmonyEntries にも同様に適用
```

- `setCompositing(...)` に `fullScreen` フィールドを追加して合成時に参照
- fullScreen モード: `yScale = 1`（補正なし）
- 非fullScreen モード: `yScale = SCREEN_H / CAMERA_AREA_H = 1.25`
- フレームあり・なし、カメラフレームあり・なし、すべての組み合わせで白帯なしを確認済み

---

### 5. 保護済み写真削除時に SE 追加

**変更**: 保護済み写真を削除しようとした際、「削除できません」アラートと同時に `SE_NO_CREATURE` を再生。

```js
// handleViewerDelete（個別削除）
if (savedPhotoIdsRef.current[item.id]) {
  playSE(SE_NO_CREATURE);  // 追加
  Alert.alert(t('alert_delete_protected_title'), t('alert_delete_protected_body'));
  return;
}

// 複数選択削除
if (hasSaved) {
  playSE(SE_NO_CREATURE);  // 追加
  Alert.alert(t('alert_delete_protected_title'), t('alert_delete_protected_multi'), ...);
  return;
}
```

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
const CAMERA_AREA_H           = SCREEN_H * 0.8;
const PANEL_H                 = SCREEN_H * 0.2;
```

---

## テーマ別特殊アニメーション（現在）

```js
const THEME_SPECIAL_ANIMS = {
  default: ['bounce',   'spin_in' ],  // 不気味な落下・回転出現
  flower:  ['float_up', 'spin_in' ],  // 花びらが浮かぶ・ひらひら回転出現
  stylish: ['spin_in',  'float_up'],  // キラキラ回転・ひらひら浮く
  ocean:   ['float_up', 'bounce'  ],  // 水中から浮上・底から跳ねる
  forest:  ['bounce',   'spin_in' ],  // 木から落下・旋回しながら降りる
  savanna: ['bounce',   'spin_in' ],  // ドシンと着地・くるっと舞い降りる
};
```

各テーマで 50% の確率で通常アニメーション（`CREATURE_ANIM` 割り当て）と差し替え。

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
15. **bounce アニメーションが top と同じ印象**: 縦の放物線（Easing.in/out(quad)）＋横移動を `Animated.parallel` で同時進行に変更
16. **フレーム合成の白帯**: 写真クリップ方式を廃止し、生き物Y座標に `SCREEN_H / CAMERA_AREA_H` を乗じる補正方式に変更
17. **設定・ギャラリー遷移時に生き物アニメーションが継続**: `wasOverlayOpenRef` を使った `useEffect` で停止＆再開を制御

---

## 改善ロードマップ

| 優先度 | 提案 | 状況 |
|---|---|---|
| ✅ 完了 | 初回チュートリアル | 実装済み |
| ✅ 完了 | 特殊アイテム出現率10%・天井補正 | 実装済み |
| ✅ 完了 | チュートリアルスキップ後5枚目強制特殊アイテム | 実装済み |
| ✅ 完了 | 英語ローカライズ + 設定画面言語切替 | 実装済み |
| ✅ 完了 | スプラッシュ画像・フレーム画像・アイコン更新 | 実装済み |
| ✅ 完了 | 各テーマの生き物を5体→8体に増加 | 実装済み |
| ✅ 完了 | テーマ別特殊アニメーション（bounce/float_up/spin_in） | 実装済み |
| ✅ 完了 | bounce アニメーション縦放物線追加 | 今セッションで対応 |
| ✅ 完了 | フレーム合成 Y 座標ズレ修正 | 今セッションで対応 |
| ✅ 完了 | 設定・ギャラリー遷移時アニメーション停止 | 今セッションで対応 |
| ✅ 完了 | 保護済み写真削除時に SE 再生 | 今セッションで対応 |

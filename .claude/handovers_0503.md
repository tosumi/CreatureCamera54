# CreatureCamera54 セッション引き継ぎ — 2026-05-03

## プロジェクト概要

- **場所**: `C:\Users\tosum\Projects\CreatureCamera54\`
- **内容**: Expo SDK 54 / React Native 0.81.5 / React 19.1.0 のシングルファイルアプリ
- **メインファイル**: `App.js`（約 3700 行）
- **動作環境**: Expo Go App Store 版 54.0.2（SDK 55+ は使用不可）
- **起動コマンド**: `npx expo start`
- **現在のバージョン**: `1.1.5`（app.json）/ build number 14（本セッションの成果として提出）

---

## 今セッションの変更内容

### 1. CreatureOverlay フェーズ対応アニメーション再開

**概要**: アラート表示後の OK 押下時に「退場アニメーションのみ」実行していた旧実装を、現在のアニメーションフェーズに応じて正しく継続する実装に書き直した。

**変更箇所**: `App.js` 〜731行（`CreatureOverlay` の `useEffect` 全体）

**旧実装の問題**:
- `resumeFnRef` はフェーズに関係なく常に「退場アニメーション」を実行していた
- `middle` オブジェクトが1回だけ生成されており、再利用時に動作しなかった（`Animated.sequence` は `.start()` 後に使い回せない）

**新実装**:
```js
let currentPhase = 'entering'; // 'entering' | 'capturable' | 'exiting'

const capturable   = () => { currentPhase = 'capturable'; onCapturable?.(); };
const uncapturable = () => { currentPhase = 'exiting';    onUncapturable?.(); };

// middle + 退場を毎回新規 Animated.sequence で生成
const makeMidAndExit = () => {
  Animated.sequence([...]).start(({ finished }) => {
    if (!finished || !alive) return;
    uncapturable();
    runExit();
  });
};

// 各ブランチ（isFade / isBounce / isFloatUp / isSpinIn / edge）で resumeEntry を設定
let resumeEntry = null;
// 例: isBounce の resumeEntry
resumeEntry = () => {
  Animated.parallel([
    Animated.timing(leftAnim, { toValue: targetLeft, duration: 400, useNativeDriver: false }),
    Animated.timing(topAnim,  { toValue: groundY,    duration: 400, useNativeDriver: false }),
  ]).start(({ finished }) => {
    if (!finished || !alive) return;
    capturable();
    if (pauseAfterCapturable) return;
    makeMidAndExit();
  });
};

// フェーズに応じた再開
if (resumeFnRef) resumeFnRef.current = () => {
  if (currentPhase === 'capturable') {
    makeMidAndExit();
  } else if (currentPhase === 'exiting') {
    runExit();
  } else {
    resumeEntry?.();
  }
};
```

**⚠️ 今後の注意点**:
- `Animated.sequence` は `.start()` 後に使い回し不可。再開やリトライが必要な場合は毎回新規生成する関数（`makeMidAndExit` など）として定義すること
- `resumeFnRef.current` は `useEffect` return の cleanup で必ず `null` に戻すこと（アンマウント後の呼び出しを防ぐ）

---

### 2. 設定・ギャラリー遷移時のアニメーション一時停止＆再開

**概要**: 設定・ギャラリー画面を開いたときにアニメーションを一時停止し、戻ったときにフェーズ対応で再開する。旧実装は `setActiveCreature(null)` で生き物を消去していた。

**変更箇所**: `App.js` 〜1451行（`wasOverlayOpenRef` の `useEffect`）

**旧実装**:
```js
if (isOpen) {
  clearTimeout(timerRef.current);
  setActiveCreature(null);        // 生き物を消去してしまっていた
  capturableRef.current = false;
  setCreatureCapturable(false);
  wasOverlayOpenRef.current = true;
}
```

**新実装**:
```js
if (isOpen) {
  alertActiveRef.current = true;
  clearTimeout(timerRef.current);
  pendingItemSpawnRef.current = null; // 保留アイテムをクリア
  creaturePauseFnRef.current?.();     // 消去ではなく停止
  wasOverlayOpenRef.current = true;
} else if (wasOverlayOpenRef.current) {
  wasOverlayOpenRef.current = false;
  alertActiveRef.current = false;
  if (creatureResumeFnRef.current) {
    creatureResumeFnRef.current();    // フェーズ対応で再開
  } else if (tutorialStepRef.current === 0) {
    scheduleNextCreatureRef.current?.();
  }
}
```

---

### 3. ギャラリー読み込み中のアニメーション停止漏れ修正

**概要**: `openGallery` は非同期関数であり、`MediaLibrary` 読み込みが完了するまで `setGalleryVisible(true)` を呼ばない。その間（数百ms）はアニメーションが停止しなかった。

**変更箇所**: `App.js` 〜1910行（`openGallery` 関数の先頭）

**修正**:
```js
const openGallery = async () => {
  if (saveMode === 'none') { showAlert(...); return; }
  // 非同期読み込み中もアニメーションを即時停止
  alertActiveRef.current = true;
  clearTimeout(timerRef.current);
  pendingItemSpawnRef.current = null;
  creaturePauseFnRef.current?.();
  try {
    // ... 非同期処理 ...
    setGalleryVisible(true); // useEffect も同じ処理をするが、すでに対処済み
  } catch (e) {
    showAlert(...); // showAlert.resume() がアニメーション再開を担当
  }
};
```

**⚠️ 今後の注意点（重要）**:
- 非同期関数内で状態変更（`setXxxVisible(true)`）が完了後に実行される場合、その前の処理中は `useEffect` が動かない
- 設定画面（`setSettingsVisible(true)` が同期）とギャラリー（`setGalleryVisible(true)` が非同期処理後）でこの問題が発生しやすい
- **非同期で画面遷移する関数には、必ず先頭でアニメーション停止処理を手動で追加すること**

---

### 4. 和気あいあいアイテムのシャッター条件修正

**概要**: `hasHarmony` が true のとき、生き物なしチェックと面積・不透明度チェックの両方をスキップしており、生き物がいない状態でも写真が撮れていた。

**変更箇所**: `App.js` 〜1614行（`takePicture`）

**修正**:
```js
// 変更前
if (!activeCreature && !hasHarmony) { ... } // 和気あいあいで丸ごとスキップ
if (activeCreature && !isSpecialCapture && !hasHarmony) { ... } // 可視チェックもスキップ

// 変更後
if (!activeCreature) { ... }             // 常に生き物が必要
if (activeCreature && !isSpecialCapture) { ... } // 常に可視チェック実施
```

**動作**:
- 和気あいあい発動中でも通常と同じ出現シーケンスが必要
- 可視判定をパスした後に、撮影写真へ追加4体を合成（`harmonyEntries`）

---

### 5. 特殊アイテム（isSpecial）の撮影判定修正

**概要**: アイテム生き物が fadein アニメーション（entering フェーズ）中は `capturableRef.current = false` のため、`isSpecialCapture = false` になり通常写真として保存されていた。アイテム効果が発動しない不具合。

**変更箇所**: `App.js` 〜1630行（`takePicture`）

**修正**:
```js
// 変更前
const isSpecialCapture = !!(activeCreature?.isSpecial && capturableRef.current);
// → fadein 中は capturableRef = false のため isSpecialCapture = false になってしまう

// 変更後
const isSpecialCapture = !!activeCreature?.isSpecial;
// → activeCreature に isSpecial: true があれば常にアイテム撮影として扱う
```

**⚠️ 今後の注意点（重要）**:
- `capturableRef.current` は「通常生き物が capturable フェーズに入ったか」を示すフラグであり、アイテム生き物（fadein 専用モード）には適さない
- アイテム生き物の出現可否は `activeCreature` の有無と可視判定（area / opacity）で判断すること
- アイテムの場合は可視判定もスキップ（`isSpecialCapture = true` ならば `!isSpecialCapture` の可視チェックブロックに入らない）

---

### 6. アラート表示中のアイテムタイマー制御

**概要**: アイテム出現の1秒タイマーが `alertActiveRef` を確認せずに `setActiveCreature` を直接呼んでいたため、アラート表示中でもアイテムが出現していた。

**変更箇所**:
- `App.js` 〜1061行：`pendingItemSpawnRef = useRef(null)` を追加
- `App.js` 〜1404行・1417行：アイテムタイマーの2箇所
- `App.js` 〜1508行：`showAlert.resume()`

**修正**:
```js
// アイテムタイマーコールバック
timerRef.current = setTimeout(() => {
  const spawnData = { creature: { ... }, mode: 'fadein', ... };
  if (alertActiveRef.current) {
    // アラート中は保留
    pendingItemSpawnRef.current = () => setActiveCreature({ ...spawnData, key: Date.now() });
  } else {
    setActiveCreature({ ...spawnData, key: Date.now() });
  }
}, 1000);

// showAlert.resume()
const resume = () => {
  alertActiveRef.current = false;
  if (pendingItemSpawnRef.current) {
    // 保留されたアイテムを出現
    const spawnFn = pendingItemSpawnRef.current;
    pendingItemSpawnRef.current = null;
    spawnFn();
  } else if (creatureResumeFnRef.current) {
    creatureResumeFnRef.current();
  } else {
    handleCreatureDone();
  }
};
```

**⚠️ 今後の注意点（重要）**:
- `scheduleNextCreature` は `alertActiveRef` を確認するが、`setActiveCreature` を直接呼ぶコールバック（アイテムタイマー等）は確認しない
- アラート表示中にタイマーが発火する可能性があるすべての `setActiveCreature` 直接呼び出しには `alertActiveRef` チェックを追加すること
- `key: Date.now()` は保留時点ではなく出現時点で生成すること（`spawnFn` 内で `Date.now()`）

---

## バグ修正チェックリスト（今後の実装時に必ず確認）

### アニメーション関連

1. **`Animated.sequence` の使い回し禁止**
   - `.start()` を呼んだ `Animated.sequence` オブジェクトは再利用不可
   - 再開・リトライが必要なアニメーションは毎回新規生成する関数として定義する

2. **`capturableRef.current` の意味を誤解しない**
   - これは「通常生き物が capturable フェーズか」を示すフラグ
   - アイテム生き物（`isSpecial: true`）の判定には使わない
   - アイテムは `activeCreature?.isSpecial` の有無で判断する

3. **非同期関数の画面遷移には先頭でアニメーション停止を追加**
   - `useEffect` は `setState` が完了した後のレンダーで動く
   - 非同期処理の途中は `useEffect` が動かない
   - `openGallery` のように非同期後に `setVisible(true)` する関数は、関数先頭で手動停止が必要

4. **`setActiveCreature` 直接呼び出しには `alertActiveRef` チェックを追加**
   - `scheduleNextCreature` 経由でない `setActiveCreature` 呼び出しはアラートブロックをすり抜ける
   - タイマーコールバック内の直接呼び出しには必ずチェックを追加し、`pendingItemSpawnRef` で保留する

5. **`resumeFnRef.current` は cleanup で必ず null に戻す**
   - `CreatureOverlay` アンマウント後に呼ばれないよう、`useEffect` の return 内で null クリアが必須

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

## Z-index 順序（現在）

| 要素 | zIndex |
|---|---|
| チュートリアルオーバーレイ | 300 |
| 設定オーバーレイ | 200 |
| controlPanel | 30 |
| camera finder | 20 |
| compositing フレームImage | 20 |
| ScopeOverlay | 15 |
| creature | 10 |
| camera / compositing | 0 |

---

## テーマ別特殊アニメーション（現在）

```js
const THEME_SPECIAL_ANIMS = {
  default: ['bounce',   'spin_in' ],
  flower:  ['float_up', 'spin_in' ],
  stylish: ['spin_in',  'float_up'],
  ocean:   ['float_up', 'bounce'  ],
  forest:  ['bounce',   'spin_in' ],
  savanna: ['bounce',   'spin_in' ],
};
```

---

## 主要 Ref 一覧（アニメーション・アラート制御）

| Ref | 用途 |
|---|---|
| `creaturePosRef` | アニメーション中の生き物座標（top/left）をリアルタイム追跡 |
| `creatureOpacityRef` | アニメーション中の不透明度をリアルタイム追跡 |
| `creaturePauseFnRef` | `pauseFnRef` 経由で受け取ったアニメーション停止関数 |
| `creatureResumeFnRef` | `resumeFnRef` 経由で受け取ったフェーズ対応再開関数 |
| `alertActiveRef` | アラート・オーバーレイ表示中フラグ（生き物スポーンをブロック） |
| `pendingItemSpawnRef` | アラート中にアイテムタイマーが発火したときの保留 spawn 関数 |
| `timerRef` | 次の生き物出現タイマー（スポーン遅延・アイテム1秒待機を兼用） |
| `wasOverlayOpenRef` | 設定/ギャラリー遷移後の再開判定フラグ |
| `capturableRef` | 通常生き物が capturable フェーズか（アイテム判定には使わない） |

---

## CREATURE_SETS 構造（現在）

```js
const CREATURE_SETS = {
  default: {
    basic: [ ...6体 ],
    time:     { id, emoji, size, hours: [21,22,23,0,1,2,3,4] },  // 夜
    seasonal: { id, emoji, size, months: [12,1,2] },              // 冬
  },
  // flower / stylish / ocean / forest / savanna も同構造
};
```

| テーマ | 時間限定 | 条件 | 季節限定 | 条件 |
|---|---|---|---|---|
| default | 🧟 zombie | 21:00〜4:59 | 🦠 microbe | 12・1・2月（冬） |
| flower | 🪷 lotus | 17:00〜19:59 | 🌷 tulip | 3・4・5月（春） |
| stylish | 💄 lipstick | 20:00〜23:59 | 👑 crown | 12・1月（年末年始） |
| ocean | 🦈 shark | 21:00〜4:59 | 🦀 crab | 7・8月（夏） |
| forest | 🐇 rabbit | 5:00〜8:59 | 🦌 deer | 9・10・11月（秋） |
| savanna | 🦛 hippo | 21:00〜4:59 | 🦒 giraffe | 6・7・8月（夏） |

---

## リリース履歴

| バージョン | build | 内容 |
|---|---|---|
| 1.1.6 | 15 | ギャラリーソート4モード・ギャラリー長時間放置バグ修正3件・App Store 提出済み（0505） |
| 1.1.5 | 14 | 可視判定強化・アラート/オーバーレイ中アニメーション停止修正・App Store 提出済み（0503） |
| 1.1.4 | 13 | 時間・季節限定キャラクター実装・App Store 提出済み（0501） |
| 1.1.3 | — | 未コミットのまま 1.1.4 に統合 |
| 1.1.2 | — | フレーム合成 Z-index 修正 / 設定画面紫テーマ / ピンチズーム |

---

## 未実装・改善候補（優先度順）

| 優先度 | 機能 | 備考 |
|---|---|---|
| 高 | App Store スクリーンショット差し替え | 日本語・英語コピー作成済み（0501セッション） |
| 中 | 生き物アイドルアニメーション | 停止中に微妙に揺れる・瞬き |
| 中 | 撮影成功リアクションアニメーション | 生き物が驚く演出 |
| 中 | 出現時の縁エフェクト | 画面端がふわっと光る |
| 中 | アイテムレアリティ表示（星） | データ構造の整備が先決 |
| 中 | アイテム図鑑コレクション画面 | 高難度 |
| 低 | ウェルカムボーナス（初回3回以内アイテム確定） | 天井ロジック流用 |
| 低 | 生き物出現中のパネル非表示演出 | activeCreature 監視で実装可 |
| 低 | VoiceOver/TalkBack 対応 | accessibilityLabel 付与のみ |

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
12. **`t()` のstale closure**: モジュールレベル `_langRef` + レンダー毎同期で解決
13. **ScopeOverlay 追尾アニメーション起点ズレ**: `stopAnimation(callback)` で実座標を取得してから計算するよう修正
14. **ScopeOverlay がフレームあり時に下まで浮遊**: `fullScreen` prop を追加し、浮遊範囲を `CAMERA_AREA_H` に制限
15. **bounce アニメーションが top と同じ印象**: 縦の放物線＋横移動を `Animated.parallel` で同時進行に変更
16. **フレーム合成の白帯**: 写真クリップ方式を廃止し、生き物Y座標に `SCREEN_H / CAMERA_AREA_H` を乗じる補正方式に変更
17. **設定・ギャラリー遷移時に生き物アニメーションが継続（旧）**: `wasOverlayOpenRef` を使った `useEffect` で停止＆再開を制御
18. **compositing フレームの上に生き物が重なる**: frameSource Image に `zIndex: 20` を追加して解決
19. **ズーム最大値1.0で撮影エラー**: 上限を `0.8` にクリップして解決
20. **アラート・オーバーレイ中のアニメーション停止（0503）**: `alertActiveRef` + `pendingItemSpawnRef` + `creaturePauseFnRef` / `creatureResumeFnRef` パターンで解決（詳細は本セッション「変更内容」参照）
21. **和気あいあい発動中に生き物なしで撮影可（0503）**: `hasHarmony` による生き物・可視チェックスキップを廃止
22. **アイテム fadein 中にシャッターで通常撮影（0503）**: `isSpecialCapture` 判定から `capturableRef.current` を除外
23. **ギャラリー読み込み中のアニメーション停止漏れ（0503）**: `openGallery` 先頭で即時停止処理を追加
24. **アラート表示中にアイテムが出現（0503）**: `pendingItemSpawnRef` でタイマーを保留し、アラート解除後に出現

# CreatureCamera54 セッション引き継ぎ — 2026-04-03

## プロジェクト概要

- **場所**: `C:\Users\tosum\Projects\CreatureCamera54\`
- **内容**: Expo SDK 54 / React Native 0.81.5 / React 19.1.0 のシングルファイルアプリ
- **メインファイル**: `App.js`（約 1910 行）
- **動作環境**: Expo Go App Store 版 54.0.2（SDK 55+ は使用不可）
- **起動コマンド**: `npx expo start`

---

## 現在の全定数・設定値

```js
const ALBUM_NAME       = 'CreatureCamera';
const PHOTO_LIMIT      = 30;
const OVERFLOW_LIMIT   = 80;
const PROTECT_LIMIT    = 20;
const FRAME_MAX        = 20;
const SPECIAL_ITEM_CHANCE = 0.05;
const SETTINGS_KEY     = 'creature_camera_settings';
const SAVED_PHOTOS_KEY = '@creature_camera_saved_photos';
```

---

## テーマ定義

```js
const THEMES = [
  { id: 'default', label: 'デフォルト',        deletable: false },
  { id: 'flower',  label: 'フラワー',          deletable: true  },
  { id: 'stylish', label: 'おしゃれ',          deletable: true  },
  { id: 'ocean',   label: '海の生き物',        deletable: true  },
  { id: 'forest',  label: '森の生き物',        deletable: true  },
  { id: 'savanna', label: 'サバンナの生き物',  deletable: true  },
];
const ALL_THEME_IDS = ['default', 'flower', 'stylish', 'ocean', 'forest', 'savanna'];
```

初期値（設定なし時）:
- `unlockedThemes`: `['default']`（デフォルトのみ）
- `frameCounts`: `{ default: 5, 他: 0 }`
- `fullScreen`: `false`
- `albumMode`: アルバムあり → `'album'`、なし → 確認ダイアログ

---

## 生き物セット（今セッションで変更あり）

```js
const CREATURE_SETS = {
  default: [
    { id: 'octopus',  emoji: '🐙', size: 80 },
    { id: 'alien',    emoji: '👽', size: 70 },
    { id: 'robot',    emoji: '🤖', size: 75 },
    { id: 'ghost',    emoji: '👻', size: 65 },
    { id: 'dragon',   emoji: '🐲', size: 90 },
  ],
  flower: [
    { id: 'butterfly', emoji: '🦋', size: 60 },
    { id: 'bee',       emoji: '🐝', size: 50 },
    { id: 'ladybug',   emoji: '🐞', size: 45 },
    { id: 'tulip',     emoji: '🌷', size: 60 },
    { id: 'ribbon',    emoji: '🎀', size: 55 },
  ],
  stylish: [ ... ], // 変更なし
  ocean: [
    { id: 'jellyfish', emoji: '🪼', size: 70 },
    { id: 'fish',      emoji: '🐟', size: 60 },
    { id: 'whale',     emoji: '🐳', size: 90 },  // ← 今セッションでイカ(🦑)から変更
    { id: 'octopus2',  emoji: '🐙', size: 80 },
    { id: 'dolphin',   emoji: '🐬', size: 85 },
  ],
  forest: [ ... ], // 変更なし
  savanna: [ ... ], // 変更なし
};
```

### CREATURE_ANIM 変更点

```js
// 変更前: squid: 'fadein'
// 変更後:
whale: 'edge',   // クジラは左右エッジから登場
```

---

## アニメーションシステム（今セッションで変更あり）

### `getEdgeSetup` — 移動距離2倍＋左右の縦位置制限

```js
function getEdgeSetup(edge, size, vp) {
  const { x: VX, y: VY, w: VW, h: VH } = vp;
  switch (edge) {
    // 上：移動距離 size+10 → 2*(size+10)
    case 'top':    return { initTop: VY - size, initLeft: VX + Math.random() * (VW - size),
                            enterTo: { top: VY + size + 20 } };
    // 下：clampBottomあり=20px、なし=2*(size+10)
    case 'bottom': return {
      initTop:  vp.clampBottom ? VY + VH - size : VY + VH,
      initLeft: VX + Math.random() * (VW - size),
      enterTo:  { top: vp.clampBottom ? VY + VH - size - 20 : VY + VH - 2 * size - 20 },
    };
    // 左右：縦位置をビューポート中央1/3に限定
    case 'left':   return { initTop: VY + VH / 3 + Math.random() * Math.max(0, VH / 3 - size),
                            initLeft: VX - size, enterTo: { left: VX + size + 20 } };
    case 'right':  return { initTop: VY + VH / 3 + Math.random() * Math.max(0, VH / 3 - size),
                            initLeft: VX + VW,   enterTo: { left: VX + VW - 2 * size - 20 } };
  }
}
```

### `ScopeOverlay` 漂いアニメーション — 中央50%面積に制限

```js
// 変更前: Math.random() * (SCREEN_W - SIZE) / Math.random() * (SCREEN_H - SIZE)
// 変更後:
const SW = SCREEN_W * Math.SQRT1_2;  // ≈ SCREEN_W * 0.707
const SH = SCREEN_H * Math.SQRT1_2;
const mx = (SCREEN_W - SW) / 2;
const my = (SCREEN_H - SH) / 2;
const tx = mx + Math.random() * Math.max(0, SW - SIZE);
const ty = my + Math.random() * Math.max(0, SH - SIZE);
```

### 撮影後のシャッフル（連続同生き物防止）

- `lastCreatureIdRef = useRef(null)` — 直前の生き物ID
- `scheduleNextCreatureRef = useRef(null)` — 最新の scheduleNextCreature を参照（stale closure 対策）
- `scheduleNextCreature` 内で直前と同IDなら1回リトライ
- 保存 Alert OK 後：`clearTimeout` → `setActiveCreature(null)` → `scheduleNextCreatureRef.current?.()` で即クリア＆再スケジュール

---

## 設定画面（今セッションで変更あり）

### テーマセクション — ドロップダウン

- 選択中テーマのみ表示（▼/▲ アイコン付き）
- タップで他のアンロック済みテーマが展開
- 別テーマ選択後は自動的に折りたたむ
- `themeDropdownOpen` state（初期 `false`）で管理

### フレーム・アルバムモード・カメラフレーム — 同一行表示

各設定を `[ラベル] [値テキスト] [Switch]` で1行に表示。

| 設定名 | ON表示 | OFF表示 |
|---|---|---|
| フレーム | あり | なし |
| アルバムモード | あり | なし |
| カメラフレーム | あり | なし（全画面） |

### 「カメラフレーム」改名 + スイッチ反転

- 旧名：「基本画面」、`value={fullScreen}`（ON=全画面）
- 新名：「カメラフレーム」、`value={!fullScreen}`（ON=フレームあり）
- `onValueChange={(v) => handleFullScreenToggle(!v)}`

### カメラファインダーフラッシュ修正

```jsx
// 変更前: {!fullScreen && !compositing && <Image ... />}
// 変更後: 常時マウント、opacity で表示制御
<Image
  source={CAMERA_FINDER}
  style={{ ..., opacity: (!fullScreen && !compositing) ? 1 : 0 }}
  pointerEvents="none"
/>
```

---

## 特殊アイテムシステム

### 定数

```js
const SPECIAL_ITEMS = [
  { type: 'theme',   weight: 10, emoji: '🎁', label: '新テーマ' },
  { type: 'frame',   weight: 40, emoji: '🌟', label: 'フレーム+5' },
  { type: 'harmony', weight: 20, emoji: '🎊', label: '和気あいあい' },
  { type: 'scope',   weight: 30, emoji: '🔭', label: 'スコープ' },
];
```

### 動作

- 特殊アイテム撮影：写真保存なし・直接効果適用（`isSpecialCapture` で早期 return）
- 和気あいあい：特殊アイテム撮影中は無効、通常/なし どちらでもシャッター消費
- スコープ：通常生き物撮影時のみ消費（`wasScope` フラグ）

---

## 状態・Ref 一覧（App 内）

```js
// State
const [harmonyActive, setHarmonyActive]               = useState(false);
const [scopeActive, setScopeActive]                   = useState(false);
const [creatureCapturable, setCreatureCapturable]     = useState(false);
const [themeDropdownOpen, setThemeDropdownOpen]       = useState(false); // 今セッション追加

// Ref
const harmonyActiveRef        = useRef(false);
const scopeActiveRef          = useRef(false);
const lastCreatureIdRef       = useRef(null);   // 今セッション追加
const scheduleNextCreatureRef = useRef(null);   // 今セッション追加

// 毎レンダーで同期
scheduleNextCreatureRef.current = scheduleNextCreature;
```

---

## compositing 状態のフィールド

```js
{
  photoUri:         string,
  creatureSnapshot: { creature, pos, edge, isSpecial, itemType } | null,
  frameSource:      require(...) | null,
  usedFrameTheme:   string | null,
  harmonyEntries:   [{ creature, pos }] | null,
  wasScope:         boolean,
}
```

---

## ギャラリー・写真管理

- `PHOTO_LIMIT=30`：アルバム上限（カメラロールは制限なし）
- `OVERFLOW_LIMIT=80`：超過モード時の表示上限
- `PROTECT_LIMIT=20`：保護できる写真の上限
- 超過モード：アルバムモードのみ。起動時・撮影後チェック、ギャラリーclose ブロック
- 超過時 Alert → OK → `openGallery()`（削除候補UIなし）
- `closeGallery` ブロック条件：`saveModeRef.current === 'album' && overflowModeRef.current && galleryCountRef.current > PHOTO_LIMIT`

---

## AsyncStorage キー

- `creature_camera_settings` → `{ theme, albumMode, frameEnabled, fullScreen, unlockedThemes, frameCounts }`
- `@creature_camera_saved_photos` → `{ [assetId]: true }`（保護済み写真ID）

---

## Z-index 順序（フレームモード）

| 要素 | zIndex |
|---|---|
| controlPanel | 30 |
| camera finder（CAMERA_FINDER） | 20 |
| ScopeOverlay | 15 |
| creature（生き物）| 10 |
| camera / compositing | 0 |

---

## アセット

```
assets/frame-default.png
assets/frame-flower.png
assets/frame-stylish.png
assets/frame-ocean.png
assets/frame-forest.png
assets/frame-savanna.png
assets/camera-finder.png
assets/splash-icon.png
```

---

## 既知の注意点・過去のバグ修正

1. **ビューワー close フラッシュ**: `viewerOpacity.setValue(1)` を `closeViewer` 内で呼ぶと React アンマウント前にネイティブ側が更新されフラッシュ。`setValue` は `openViewer` 側でのみ呼ぶ。

2. **compositing 中の `setCompositing(null)`**: `finally` でなく Alert OK ハンドラ内で呼ぶ。`finally` だと次のコンポジットが開始できなくなる。

3. **特殊アイテム効果の適用タイミング**: 保存 Alert OK 後に `setTimeout(..., 100)` で遅延実行。`setCompositing(null)` の後。

4. **`useCallback([])` 内の stale closure 対策**: `closeGallery` 等は `saveModeRef`, `overflowModeRef`, `galleryCountRef` などの ref 経由で最新値を参照。

5. **iOS MediaLibrary**: `getAssetsAsync` は `ph://` URI を返す。`Image` 表示には `getAssetInfoAsync(asset).localUri` が必要。`localUri` が null の資産は除外。

6. **カメラファインダーフラッシュ**: 全画面⇔フレームモード切替時に Image の条件マウントでフラッシュが発生していた。常時マウント＋opacity 制御で修正済み。

7. **二重超過 Alert 防止**: `skipOverflowAlertRef.current = true` をセットしてから `setOverflowMode(true)` することで、起動時 useEffect の Alert と inline Alert の重複を防ぐ。

---

## 未実装・TODO

現時点で未実装の仕様はなし。今回のセッションで以下を実装した：

- アニメーション移動距離2倍
- 左右アニメーションの縦位置を中央1/3に限定
- スコープ漂いを中央50%面積に限定
- 撮影後の生き物シャッフル（連続同生き物防止）
- 海テーマのイカ→クジラ変更
- 設定画面のリデザイン（ドロップダウン、同行表示、改名、スイッチ反転、フラッシュ修正）

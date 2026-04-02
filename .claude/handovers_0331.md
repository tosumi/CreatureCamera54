# CreatureCamera54 セッション引き継ぎ — 2026-04-01

## プロジェクト概要

- **場所**: `C:\Users\tosum\Projects\CreatureCamera54\`
- **内容**: Expo SDK 54 / React Native 0.81.5 / React 19.1.0 のシングルファイルアプリ
- **メインファイル**: `App.js`（約 1976 行）
- **動作環境**: Expo Go App Store 版 54.0.2（SDK 55+ は使用不可）
- **起動コマンド**: `npx expo start`

---

## 現在の全定数・設定値

```js
const ALBUM_NAME       = 'CreatureCamera';
const PHOTO_LIMIT      = 20;
const OVERFLOW_LIMIT   = 50;
const PROTECT_LIMIT    = 15;
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
- `unlockedThemes`: 全テーマ解放（DEBUG）
- `frameCounts`: 全テーマ 5 回
- `fullScreen`: `false`
- `albumMode`: アルバムあり → `'album'`、なし → 確認ダイアログ

---

## 特殊アイテムシステム（今回実装済み）

### 定数

```js
const SPECIAL_ITEMS = [
  { type: 'theme',   weight: 10, emoji: '🎁', label: '新テーマ' },
  { type: 'frame',   weight: 40, emoji: '🌟', label: 'フレーム+5' },
  { type: 'harmony', weight: 20, emoji: '🎊', label: '和気あいあい' },
  { type: 'scope',   weight: 30, emoji: '🔭', label: 'スコープ' },
];
```

### 2段階抽選（`scheduleNextCreature`）

1. `Math.random() < 0.05` → 特殊アイテム（`pickSpecialItem()` で重み付き抽選）
2. それ以外 → 通常生き物（従来通り）

特殊アイテムは `isSpecial: true, itemType, itemLabel` を付与した `activeCreature` として fadein モードで出現。

### 各アイテムの効果（撮影後 Alert OK 押下後に適用）

| アイテム | 効果 |
|---|---|
| 🎁 新テーマ | ランダムにロックされたテーマを解除。フレーム残り < 5 なら 5 にリセット。全テーマ取得済みなら通知のみ |
| 🌟 フレーム+5 | 現在選択中テーマのフレーム残り +5（上限 `FRAME_MAX=20`）|
| 🎊 和気あいあい | `harmonyActive = true` にセット。次の撮影で +4 体（同テーマランダム）|
| 🔭 スコープ | `scopeActive = true` にセット。`ScopeOverlay` が表示開始 |

### 和気あいあいの動作

- `harmonyActive = true` のとき：
  - **特殊アイテム撮影中は無効**（`isSpecialCapture=true` なら `hasHarmony=false`）
  - 通常生き物・生き物なし どちらでもシャッター押下で消費
  - 4 体分の位置を `calculateHarmonyPositions(pos, size)` で計算
    - 位置: メイン生き物位置を画面中心基準で時計回り 90°、180°、270°、0° 回転
    - 画面外の場合はランダムな画面内位置へフォールバック
  - 4 体は `pickCreature(theme)` でテーマ内ランダムに選択
  - コンポジット状態に `harmonyEntries: [{ creature, pos }, ...]` を格納
  - コンポジット JSX でフレームあり・なし両方に描画済み

### スコープの動作（`ScopeOverlay` コンポーネント）

```
scopeActive=true → ScopeOverlay レンダリング開始
  ↓
【漂いフェーズ】creatureActive=false のとき
  ランダムな画面内座標へ 1800-2600ms で移動を繰り返す

  ↓ activeCreature が現れる（key 変更 → コンポーネント再マウント）

【追跡フェーズ】creatureActive=true のとき
  150ms ごとに creaturePosRef.current の位置へ追従

  ↓ capturable=true（生き物が入場完了）

【二回拡大フェーズ】
  1.0 → 1.9 → 1.0 → 1.9 → 1.0 → opacity:0 → 消える
  （phaseRef = 'zoom' → 'done'）

スコープ消費：compositing.wasScope=true のとき（通常生き物撮影時のみ）
  → setScopeActive(false)
```

- 生き物が捕捉されなかった場合 → `wasScope=false` → スコープ残存
- 特殊アイテム撮影時 → `wasScope=false` → スコープ残存
- key: `scopeActive && activeCreature` → `'scope-{activeCreature.key}'`、なし → `'scope-idle'`

---

## 状態・Ref 一覧（App 内、今回追加分）

```js
// State
const [harmonyActive, setHarmonyActive]           = useState(false);
const [scopeActive, setScopeActive]               = useState(false);
const [creatureCapturable, setCreatureCapturable] = useState(false);

// Ref（毎レンダーで同期）
const harmonyActiveRef = useRef(false);
const scopeActiveRef   = useRef(false);
```

`creatureCapturable` は `onCapturable` / `onUncapturable` コールバックと `handleCreatureDone` でセット/リセット。ScopeOverlay の `capturable` プロップに渡す。

---

## コンポーネント構成

### `CreatureOverlay` props（今回追加）

```jsx
<CreatureOverlay
  ...
  isSpecial={activeCreature.isSpecial}   // boolean | undefined
  itemLabel={activeCreature.itemLabel}   // string | undefined
  onCapturable={() => { capturableRef.current = true; setCreatureCapturable(true); }}
  onUncapturable={() => { capturableRef.current = false; setCreatureCapturable(false); }}
/>
```

特殊アイテムのとき、emoji の下にラベルテキストを表示。

### `ScopeOverlay` props

```jsx
<ScopeOverlay
  key={activeCreature ? `scope-${activeCreature.key}` : 'scope-idle'}
  posRef={creaturePosRef}
  creatureActive={!!activeCreature}
  capturable={creatureCapturable}
  onAnimComplete={() => {}}   // no-op（スコープは自動消費しない）
/>
```

---

## compositing 状態のフィールド

```js
{
  photoUri:        string,
  creatureSnapshot: {
    creature: { id, emoji, size },
    pos:      { top, left },
    edge:     string | null,
    isSpecial: boolean | undefined,
    itemType:  string | undefined,
  } | null,
  frameSource:      require(...) | null,
  usedFrameTheme:   string | null,
  harmonyEntries:   [{ creature, pos }] | null,  // 和気あいあい
  wasScope:         boolean,                     // スコープ消費フラグ
}
```

---

## ギャラリー・写真管理（前セッションより）

- `PHOTO_LIMIT=20`：通常アルバム上限
- `OVERFLOW_LIMIT=50`：超過モード時の表示上限
- `PROTECT_LIMIT=15`：保護できる写真の上限
- 超過モード（`overflowMode` state）：起動時にアルバム枚数 > 20 なら true（アルバムモード時のみ）
- 保護アイコン：⭐（保護）/ ☆（解除）、グリッドバッジは金色丸 + 白 ★
- 選択モードヘッダー背景：`#2c2c2e`
- 写真数表示：`保護枚数/全体枚数`（超過時は赤太字）
- ビューワー close アニメーション：`setValue` を closeViewer で呼ばない（フラッシュ防止）

### AsyncStorage キー

- `creature_camera_settings` → `{ theme, albumMode, frameEnabled, fullScreen, unlockedThemes, frameCounts, deleteMode }`
- `@creature_camera_saved_photos` → `{ [assetId]: true }`（保護済み写真 ID）

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

## 生き物アニメーション

- `CREATURE_ANIM` map: `edge` / `edge3` / `top` / `fadein`
- フレームモード時の vp: `{ x:10, y:20, w:SCREEN_W-20, h:CAMERA_AREA_H-20, clampBottom:true }`
- `clampBottom`: 下から出る生き物の初期 top = `VY + VH - size`（パネル上端）
- 左エッジ (`edge === 'left'`): `scaleX: -1` 反転（CreatureOverlay + compositing 両方）

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

## 未実装・TODO

現時点で未実装の仕様はなし。今回のセッションで特殊アイテムシステムを完全実装した。

---

## 既知の注意点・過去のバグ修正

1. **ビューワー close フラッシュ**: `viewerOpacity.setValue(1)` を `closeViewer` コールバック内で呼ぶと、React アンマウント前にネイティブ側が更新されてフラッシュする。`setValue` は `openViewer` 側でのみ呼ぶ。

2. **compositing 中は `setCompositing(null)` を finally でなく Alert OK ハンドラ内で**。finally で呼ぶと次の写真コンポジットが開始できなくなる。

3. **特殊アイテム効果の適用タイミング**: 保存 Alert の OK ボタン押下後に `setTimeout(() => ..., 100)` で遅延実行。`setCompositing(null)` の後に呼ぶことで、コンポジット状態の stale closure を安全に参照できる。

4. **`useCallback([])` 内の stale closure 対策**: `closeGallery` 等は `saveModeRef`, `overflowModeRef`, `galleryCountRef` などの ref 経由で最新値を参照。

5. **iOS MediaLibrary**: `getAssetsAsync` は `ph://` URI を返す。`Image` で表示するには `getAssetInfoAsync(asset).localUri` が必要。`localUri` が null の資産は除外。

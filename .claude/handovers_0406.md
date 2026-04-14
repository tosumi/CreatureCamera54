# CreatureCamera54 セッション引き継ぎ — 2026-04-07

## プロジェクト概要

- **場所**: `C:\Users\tosum\Projects\CreatureCamera54\`
- **内容**: Expo SDK 54 / React Native 0.81.5 / React 19.1.0 のシングルファイルアプリ
- **メインファイル**: `App.js`（約 2100 行）
- **動作環境**: Expo Go App Store 版 54.0.2（SDK 55+ は使用不可）
- **起動コマンド**: `npx expo start`

---

## 全定数・設定値

```js
const ALBUM_NAME        = 'CreatureCamera';
const SETTINGS_KEY      = 'creature_camera_settings';
const SAVED_PHOTOS_KEY  = '@creature_camera_saved_photos';
const AUTO_DELETE_KEY   = '@creature_camera_auto_delete';
const AUDIO_SETTINGS_KEY = '@creature_camera_audio';
const PHOTO_LIMIT       = 30;
const OVERFLOW_LIMIT    = 80;
const PROTECT_LIMIT     = 20;
const FRAME_MAX         = 20;
const SPECIAL_ITEM_CHANCE = 0.05;
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
- `unlockedThemes`: `['default']`
- `frameCounts`: `{ default: 5, 他: 0 }`
- `fullScreen`: `false`

---

## アニメーションシステム（今セッション大幅変更）

### vp（ビューポート）の定義

```js
// scheduleNextCreature 内
const vp = fullScreen
  ? { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, fullScreen: true }
  : { x: 10, y: 20, w: SCREEN_W - 20, h: CAMERA_AREA_H - 20, clampBottom: true, fullScreen: false };

const FULL_VP = { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, fullScreen: true };
```

`fullScreen` フラグを vp に含めるようになった（安全フレーム計算に使用）。

### 安全フレーム（今セッション追加）

```js
function getSafeFrame(vp) {
  const { x: VX, y: VY, w: VW, h: VH, fullScreen: isFS } = vp;
  const hmPct = isFS ? 0.25 : 0.20; // 上下マージン割合
  const wPct  = 0.10;                // 左右マージン割合
  return {
    left:   VX + VW * wPct,
    top:    VY + VH * hmPct,
    right:  VX + VW * (1 - wPct),
    bottom: VY + VH * (1 - hmPct),
  };
}
```

- 全画面モード: 上下 SCREEN_H の 25%・左右 SCREEN_W の 10%
- フレームモード: 上下 VH の 20%・左右 VW の 10%

### `getEdgeSetup` — 現行実装（今セッション全面リライト）

旧来の「横位置を中央1/2・縦位置を中央1/3に限定」制限を廃止。
新規制限：
1. **enterTo が安全フレーム内に収まる**
2. **ビューポート中点を超えない**（来た方向の半分に留まる）

```js
function getEdgeSetup(edge, size, vp) {
  const { x: VX, y: VY, w: VW, h: VH } = vp;
  const sf   = getSafeFrame(vp);
  const midX = VX + VW / 2;
  const midY = VY + VH / 2;
  const safeW = Math.max(0, sf.right  - sf.left  - size);
  const safeH = Math.max(0, sf.bottom - sf.top   - size);

  switch (edge) {
    case 'top': {
      // 上から入る → 上半分（midY）を超えない
      const rH = Math.max(0, Math.min(sf.bottom, midY) - size - sf.top);
      return { initTop: VY - size, initLeft: sf.left + Math.random() * safeW,
               enterTo: { top: sf.top + Math.random() * rH } };
    }
    case 'bottom': {
      // 下から入る → 下半分（midY）を超えない
      const rTop = Math.max(sf.top, midY);
      const rH   = Math.max(0, sf.bottom - size - rTop);
      return { initTop: VY + VH, initLeft: sf.left + Math.random() * safeW,
               enterTo: { top: rTop + Math.random() * rH } };
    }
    case 'left': {
      // 左から入る → 左半分（midX）を超えない
      const rW = Math.max(0, Math.min(sf.right, midX) - size - sf.left);
      return { initTop: sf.top + Math.random() * safeH, initLeft: VX - size,
               enterTo: { left: sf.left + Math.random() * rW } };
    }
    case 'right': {
      // 右から入る → 右半分（midX）を超えない
      const rLeft = Math.max(sf.left, midX);
      const rW    = Math.max(0, sf.right - size - rLeft);
      return { initTop: sf.top + Math.random() * safeH, initLeft: VX + VW,
               enterTo: { left: rLeft + Math.random() * rW } };
    }
  }
}
```

### fadein 初期位置（今セッション変更）

特殊アイテム以外の fadein も安全フレーム内に配置。

```js
// CreatureOverlay 内
const sf = getSafeFrame(viewport);
const initTop  = isFade ? sf.top  + Math.random() * Math.max(0, sf.bottom - sf.top  - creature.size) : edgeSetup.initTop;
const initLeft = isFade ? sf.left + Math.random() * Math.max(0, sf.right  - sf.left - creature.size) : edgeSetup.initLeft;
```

**注意**: 特殊アイテムは `isSpecial: true` の fadein で、安全フレーム制約も半分超え制約も適用されない（vp が fullScreen の FULL_VP 固定）。

### ScopeOverlay 待機範囲

変更なし（画面中央50%面積・`Math.SQRT1_2` × 各辺）。

---

## pickCreature の変更（今セッション）

```js
function pickCreature(theme) {
  const set     = CREATURE_SETS[theme] ?? CREATURE_SETS.default;
  const base    = set[Math.floor(Math.random() * set.length)];
  const variant = SIZE_VARIANTS[Math.floor(Math.random() * SIZE_VARIANTS.length)];
  return { ...base, size: base.size * variant.scale, scale: variant.scale }; // scale を追加
}
```

`scale` フィールドをデバッグ表示用に追加（1.0 = Small、1.2 = Midd、1.5 = Large）。

---

## デバッグモード（今セッション追加）

### 設定

- `debugMode`: boolean（有効/無効）
- `setDebugMode` で切替（永続化なし、セッション限り）
- 設定画面の「SE：」の下に「デバッグ：On/Off」スイッチとして追加

### デバッグオーバーレイ表示

`debugMode = true` かつ撮影合成中でない時、画面中央に表示（`pointerEvents="none"`、`zIndex: 100`）。

```jsx
{debugMode && !compositing && (
  (() => {
    const debugVpW = fullScreen ? SCREEN_W : SCREEN_W - 20;
    const debugVpH = fullScreen ? SCREEN_H : CAMERA_AREA_H - 20;
    const finalPos = creatureFinalPosRef.current;
    const scale = activeCreature?.creature?.scale ?? null;
    const objSize = scale == null ? '-' : scale >= 1.5 ? 'Large' : scale >= 1.2 ? 'Midd' : 'Small';
    return (
      <View pointerEvents="none" style={{ position: 'absolute', zIndex: 100,
        top: SCREEN_H / 2 - 50, left: 0, right: 0, alignItems: 'center' }}>
        <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8,
          paddingHorizontal: 16, paddingVertical: 10, gap: 4 }}>
          <Text style={{ color: '#0f0', fontFamily: 'monospace', fontSize: 13 }}>
            Scr-Size: {Math.round(debugVpW)} x {Math.round(debugVpH)}
          </Text>
          <Text style={{ color: '#0f0', fontFamily: 'monospace', fontSize: 13 }}>
            Anm-POS: {Math.round(finalPos.left)} x {Math.round(finalPos.top)}
          </Text>
          <Text style={{ color: '#0f0', fontFamily: 'monospace', fontSize: 13 }}>
            Obj-Size: {objSize}
          </Text>
        </View>
      </View>
    );
  })()
)}
```

---

## ギャラリー画面（今セッション変更）

### フォトビューワーの保護/解除アイコン逆転

```jsx
// 保護済み → ⭐、未保護 → ☆（グリッドの ★ バッヂはそのまま）
{savedPhotoIds[galleryAssets[selectedIndex]?.id] ? '⭐' : '☆'}
```

グリッドの保護バッヂ（`★`）と選択モードのアクションボタン（`⭐`/`☆`）は変更なし。

---

## 状態・Ref 一覧（App 内）

```js
// State（今セッション追加）
const [debugMode, setDebugMode] = useState(false); // デバッグ表示（永続化なし）

// 既存（変更なし）
const [harmonyActive, setHarmonyActive]           = useState(false);
const [scopeActive, setScopeActive]               = useState(false);
const [creatureCapturable, setCreatureCapturable] = useState(false);
const [autoDelete, setAutoDelete]                 = useState(false);
const [autoDeleteTarget, setAutoDeleteTarget]     = useState('oldest');
const [bgmEnabled, setBgmEnabled]                 = useState(true);
const [seEnabled, setSeEnabled]                   = useState(true);

// Ref（変更なし）
const harmonyActiveRef        = useRef(false);
const scopeActiveRef          = useRef(false);
const autoDeleteRef           = useRef(false);
const autoDeleteTargetRef     = useRef('oldest');
const creatureFinalPosRef     = useRef({ top: 0, left: 0 });
```

---

## AsyncStorage キー

| キー | 内容 |
|---|---|
| `creature_camera_settings` | `{ theme, albumMode, frameEnabled, fullScreen, unlockedThemes, frameCounts }` |
| `@creature_camera_saved_photos` | `{ [assetId]: true }` 保護済み写真ID |
| `@creature_camera_auto_delete` | `{ autoDelete, autoDeleteTarget }` |
| `@creature_camera_audio` | `{ bgmEnabled, seEnabled }` |

`debugMode` は AsyncStorage に保存しない（セッション限り）。

---

## Z-index 順序

| 要素 | zIndex |
|---|---|
| デバッグオーバーレイ | 100 |
| 設定オーバーレイ | 200 |
| controlPanel | 30 |
| camera finder | 20 |
| ScopeOverlay | 15 |
| creature | 10 |
| camera / compositing | 0 |

---

## 既知の注意点・バグ修正履歴

1. **ビューワー close フラッシュ**: `setValue` は `closeViewer` 内で呼ばない
2. **compositing `setCompositing(null)`**: Alert OK ハンドラ内で呼ぶ
3. **`useCallback([])` stale closure**: ref 経由で最新値を参照
4. **iOS MediaLibrary**: `getAssetsAsync` は `ph://` URI → `getAssetInfoAsync(asset).localUri` が必要
5. **カメラファインダーフラッシュ**: 常時マウント＋opacity 制御で修正済み
6. **設定画面 fullScreen 切替で再アニメーション**: Modal→絶対配置Viewに変更で修正済み
7. **自動削除がアラート前に実行**: OK押下後に移動して修正済み
8. **スコープ座標飛び**: ポーリング廃止・最終座標への1本アニメーションで修正済み
9. **二重超過 Alert 防止**: `skipOverflowAlertRef.current = true` してから `setOverflowMode(true)`

---

## 未実装・TODO

現時点で未実装の仕様はなし。

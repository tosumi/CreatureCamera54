# CreatureCamera54 セッション引き継ぎ — 2026-04-04

## プロジェクト概要

- **場所**: `C:\Users\tosum\Projects\CreatureCamera54\`
- **内容**: Expo SDK 54 / React Native 0.81.5 / React 19.1.0 のシングルファイルアプリ
- **メインファイル**: `App.js`（約 2022 行）
- **動作環境**: Expo Go App Store 版 54.0.2（SDK 55+ は使用不可）
- **起動コマンド**: `npx expo start`

---

## 全定数・設定値

```js
const ALBUM_NAME        = 'CreatureCamera';
const SETTINGS_KEY      = 'creature_camera_settings';
const SAVED_PHOTOS_KEY  = '@creature_camera_saved_photos';
const AUTO_DELETE_KEY   = '@creature_camera_auto_delete';  // 自動削除専用キー（今セッション追加）
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

## 海の生き物テーマ（今セッション変更）

```js
ocean: [
  { id: 'jellyfish', emoji: '🪼', size: 70 },
  { id: 'fish',      emoji: '🐟', size: 60 },
  { id: 'whale',     emoji: '🐳', size: 90 },  // ← イカ(🦑)から変更済み
  { id: 'octopus2',  emoji: '🐙', size: 80 },
  { id: 'dolphin',   emoji: '🐬', size: 85 },
],
// CREATURE_ANIM: whale: 'edge'
```

---

## アニメーションシステム（今セッションで変更あり）

### `getEdgeSetup` — 現行実装

```js
// 上下は横位置をビューポート中央1/2に限定
case 'top':    return { initTop: VY - size,
                        initLeft: VX + VW/4 + Math.random() * Math.max(0, VW/2 - size),
                        enterTo: { top: VY + size + 20 } };
case 'bottom': return {
  // フレームモード・全画面とも VY+VH（コントロールパネル上端）から開始
  initTop:  VY + VH,
  initLeft: VX + VW/4 + Math.random() * Math.max(0, VW/2 - size),
  enterTo:  { top: VY + VH - 2*size - 20 },
};
// 左右は上下位置をビューポート中央1/3に限定
case 'left':   return { initTop: VY + VH/3 + Math.random() * Math.max(0, VH/3 - size),
                        initLeft: VX - size, enterTo: { left: VX + size + 20 } };
case 'right':  return { initTop: VY + VH/3 + Math.random() * Math.max(0, VH/3 - size),
                        initLeft: VX + VW,   enterTo: { left: VX + VW - 2*size - 20 } };
```

### 和気あいあい配置（今セッション変更）

```js
// 画面中央50%面積（各辺 sqrt(0.5)≈70.7%）のランダム配置
function calculateHarmonyPositions(count, size) {
  const SW = SCREEN_W * Math.SQRT1_2;
  const SH = SCREEN_H * Math.SQRT1_2;
  const mx = (SCREEN_W - SW) / 2;
  const my = (SCREEN_H - SH) / 2;
  return Array.from({ length: count }, () => ({
    left: mx + Math.random() * Math.max(0, SW - S),
    top:  my + Math.random() * Math.max(0, SH - S),
  }));
}
// 呼び出し: calculateHarmonyPositions(4, HARM_SIZE)
```

### ScopeOverlay（今セッション大幅変更）

**フロー**: float（漂い）→ track（最終座標へ直線移動）→ zoom（二回拡大）→ done

**漂い範囲**: 画面中央50%面積（sqrt(0.5) × 各辺）に制限

**追跡アニメーション（今セッション修正）**:
- ポーリング廃止 → 生き物出現時に1本の直線アニメーション
- `finalPosRef`（生き物の最終停止座標）を使用
- 距離 ÷ 380px/s でduration計算（最低250ms）
- `leftAnim._value` / `topAnim._value` で現在座標を取得

```js
// 生き物の最終座標の中心を照準
const targetLeft = finalPosRef.current.left + creatureSize/2 - SIZE/2;
const targetTop  = finalPosRef.current.top  + creatureSize/2 - SIZE/2;
const dist = Math.sqrt(dx*dx + dy*dy);
const duration = Math.max(250, (dist / 380) * 1000);
```

**スコープの消費**: 通常生き物撮影時のみ（`wasScope` フラグ）

### スコープ座標伝達の仕組み（今セッション追加）

`CreatureOverlay` → App → `ScopeOverlay` の経路:

```js
// CreatureOverlay の useEffect 先頭で最終座標を通知
const finalTop  = isFade ? initTop  : (enterTo?.top  !== undefined ? enterTo.top  : initTop);
const finalLeft = isFade ? initLeft : (enterTo?.left !== undefined ? enterTo.left : initLeft);
onFinalPos?.({ top: finalTop, left: finalLeft });

// App
const creatureFinalPosRef = useRef({ top: 0, left: 0 });
// CreatureOverlay: onFinalPos={(pos) => { creatureFinalPosRef.current = pos; }}
// ScopeOverlay:   finalPosRef={creatureFinalPosRef}
```

### スコープ待機範囲

画面中央50%面積（`Math.SQRT1_2` = √0.5 ≈ 0.707 × 各辺）に限定。

---

## 特殊アイテムシステム

- 特殊アイテム撮影：写真保存なし・直接効果適用
- 和気あいあい：特殊アイテム撮影中は無効、通常/なし どちらでもシャッター消費
- スコープ：通常生き物撮影時のみ消費

---

## 状態・Ref 一覧（App 内）

```js
// State
const [harmonyActive, setHarmonyActive]           = useState(false);
const [scopeActive, setScopeActive]               = useState(false);
const [creatureCapturable, setCreatureCapturable] = useState(false);
const [autoDelete, setAutoDelete]                 = useState(false);       // 今セッション追加
const [autoDeleteTarget, setAutoDeleteTarget]     = useState('oldest');    // 今セッション追加
const [themeDropdownOpen, setThemeDropdownOpen]   = useState(false);

// Ref
const harmonyActiveRef        = useRef(false);
const scopeActiveRef          = useRef(false);
const autoDeleteRef           = useRef(false);           // 今セッション追加
const autoDeleteTargetRef     = useRef('oldest');        // 今セッション追加
const lastCreatureIdRef       = useRef(null);
const scheduleNextCreatureRef = useRef(null);
const creatureFinalPosRef     = useRef({ top: 0, left: 0 }); // 今セッション追加

// 毎レンダーで同期
scheduleNextCreatureRef.current = scheduleNextCreature;
autoDeleteRef.current           = autoDelete;
autoDeleteTargetRef.current     = autoDeleteTarget;
```

---

## AsyncStorage キー

| キー | 内容 |
|---|---|
| `creature_camera_settings` | `{ theme, albumMode, frameEnabled, fullScreen, unlockedThemes, frameCounts }` |
| `@creature_camera_saved_photos` | `{ [assetId]: true }` 保護済み写真ID |
| `@creature_camera_auto_delete` | `{ autoDelete, autoDeleteTarget }` ← **今セッション追加（独立キー）** |

`persistSettings` のシグネチャは変更なし（自動削除は別キーで管理）。

---

## 自動削除システム（今セッション追加）

### 設定

- `autoDelete`: boolean（有効/無効）
- `autoDeleteTarget`: `'newest'` | `'oldest'`

### 動作フロー

```
「写真が撮れた」アラート → OK押下 → 上限チェック（アルバムモードのみ）
  → 上限超過 AND autoDelete=true
    → deleteAssetsAsync（個別 try/catch）
      → 成功: 再チェック、まだ超過なら overflow
      → 失敗（キャンセル含む）: isOverLimit=true → overflow
  → 上限超過 AND autoDelete=false → overflow
```

**重要**: 自動削除は `saveModeRef.current === 'album'` の時のみ実行。カメラロールモードでは一切動作しない。

### 実行タイミング（今セッション修正）

「写真が撮れた」アラートの **OK押下後** に実行。以前は保存直後（アラート前）に実行していたためシステム削除ダイアログが先に表示される問題があった。

---

## 設定画面（今セッションで変更あり）

### テーマセクション（2行構成）

- 1行目: 「テーマ：」ラベル
- 2行目: ドロップダウントグル（▼/▲）
- **折りたたみ時**: 選択中テーマ名のみ、削除アイコンなし
- **展開時**: アンロック済みテーマを固定順（THEMES配列順）で表示。`default` 以外に削除アイコン

### 設定の同行表示

`[ラベル] [値テキスト] [Switch]` を同一行に表示。

| 設定 | ON表示 | OFF表示 |
|---|---|---|
| フレーム | あり | なし |
| アルバムモード | On（撮影上限あり） | Off（撮影上限なし） |
| カメラフレーム | あり | なし（全画面） |

### 自動削除（アルバムモードON時のみ表示）

- 自動削除スイッチ（有効/無効）
- 有効時のみ: 「最新の写真」/「最後の写真」選択ボタン（`autoDeleteBtn` / `autoDeleteBtnActive` スタイル）

### カメラフレームスイッチの反転

```jsx
<Switch
  value={!fullScreen}
  onValueChange={(v) => handleFullScreenToggle(!v)}
/>
```

### 設定オーバーレイ（Modal廃止）

**重要**: 設定画面は `<Modal>` から絶対配置 `<View>` に変更済み。

```jsx
{settingsVisible && (
  <View style={[styles.settingsContainer, styles.settingsOverlay]}>
    ...
  </View>
)}
// styles.settingsOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200 }
```

理由: iOS の Modal は背後のレイアウト変化（fullScreen切替）で再アニメーションが発生するため。

---

## カメラファインダーフラッシュ修正

```jsx
// 常時マウント・opacity で表示制御（切替時のフラッシュ防止）
<Image
  source={CAMERA_FINDER}
  style={{ ..., opacity: (!fullScreen && !compositing) ? 1 : 0 }}
  pointerEvents="none"
/>
```

---

## 撮影後シャッフル

保存 Alert OK 後:
```js
clearTimeout(timerRef.current);
capturableRef.current = false;
setCreatureCapturable(false);
setActiveCreature(null);
scheduleNextCreatureRef.current?.();
```

連続同生き物防止: `lastCreatureIdRef` で直前IDを記録、同IDなら1回リトライ。

---

## compositing 状態のフィールド

```js
{
  photoUri, creatureSnapshot: { creature, pos, edge, isSpecial, itemType } | null,
  frameSource, usedFrameTheme, harmonyEntries: [{ creature, pos }] | null, wasScope: boolean,
}
```

---

## Z-index 順序

| 要素 | zIndex |
|---|---|
| 設定オーバーレイ | 200 |
| controlPanel | 30 |
| camera finder | 20 |
| ScopeOverlay | 15 |
| creature | 10 |
| camera / compositing | 0 |

---

## 既知の注意点・バグ修正履歴

1. **ビューワー close フラッシュ**: `setValue` は `closeViewer` 内で呼ばない（`openViewer` 側のみ）
2. **compositing `setCompositing(null)`**: `finally` でなく Alert OK ハンドラ内で呼ぶ
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

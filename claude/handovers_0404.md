# CreatureCamera54 セッション引き継ぎ — 2026-04-04

## プロジェクト概要

- **場所**: `C:\Users\tosum\Projects\CreatureCamera54\`
- **内容**: Expo SDK 54 / React Native 0.81.5 / React 19.1.0 のシングルファイルアプリ
- **メインファイル**: `App.js`（約 2200 行）
- **動作環境**: Expo Go App Store 版 54.0.2（SDK 55+ は使用不可）
- **起動コマンド**: `npx expo start`

---

## 全定数・設定値

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
const SPECIAL_ITEM_CHANCE = 0.05; // 通常値（デバッグ時は0.5に変更）
```

---

## 音声ファイル一覧（今セッション追加）

```
assets/se_switch_on.mp3      ← 設定スイッチ OFF→ON
assets/se_switch_off.mp3     ← 設定スイッチ ON→OFF
assets/se_delete.mp3         ← ギャラリー削除・設定テーマ削除
assets/se_item_theme.mp3     ← テーマアイテム入手
assets/se_item_frame.mp3     ← フレームアイテム入手
assets/se_item_scope.mp3     ← スコープアイテム入手（powerup04.mp3）
assets/se_item_harmony.mp3   ← 和気あいあいアイテム入手（powerup02.mp3）
assets/se_harmony_photo.mp3  ← 和気あいあい使用中のシャッター時（fairies2.mp3）
assets/se_no_creature.mp3    ← 生き物がいない時のシャッター（blip01.mp3）
assets/se_open_cabinet.mp3   ← ドロップダウン開く・選択モード開始
assets/se_close_cabinet.mp3  ← ドロップダウン閉じる・選択モード終了
assets/se_button01a.mp3      ← テーマ選択・自動削除ボタン・保護/解除
assets/bgm_main.mp3          ← BGMループ（電話をする人.mp3）
```

```js
const SE_SWITCH_ON     = require('./assets/se_switch_on.mp3');
const SE_SWITCH_OFF    = require('./assets/se_switch_off.mp3');
const SE_DELETE        = require('./assets/se_delete.mp3');
const SE_ITEM_THEME    = require('./assets/se_item_theme.mp3');
const SE_ITEM_FRAME    = require('./assets/se_item_frame.mp3');
const SE_ITEM_SCOPE    = require('./assets/se_item_scope.mp3');
const SE_ITEM_HARMONY  = require('./assets/se_item_harmony.mp3');
const SE_HARMONY_PHOTO = require('./assets/se_harmony_photo.mp3');
const SE_NO_CREATURE   = require('./assets/se_no_creature.mp3');
const SE_OPEN_CABINET  = require('./assets/se_open_cabinet.mp3');
const SE_CLOSE_CABINET = require('./assets/se_close_cabinet.mp3');
const SE_BUTTON01A     = require('./assets/se_button01a.mp3');
const BGM_MAIN         = require('./assets/bgm_main.mp3');
```

---

## 音声SE呼び出しポイント一覧

| イベント | SE |
|---|---|
| 設定スイッチ OFF→ON | `playSE(SE_SWITCH_ON)` |
| 設定スイッチ ON→OFF | `playSE(SE_SWITCH_OFF)` |
| SE スイッチ OFF→ON | `playRawSE(SE_SWITCH_ON)`（seEnabledRefがfalseのため） |
| テーマドロップダウンを開く | `playSE(SE_OPEN_CABINET)` |
| テーマドロップダウンを閉じる | `playSE(SE_CLOSE_CABINET)` |
| テーマドロップダウン内でテーマ選択 | `playSE(SE_BUTTON01A)` |
| 自動削除「最新/最後」ボタン選択 | `playSE(SE_BUTTON01A)` |
| ギャラリー削除実行 | `playSE(SE_DELETE)` |
| 設定テーマ削除確認OK | `playSE(SE_DELETE)` |
| テーマアイテム入手 | `playSE(SE_ITEM_THEME)` |
| フレームアイテム入手 | `playSE(SE_ITEM_FRAME)` |
| スコープアイテム入手（初回・パワーアップ共通） | `playSE(SE_ITEM_SCOPE)` |
| 和気あいあいアイテム入手 | `playSE(SE_ITEM_HARMONY)` |
| 和気あいあい使用中のシャッター（ポジション算出時） | `playSE(SE_HARMONY_PHOTO)` |
| 生き物がいない時のシャッター | `playSE(SE_NO_CREATURE)` |
| ギャラリー保護/保護解除アイコンタップ | `playSE(SE_BUTTON01A)` |
| ギャラリー選択モードへ移行 | `playSE(SE_OPEN_CABINET)` |
| ギャラリーグリッドモードへ移行 | `playSE(SE_CLOSE_CABINET)` |

---

## 音声実装（BGM/SE設定）

### インポート・初期化

```js
import { Audio } from 'expo-av';  // expo-av インストール済み

// 起動時1回
useEffect(() => {
  Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
}, []);
```

### 状態・Ref

```js
const [bgmEnabled, setBgmEnabled] = useState(true);
const [seEnabled, setSeEnabled]   = useState(true);
const bgmEnabledRef = useRef(true);
const seEnabledRef  = useRef(true);
const bgmSoundRef   = useRef(null);
```

### 永続化キー

`@creature_camera_audio` → `{ bgmEnabled, seEnabled }`

### SE再生関数

```js
// seEnabled=true の時のみ再生
const playSE = useCallback(async (source) => {
  if (!seEnabledRef.current) return;
  const { sound } = await Audio.Sound.createAsync(source);
  await sound.playAsync();
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.didJustFinish) sound.unloadAsync();
  });
}, []);

// seEnabled に関わらず再生（SE OFF→ON 切替時のフィードバック用）
const playRawSE = useCallback(async (source) => { ... }, []);
```

### BGM管理

`bgmEnabled` が変わるたびに停止/再生。`isLooping: true` でループ。

### 設定画面

カメラフレームの下に「BGM：あり/なし」と「SE：あり/なし」のスイッチを追加。

---

## 特殊アイテムシステム（今セッション変更）

### pickSpecialItem（除外リスト対応）

```js
function pickSpecialItem(excludeTypes = []) {
  const pool  = excludeTypes.length
    ? SPECIAL_ITEMS.filter(i => !excludeTypes.includes(i.type))
    : SPECIAL_ITEMS;
  const total = pool.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of pool) { r -= item.weight; if (r <= 0) return item; }
  return pool[pool.length - 1];
}
```

### scheduleNextCreature

```js
// スコープ残り2回以上の場合はスコープを除外
const item = pickSpecialItem(scopeCountRef.current >= 2 ? ['scope'] : []);
```

---

## スコープシステム（今セッション変更）

### 使用回数カウント

```js
const scopeCountRef = useRef(0);  // スコープ残り使用回数（表示なし）
```

### 取得時の動作

| 状況 | 動作 |
|---|---|
| スコープ未発動 → 🔭取得 | `scopeCountRef.current = 1`、通常メッセージ |
| スコープ発動中 → 🔭取得 | `scopeCountRef.current = 5`、「パワーアップ！」メッセージ |

```js
} else if (itype === 'scope') {
  if (scopeActiveRef.current) {
    scopeCountRef.current = 5;
    playSE(SE_ITEM_SCOPE);
    Alert.alert('🔭 スコープ、パワーアップ！', 'スコープの連続5回使えます。');
  } else {
    setScopeActive(true);
    scopeActiveRef.current = true;
    scopeCountRef.current = 1;
    playSE(SE_ITEM_SCOPE);
    Alert.alert('🔭 スコープ！', '生き物の登場場所がわかるようになりました！');
  }
}
```

### 消費タイミング（デクリメント）

- 通常生き物撮影時（`wasScope`）
- 特殊アイテム撮影時（🔭以外）

```js
scopeCountRef.current = Math.max(0, scopeCountRef.current - 1);
if (scopeCountRef.current === 0) {
  setScopeActive(false);
  scopeActiveRef.current = false;
}
```

**🔭パワーアップ取得時はデクリメントしない。**

---

## 和気あいあいシステム（今セッション変更）

### 発動中は特殊アイテムを出さない

```js
// 1段階目：特殊アイテム抽選（和気あいあい発動中はスキップ）
if (!harmonyActiveRef.current && Math.random() < SPECIAL_ITEM_CHANCE) { ... }
```

### 重なり防止（50%面積以上重ならない）

```js
const overlaps = (a, b) => {
  const ox = Math.max(0, S - Math.abs(a.left - b.left));
  const oy = Math.max(0, S - Math.abs(a.top  - b.top));
  return ox * oy > 0.5 * S * S;
};
// 最大50回リトライして配置
```

### SE タイミング

`playSE(SE_HARMONY_PHOTO)` → `calculateHarmonyPositions` 呼び出し直前（シャッター押下時）

---

## 森の生き物フレーム更新

`assets/frame-forest.png` を新しい画像に差し替え済み。

---

## AsyncStorage キー

| キー | 内容 |
|---|---|
| `creature_camera_settings` | `{ theme, albumMode, frameEnabled, fullScreen, unlockedThemes, frameCounts }` |
| `@creature_camera_saved_photos` | `{ [assetId]: true }` 保護済み写真ID |
| `@creature_camera_auto_delete` | `{ autoDelete, autoDeleteTarget }` |
| `@creature_camera_audio` | `{ bgmEnabled, seEnabled }` |

---

## 未実装・TODO

現時点で未実装の仕様はなし。

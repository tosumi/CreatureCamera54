# CreatureCamera54 セッション引き継ぎ — 2026-05-01

## プロジェクト概要

- **場所**: `C:\Users\tosum\Projects\CreatureCamera54\`
- **内容**: Expo SDK 54 / React Native 0.81.5 / React 19.1.0 のシングルファイルアプリ
- **メインファイル**: `App.js`（約 3600 行）
- **動作環境**: Expo Go App Store 版 54.0.2（SDK 55+ は使用不可）
- **起動コマンド**: `npx expo start`
- **現在のバージョン**: `1.1.4`（app.json）/ build number 13

---

## 今セッションの変更内容

### 1. 時間・季節限定キャラクター実装

**概要**: 各テーマ8体を basic 6体 / time 1体（時間限定）/ seasonal 1体（季節限定）に分類。

**データ構造変更**（452行〜）:

```js
// 変更前: フラット配列
const CREATURE_SETS = {
  default: [ ...8体 ],
};

// 変更後: 3区分オブジェクト
const CREATURE_SETS = {
  default: {
    basic: [ ...6体 ],
    time:     { id, emoji, size, hours: [...] },   // 出現可能時刻（24時間制）
    seasonal: { id, emoji, size, months: [...] },  // 出現可能月（1〜12）
  },
};
```

**各テーマの割り当て**:

| テーマ | 時間限定 | 条件 | 季節限定 | 条件 |
|---|---|---|---|---|
| default | 🧟 zombie | 21:00〜4:59 | 🦠 microbe | 12・1・2月（冬） |
| flower | 🪷 lotus | 17:00〜19:59 | 🌷 tulip | 3・4・5月（春） |
| stylish | 💄 lipstick | 20:00〜23:59 | 👑 crown | 12・1月（年末年始） |
| ocean | 🦈 shark | 21:00〜4:59 | 🦀 crab | 7・8月（夏） |
| forest | 🐇 rabbit | 5:00〜8:59 | 🦌 deer | 9・10・11月（秋） |
| savanna | 🦛 hippo | 21:00〜4:59 | 🦒 giraffe | 6・7・8月（夏） |

**`pickCreature` 変更**（536行〜）:

```js
function pickCreature(theme) {
  const set   = CREATURE_SETS[theme] ?? CREATURE_SETS.default;
  const now   = new Date();
  const hour  = now.getHours();
  const month = now.getMonth() + 1;

  const pool = [...set.basic];
  if (set.time     && set.time.hours.includes(hour))       pool.push(set.time);
  if (set.seasonal && set.seasonal.months.includes(month)) pool.push(set.seasonal);

  const base    = pool[Math.floor(Math.random() * pool.length)];
  const variant = SIZE_VARIANTS[Math.floor(Math.random() * SIZE_VARIANTS.length)];
  return { ...base, size: base.size * variant.scale, scale: variant.scale };
}
```

- `CREATURE_ANIM` は全IDが既登録のため変更不要
- 新しい state / AsyncStorage 追加なし
- 時刻・日付変更への追従は自動（pickCreature 呼び出しごとに `new Date()` を評価）

---

## リリース履歴

| バージョン | build | 内容 |
|---|---|---|
| 1.1.6 | 15 | ギャラリーソート4モード・ギャラリー長時間放置バグ修正3件・App Store 提出済み（0505） |
| 1.1.5 | 14 | 可視判定強化・アラート/オーバーレイ中アニメーション停止修正・App Store 提出済み（0503） |
| 1.1.4 | 13 | 時間・季節限定キャラクター実装・App Store 提出済み（0501） |
| 1.1.3 | — | （未コミットのまま 1.1.4 に統合） |
| 1.1.2 | — | フレーム合成 Z-index 修正 / 設定画面紫テーマ / ピンチズーム |

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

## 未実装・改善候補（優先度順）

| 優先度 | 機能 | 備考 |
|---|---|---|
| 高 | App Store スクリーンショット差し替え | 日本語・英語コピー作成済み（今セッション） |
| 中 | 生き物アイドルアニメーション | 停止中に微妙に揺れる・瞬き |
| 中 | 撮影成功リアクションアニメーション | 生き物が驚く演出 |
| 中 | 出現時の縁エフェクト | 画面端がふわっと光る |
| 中 | アイテムレアリティ表示（星） | データ構造の整備が先決 |
| 中 | アイテム図鑑コレクション画面 | 高難度 |
| 低 | ウェルカムボーナス（初回3回以内アイテム確定） | 天井ロジック流用 |
| 低 | 生き物出現中のパネル非表示演出 | activeCreature 監視で実装可 |
| 低 | VoiceOver/TalkBack 対応 | accessibilityLabel 付与のみ |

---

## App Store スクリーンショット コピー（作成済み・未提出）

### 日本語版（4枚・メインのみ）

1. 「カメラをのぞいたら、ふしぎな生き物がひょっこり。どの子が来るかは、そのときのお楽しみ。」
2. 「通信なし・広告なし・追加課金なし。子どもにそのままわたせる、安心設計。」
3. 「むずかしい操作はゼロ。生き物を見つけてシャッターを押すだけで、魔法みたいな写真のできあがり。」
4. 「その瞬間だけの生き物・フレーム・場所。二度と同じ写真は撮れない、とっておきの一枚。」

### 英語版（4枚・メインのみ）

1. "Peek through the camera and surprise — a quirky little creature just showed up. Who will appear next? That's the fun part."
2. "No internet. No ads. No hidden charges. Safe to hand to your child, just like that."
3. "No complicated steps. Spot a creature, press the shutter, and like magic — an amazing photo appears."
4. "A unique creature, a one-of-a-kind frame, a moment that won't come again. Every photo is a little treasure."

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
17. **設定・ギャラリー遷移時に生き物アニメーションが継続**: `wasOverlayOpenRef` を使った `useEffect` で停止＆再開を制御
18. **compositing フレームの上に生き物が重なる**: frameSource Image に `zIndex: 20` を追加して解決
19. **ズーム最大値1.0で撮影エラー**: 上限を `0.8` にクリップして解決

# CreatureCamera54 セッション引き継ぎ — 2026-05-05

## プロジェクト概要

- **場所**: `C:\Users\tosum\Projects\CreatureCamera54\`
- **内容**: Expo SDK 54 / React Native 0.81.5 / React 19.1.0 のシングルファイルアプリ
- **メインファイル**: `App.js`（約 3660 行）
- **動作環境**: Expo Go App Store 版 54.0.2（SDK 55+ は使用不可）
- **起動コマンド**: `npx expo start`
- **現在のバージョン**: `1.1.6`（app.json）/ build number 15

---

## 今セッションの変更内容

### ギャラリーソート機能の実装

#### 概要
ギャラリーに4種類のソートモードを追加した。ソートボタンはギャラリーヘッダー右側（☑️の左）に配置し、タップするたびに循環切り替え。

#### ソートモード
| モード | ラベル | 動作 |
|--------|--------|------|
| `'newest'` | 🕐 | 撮影日時・新しい順（デフォルト） |
| `'oldest'` | 🕙 | 撮影日時・古い順 |
| `'favorite'` | ★ | 保護あり優先→保護なし（各グループ内は新しい順） |
| `'theme'` | 🎨 | テーマ別グループ（THEMES 定義順、テーマ不明は末尾） |

#### 追加した定数・State・Ref

```js
// 定数（~354行）
const PHOTO_THEMES_KEY = '@creature_camera_photo_themes'; // 写真ごとのテーマID記録

// State（~1124行）
const [gallerySortMode, setGallerySortMode] = useState('newest');

// Ref（~1183行）
const gallerySortModeRef  = useRef('newest');
const photoThemeMapRef    = useRef({}); // {[assetId]: themeId}
const pendingResortRef    = useRef(false); // ビューワー保護操作後の再ソート待ちフラグ
const photoBaseOrderRef   = useRef({}); // {[assetId]: index} MediaLibrary取得時の新しい順インデックス
```

#### `savePicture` の変更（~1374行）

`saveToLibraryAsync` を `createAssetAsync` に統一。これにより default モードでも `asset.id` を取得でき、テーマIDを AsyncStorage に記録できるようになった。

```js
async function savePicture(uri, themeId) {
  const asset = await MediaLibrary.createAssetAsync(uri);
  if (saveMode === 'album') { /* アルバムへ追加 */ }
  // テーマを記録
  const existing = JSON.parse(await AsyncStorage.getItem(PHOTO_THEMES_KEY) ?? '{}');
  existing[asset.id] = themeId;
  photoThemeMapRef.current = existing;
  await AsyncStorage.setItem(PHOTO_THEMES_KEY, JSON.stringify(existing));
}
```

呼び出し側（compositing useEffect ~1800行）: `await savePicture(uri, theme)`

#### `fetchGalleryAssets` 関数（新設、`openGallery` の直前）

`openGallery` と `reloadGallery` が共通で使う取得＋ソートロジック。

- `'newest'` / `'oldest'`: `[[MediaLibrary.SortBy.creationTime, false/true]]` で MediaLibrary から直接ソート
- `'favorite'` / `'theme'`: `'newest'` で取得後に JavaScript ソート
- **`photoBaseOrderRef` の更新**: JS ソート前に `items` の順序（新しい順インデックス）を記録

`'favorite'` ソートの comparator（グループ内順序保証付き）:
```js
(a, b) => {
  const af = savedPhotoIdsRef.current[a.id] ? 1 : 0;
  const bf = savedPhotoIdsRef.current[b.id] ? 1 : 0;
  if (bf !== af) return bf - af; // 保護あり優先
  // グループ内: 新しい順（photoBaseOrderRef のインデックス昇順）
  return (photoBaseOrderRef.current[a.id] ?? 999) - (photoBaseOrderRef.current[b.id] ?? 999);
}
```

#### `openGallery` のリファクタ（~1921行）

`fetchGalleryAssets(gallerySortModeRef.current)` を呼ぶだけに簡略化。`null` 返却（アルバムなし）と空配列をそれぞれアラートで処理。

#### `reloadGallery` のリファクタ（~2537行）

同様に `fetchGalleryAssets` を使う1行に簡略化。

#### `cycleSortMode` 関数（新設、`reloadGallery` の直後）

`gallerySortModeRef.current` と `gallerySortMode` state を同時に更新し、`fetchGalleryAssets` で即再読み込み。

#### ソートボタン UI（~3083行）

通常ヘッダーの `galleryHeaderRight` View 内、☑️ボタンの左に追加:
```jsx
<TouchableOpacity style={styles.gallerySortBtn} onPress={cycleSortMode}>
  <Text style={styles.gallerySortText}>
    {gallerySortMode === 'newest' ? '🕐' : gallerySortMode === 'oldest' ? '🕙' : gallerySortMode === 'favorite' ? '★' : '🎨'}
  </Text>
</TouchableOpacity>
```

スタイル追加:
```js
gallerySortBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.15)', marginRight: 6 },
gallerySortText: { color: '#fff', fontSize: 15 },
```

---

### ソート関連バグ修正

#### 選択モードの保護/保護解除後の即時再ソート

`executeProtect` / `executeUnprotect` にて `savedPhotoIdsRef.current = newSaved` の直後（`await persistSavedPhotoIds` の**前**）に再ソートを実行。`await` より前に置くことで非同期タイミングに依存しない。

#### ビューワーの保護/保護解除後の再ソート

`handleViewerProtectToggle` の保護/保護解除 `onPress` 内で、`savedPhotoIdsRef.current = newSaved` の直後に `pendingResortRef.current = true` をセット（`await` より前）。`closeViewer` の setTimeout（アニメーション完了 15ms後）で `pendingResortRef.current` を確認し、`setGalleryAssets` で再ソート。

```js
// closeViewer の setTimeout 内
if (pendingResortRef.current) {
  pendingResortRef.current = false;
  setGalleryAssets(prev => [...prev].sort(favoriteComparator));
}
```

#### グループ内の新しい順保証（`photoBaseOrderRef`）

**問題**: 保護→保護解除すると写真が元の順序に戻らない。保護なし同士はすべてソートキーが同じ(0)になるため、stable sort でも以前の操作後の位置が維持されてしまう。

**解決**: `fetchGalleryAssets` でMediaLibraryから取得した時点（新しい順）のインデックスを `photoBaseOrderRef` に保存し、favoriteソートの第2キーとして使用。これにより「保護あり→新しい順」「保護なし→新しい順」が常に保証される。

---

## ⚠️ 今後の注意点

### ソート関連

1. **`await` より前に state/ref/フラグを更新**: `showAlert` の `onPress` は async 関数を await しないため（`{ btn.onPress?.(); resume(); }` のラッパー）、`await` 以降の処理は `resume()` より後に実行される。UI変更・フラグセットは必ず `await` 前に行うこと。

2. **インメモリ再ソートの第2キー**: `'favorite'` モードのインメモリ再ソートは必ず `photoBaseOrderRef` を第2キーとして使う。使わないと全保護解除時に元の順序に戻らない。

3. **`photoBaseOrderRef` の更新タイミング**: `fetchGalleryAssets` が呼ばれた時点（ギャラリーを開く・`cycleSortMode` でソート切替・`reloadGallery`）に更新される。ギャラリーを開き直さない限り、撮影時の新規写真は `photoBaseOrderRef` に含まれない（ギャラリーを開き直せば反映）。

---

## 定数・設定値（現在）

```js
const ALBUM_NAME              = 'CreatureCamera';
const SETTINGS_KEY            = 'creature_camera_settings';
const SAVED_PHOTOS_KEY        = '@creature_camera_saved_photos';
const AUTO_DELETE_KEY         = '@creature_camera_auto_delete';
const AUDIO_SETTINGS_KEY      = '@creature_camera_audio';
const PHOTO_THEMES_KEY        = '@creature_camera_photo_themes'; // 0505追加
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

## 主要 Ref 一覧（アニメーション・アラート・ギャラリー制御）

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
| `gallerySortModeRef` | ギャラリーソートモード（stale closure 対策） |
| `photoThemeMapRef` | `{assetId: themeId}` 写真ごとのテーマ記録 |
| `pendingResortRef` | ビューワー保護操作後の再ソート待ちフラグ |
| `photoBaseOrderRef` | `{assetId: index}` MediaLibrary取得時の新しい順インデックス（favorite ソートの第2キー） |

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
20. **アラート・オーバーレイ中のアニメーション停止（0503）**: `alertActiveRef` + `pendingItemSpawnRef` + `creaturePauseFnRef` / `creatureResumeFnRef` パターンで解決
21. **和気あいあい発動中に生き物なしで撮影可（0503）**: `hasHarmony` による生き物・可視チェックスキップを廃止
22. **アイテム fadein 中にシャッターで通常撮影（0503）**: `isSpecialCapture` 判定から `capturableRef.current` を除外
23. **ギャラリー読み込み中のアニメーション停止漏れ（0503）**: `openGallery` 先頭で即時停止処理を追加
24. **アラート表示中にアイテムが出現（0503）**: `pendingItemSpawnRef` でタイマーを保留し、アラート解除後に出現
25. **ギャラリーソート（0505）**: `fetchGalleryAssets` + `cycleSortMode` + `photoBaseOrderRef` で4モード実装
26. **favorite ソートの保護解除後に元順序に戻らない（0505）**: `photoBaseOrderRef` を第2ソートキーに使用することで解決
27. **ビューワー保護操作後の再ソートが await 後になる（0505）**: `pendingResortRef.current = true` を `await` より前に移動して解決
28. **ギャラリー表示中に予告SE鳴動・ギャラリー自動終了（0505）**: `showAlert` の `resume()` がオーバーレイ開放中でも `alertActiveRef.current = false` にしてしまう問題。`resume()` 先頭に `galleryVisibleRef` / `settingsVisibleRef` チェックを追加し、オーバーレイが開いたままの場合は `alertActiveRef.current = true` を維持して即 return するよう修正
29. **BGM 冒頭ループ（0505）**: `interruptionModeAndroid: DoNotMix` のため SE 再生のたびに BGM がフォーカスを奪われ stop 状態になり、`setOnPlaybackStatusUpdate` の自動再開が位置 0 から連続実行される問題。`MixWithOthers` に変更して BGM と SE の同時再生を許可することで解決

---

## 追加した Ref（0505 後半セッション）

| Ref | 用途 |
|---|---|
| `galleryVisibleRef` | `showAlert.resume()` でオーバーレイ開放中チェックに使用（renderセクションで毎レンダー同期） |
| `settingsVisibleRef` | 同上 |

---

## ⚠️ 今後の注意点（0505追加）

### showAlert / resume() パターン

- `resume()` はギャラリー・設定が**開いたまま**呼ばれる可能性がある（削除確認・保護確認・エラーアラート等）
- `useEffect([settingsVisible, galleryVisible])` は state **変化時のみ**再実行されるため、`resume()` が `alertActiveRef = false` にしても `useEffect` は再実行されない
- **ルール**: `resume()` の先頭で必ず `galleryVisibleRef.current || settingsVisibleRef.current` を確認し、true なら `alertActiveRef.current = true` のまま return すること

### Android オーディオ設定

- `interruptionModeAndroid` は **`MixWithOthers`** を使うこと（`DoNotMix` に戻さない）
- `DoNotMix` にすると自アプリの SE が BGM を stop させ、`setOnPlaybackStatusUpdate` の連続 `playAsync()` で BGM が冒頭ループを繰り返す

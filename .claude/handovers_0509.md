# CreatureCamera54 セッション引き継ぎ — 2026-05-09

## プロジェクト概要

- **場所**: `C:\Users\tosum\Projects\CreatureCamera54\`
- **内容**: Expo SDK 54 / React Native 0.81.5 / React 19.1.0 のシングルファイルアプリ
- **メインファイル**: `App.js`（約 3801 行）
- **動作環境**: Expo Go App Store 版 54.0.2（SDK 55+ は使用不可）
- **起動コマンド**: `npx expo start`
- **現在のバージョン**: `1.1.6`（app.json）/ build number 15（未リリース）

---

## 今セッションの変更内容

### アイテムシステム大幅拡張

#### 概要
3ペルソナ討論（Ultraplan）を経て、アイテムを4種→7種に拡張。既存バグ修正も実施。

#### 新アイテム一覧（7種・合計ウェイト100）

| アイテム | 絵文字 | ウェイト | 効果 |
|---------|-------|---------|------|
| 新テーマ | 🎁 | 5 | ロック中テーマを解放（全解放済みはフレーム+5に降格） |
| フレーム+5 | 🌟 | 40 | フレーム残数+5（上限超過時は別テーマへ振り替え） |
| 和気あいあい | 🎊 | 10 | 次の撮影で4体同時出現 |
| スコープ | 🔭 | 16 | 照準スコープ演出 |
| タイムスロー | ⏱️ | 13 | 次の生き物の滞在時間×2.5倍 |
| セピアレンズ | 🕰️ | 8 | 次の撮影写真がセピア調 |
| モノクロレンズ | 🎞️ | 8 | 次の撮影写真がモノクロ |

#### フレーム+5 上限超過バグ修正
- 現テーマが上限(20)のとき: 上限未満の別テーマにランダム振り替え
- 別テーマに振り替えた場合のアラートメッセージを追加（`alert_frame_redirect_body`）

#### アイテム抽選除外ロジック（スマート除外）
| 条件 | 除外アイテム |
|------|------------|
| スコープ発動中 | scope |
| タイムスロー発動中 | timeslow |
| フィルター発動中 | sepia または mono（発動中の種別） |
| 取得済み全テーマのフレームが上限 | frame |
| 全テーマ取得済み かつ 全フレーム上限 | frame + theme |

実装箇所: `scheduleNextCreature` 内 `pickSpecialItem` 呼び出し（2箇所、`replace_all` で統一）

---

### セピア/モノクロフィルター実装（WebView Canvas方式）

#### 技術的経緯
1. **RN `filter` スタイル（Image）**: view-shot にキャプチャされないため不採用
2. **View オーバーレイ方式**: 動作したが見た目がセピアに見えない（単純な色重ね）
3. **WebView + `ctx.filter`**: エラーなしだが効果なし（WebViewで非サポート）
4. **WebView + `getImageData/putImageData`**: ピクセル直接変換 → 採用 ✅

#### 実装フロー
```
撮影 → takePictureAsync → (filterActive?) →
  YES: FileSystem.readAsStringAsync(base64) →
       隠しWebView(HTML Canvas + ピクセル変換) →
       onMessage(dataURL) → writeAsStringAsync(cacheDir) →
       filtered URI → setCompositing
  NO:  photo.uri → setCompositing
```

#### ピクセル変換係数
```js
// sepia
px[j]   = Math.min(255, r*0.393 + g*0.769 + b*0.189);
px[j+1] = Math.min(255, r*0.349 + g*0.686 + b*0.168);
px[j+2] = Math.min(255, r*0.272 + g*0.534 + b*0.131);

// grayscale
var gr = px[j]*0.299 + px[j+1]*0.587 + px[j+2]*0.114;
px[j] = px[j+1] = px[j+2] = gr;
```

#### フォールバック設計
- `applyPhotoFilter` が失敗 → フィルターなし写真で続行（撮影失敗エラーにしない）
- `onMessage` 失敗 → `resolve(null)` → 呼び出し元 catch でフォールバック

#### 追加した依存パッケージ
```
npx expo install expo-file-system react-native-webview
```
- import: `expo-file-system/legacy`（v18 では `/legacy` 必須）
- import: `react-native-webview`（Expo Go 組み込み済み）

#### 追加した State・Ref（`filterTypeRef` 周辺）
```js
const [filterType, setFilterType]         = useState(null);   // null | 'sepia' | 'mono'
const filterTypeRef                        = useRef(null);
const [filterPending, setFilterPending]    = useState(null);   // WebViewリクエスト
const filterResolveRef                     = useRef(null);     // Promise resolve保持
const unlockedThemesRef                    = useRef([...]);    // 除外ロジック用
```

---

### デバッグ設定（本番リリース前に要戻し）

```js
// App.js ~370行
const SPECIAL_ITEM_CHANCE = 1.00; // デバッグ用：アイテム100%（本番は0.10）
```

---

## ⚠️ 今後の注意点

### フィルターアイテム

1. **処理時間**: 写真サイズによりWebViewでの変換に1〜3秒かかる場合がある。シャッター後の間は正常動作。

2. **和気あいあいとフィルターの共存**: 両者は独立して動作する。フィルターは `hasHarmony` 処理の後、`appliedFilter = filterTypeRef.current` で取得されるため、和気あいあい撮影でもフィルターは正常に適用される。

3. **フィルター発動中のアイテム重複防止**: `filterTypeRef.current` が truthy の間は同種フィルターが `pickSpecialItem` の除外リストに入る。

4. **`expo-file-system` の import パス**: `expo-file-system/legacy` を使うこと（`expo-file-system` だと `readAsStringAsync` が deprecated エラー）

### アイテムウェイト設計

- **合計ウェイト = 100** を維持すること
- frame(40) は最多出現で固定。新アイテム追加時は他のウェイトを按分調整する

---

## 定数・設定値（現在）

```js
const ALBUM_NAME              = 'CreatureCamera';
const SETTINGS_KEY            = 'creature_camera_settings';
const SAVED_PHOTOS_KEY        = '@creature_camera_saved_photos';
const AUTO_DELETE_KEY         = '@creature_camera_auto_delete';
const AUDIO_SETTINGS_KEY      = '@creature_camera_audio';
const PHOTO_THEMES_KEY        = '@creature_camera_photo_themes';
const TUTORIAL_KEY            = '@creature_camera_tutorial_done';
const SKIP_FORCED_ITEM_KEY    = '@creature_camera_skip_forced_item';
const PITY_COUNTER_KEY        = '@creature_camera_pity_counter';
const PHOTO_LIMIT             = 30;
const OVERFLOW_LIMIT          = 80;
const PROTECT_LIMIT           = 20;
const FRAME_MAX               = 20;
const SPECIAL_ITEM_CHANCE     = 1.00;  // ⚠️ デバッグ用（本番: 0.10）
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

## 主要 Ref 一覧

| Ref | 用途 |
|---|---|
| `creaturePosRef` | アニメーション中の生き物座標（top/left）をリアルタイム追跡 |
| `creatureOpacityRef` | アニメーション中の不透明度をリアルタイム追跡 |
| `creaturePauseFnRef` | アニメーション停止関数 |
| `creatureResumeFnRef` | フェーズ対応再開関数 |
| `alertActiveRef` | アラート・オーバーレイ表示中フラグ |
| `pendingItemSpawnRef` | アラート中のアイテム保留 spawn 関数 |
| `timerRef` | 次の生き物出現タイマー |
| `wasOverlayOpenRef` | 設定/ギャラリー遷移後の再開判定フラグ |
| `capturableRef` | 生き物が capturable フェーズか |
| `gallerySortModeRef` | ギャラリーソートモード（stale closure 対策） |
| `photoThemeMapRef` | `{assetId: themeId}` 写真ごとのテーマ記録 |
| `pendingResortRef` | ビューワー保護操作後の再ソート待ちフラグ |
| `photoBaseOrderRef` | `{assetId: index}` favorite ソートの第2キー |
| `frameCountsRef` | テーマ別フレーム残数（アイテム除外判定にも使用） |
| `unlockedThemesRef` | 取得済みテーマ一覧（アイテム除外判定用） |
| `filterTypeRef` | 発動中のフィルター種別（null / 'sepia' / 'mono'） |
| `filterResolveRef` | WebViewフィルター処理のPromise resolve保持 |
| `galleryVisibleRef` | showAlert.resume() でオーバーレイ開放チェック用 |
| `settingsVisibleRef` | 同上 |

---

## リリース履歴

| バージョン | build | 内容 |
|---|---|---|
| 1.1.6 | 15 | ギャラリーソート4モード・ギャラリー長時間放置バグ修正3件・App Store 提出済み（0505） |
| 1.1.5 | 14 | 可視判定強化・アラート/オーバーレイ中アニメーション停止修正・App Store 提出済み（0503） |
| 1.1.4 | 13 | 時間・季節限定キャラクター実装・App Store 提出済み（0501） |

---

## 未実装・改善候補（優先度順）

| 優先度 | 機能 | 備考 |
|---|---|---|
| 高 | `SPECIAL_ITEM_CHANCE` を 0.10 に戻す | デバッグ用に 1.00 にしてある（本番リリース前に必須） |
| 高 | セピア/モノクロの実機動作確認 | WebView Canvas方式・処理時間の確認 |
| 高 | App Store スクリーンショット差し替え | 日本語・英語コピー作成済み（0501セッション） |
| 中 | BIGクリーチャー✨アイテム | 次の生き物をLサイズ＋光エフェクトで出現 |
| 中 | 生き物アイドルアニメーション | 停止中に微妙に揺れる・瞬き |
| 中 | 撮影成功リアクションアニメーション | 生き物が驚く演出 |
| 中 | アイテムレアリティ表示（星） | データ構造の整備が先決 |
| 低 | 夜の生き物/呪われた生き物アイテム | 新アセット要・中期施策 |
| 低 | アイテム図鑑コレクション画面 | 高難度 |

---

## 既知の注意点・バグ修正履歴（累積）

（1〜29 は handovers_0505.md 参照）

30. **フレーム+5 上限超過で無駄引き（0509）**: 上限時に別テーマへランダム振り替え。`alert_frame_redirect_body` メッセージ追加。
31. **WebView `ctx.filter` が無効（0509）**: `getImageData/putImageData` + 係数演算でピクセル直接変換に変更。
32. **`expo-file-system` の `EncodingType.Base64` が undefined（0509）**: 文字列 `'base64'` を直接使用。
33. **`expo-file-system` の `readAsStringAsync` が deprecated（0509）**: `expo-file-system/legacy` から import するよう変更。

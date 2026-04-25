# CreatureCamera54 セッション引き継ぎ — 2026-04-25

## プロジェクト概要

- **場所**: `C:\Users\tosum\Projects\CreatureCamera54\`
- **内容**: Expo SDK 54 / React Native 0.81.5 / React 19.1.0 のシングルファイルアプリ
- **メインファイル**: `App.js`（約 3500 行）
- **動作環境**: Expo Go App Store 版 54.0.2（SDK 55+ は使用不可）
- **起動コマンド**: `npx expo start`
- **現在のバージョン**: `1.1.2`（app.json）

---

## 今セッションの変更内容

### 1. フレーム合成 Z-index 修正

**問題**: 保存写真（フレーム合成時）で生き物がフレームの装飾部分に被さって見えていた。

**原因**: フレーム Image に明示的な zIndex がなく、`styles.creature` の `zIndex: 10` が親View境界を突き破って前面に出ていた。

**修正**: compositing の frameSource Image に `zIndex: 20` を追加。

```js
// App.js ~2455行
<Image
  source={compositing.frameSource}
  style={{ position: 'absolute', top: 0, left: 0, width: SCREEN_W, height: SCREEN_H, zIndex: 20 }}
  ...
/>
```

---

### 2. 設定画面スタイル刷新（紫テーマ）

**問題**: 設定画面がiOS純正ダークテーマそのままで、アプリの世界観（パステル紫・ファンタジー）と不一致。

**変更内容**:

| 要素 | 変更前 | 変更後 |
|---|---|---|
| 背景 | `#1c1c1e`（黒） | `#1a0e2e`（深紫） |
| タイトル | 白・20px | `#f0d6ff`・22px・letterSpacing 0.5 |
| セクションラベル | `#aaa`・13px | `#9b72cf`・12px・letterSpacing 1.2 |
| 区切り線 | `#333` | `#2d1f45` |
| 項目テキスト | 白 | `#f0d6ff` |
| チェックマーク・スイッチON | `#4CD964`（緑） | `#c084fc`（紫） |
| 閉じるボタン | 白 | `#c9a0ff` |
| エラーテキスト | `#ff453a` | `#ff6b8a` |
| autoDeleteBtn 非アクティブ枠 | `#555` | `#4a3060` |
| autoDeleteBtn アクティブ | 緑系 | 紫系 `#c084fc` |

スイッチの `trackColor` も全6箇所変更：
```js
trackColor={{ false: '#4a3060', true: '#c084fc' }}
```

---

### 3. ピンチズーム実装

**追加機能**: カメラ画面で2本指ピンチジェスチャーによるズームイン・アウト。

**実装方式**: React Native 組み込みの `PanResponder`（追加パッケージなし）

**仕様**:
- ズーム範囲: 0.0〜0.8（上限1.0だと `Failed to take photo` エラーが発生するため0.8にクリップ）
- ピンチアウト（ズームイン）感度: `× 0.25`（ゆっくり）
- ピンチイン（ズームアウト）感度: `× 0.5`（速め）
- リセットタイミング: 撮影成功（`setSuccessPhoto(uri)` 直前）のみ
- アイテム取得などではリセットしない

```js
// state・ref（~965行付近）
const [zoomLevel, setZoomLevel]   = useState(0);
const zoomLevelRef                = useRef(0);
const pinchBaseDistRef            = useRef(0);
const pinchBaseZoomRef            = useRef(0);

// PanResponder（cameraPinchResponder）
const delta       = scale - 1;
const sensitivity = delta > 0 ? 0.25 : 0.5;
const next        = Math.min(0.8, Math.max(0, pinchBaseZoomRef.current + delta * sensitivity));

// カメラView（~2401行）
<View style={StyleSheet.absoluteFill} {...cameraPinchResponder.panHandlers}>
  <CameraView ... zoom={zoomLevel} />
</View>

// リセット（~1622行）
zoomLevelRef.current = 0;
setZoomLevel(0);
setSuccessPhoto(uri);
```

---

### 4. App Storeスクリーンショット作業（コード外）

Canvaで以下の3枚を作成（日本語版）：

| 枚 | 素材ファイル | コピー |
|---|---|---|
| 1枚目 | `20260422_125856025_iOS.jpg`（デフォルトフレーム×空×3体） | 「カメラに映るのは、ふつうじゃない生き物」 |
| 2枚目 | `20260422_130239678_iOS.jpg`（デフォルトフレーム×ビル街×おばけ） | 「どこにでも現れる、不思議な訪問者」 |
| 3枚目 | `20260422_141949000_iOS.png`（設定画面・テーマ展開） | テキストなし（UIで語る） |

英語版コピー（未作成）:
- 1枚目: `Something unusual just appeared in your camera.`
- 2枚目: `Mysterious visitors show up anywhere.`

スクリーンショット素材の保存場所: `C:\Users\tosum\OneDrive\画像\Saved Pictures\提出用0422\`

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
| 高 | App Store 英語版スクリーンショット作成 | Canvaで文字差し替えのみ |
| 高 | App Store Connect へのスクリーンショット差し替え提出 | 日本語・英語両対応 |
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
17. **設定・ギャラリー遷移時に生き物アニメーションが継続**: `wasOverlayOpenRef` を使った `useEffect` で停止＆再開を制御
18. **compositing フレームの上に生き物が重なる**: frameSource Image に `zIndex: 20` を追加して解決
19. **ズーム最大値1.0で撮影エラー**: 上限を `0.8` にクリップして解決

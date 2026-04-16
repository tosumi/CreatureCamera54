# CreatureCamera54 セッション引き継ぎ — 2026-04-15/16

## プロジェクト概要

- **場所**: `C:\Users\tosum\Projects\CreatureCamera54\`
- **内容**: Expo SDK 54 / React Native 0.81.5 / React 19.1.0 のシングルファイルアプリ
- **メインファイル**: `App.js`（約 2700 行）
- **動作環境**: Expo Go App Store 版 54.0.2（SDK 55+ は使用不可）
- **起動コマンド**: `npx expo start`

---

## 今セッションの変更内容

### 1. App Store Review 対応

#### Guideline 5.1.1(iv) — カメラ許可ボタン文言変更
- `App.js:1661` のカメラ許可ボタン: `許可する` → `次へ` に変更

#### Guideline 1.5 — サポートURL
- GitHub Pages をユーザーが作成済み: `http://tosumi.github.io/CreatureCamera54`
- App Store Connect の Support URL を更新する（コード外対応）

#### Guideline 2.1 — フレームが1種類しか確認できない問題
- チュートリアル実装で対応（審査員がフレーム・テーマの存在を確認できるようにする）

---

### 2. チュートリアル実装（主要変更）

#### 新規定数（App.js 上部）
```js
const SE_ITEM_PREVIEW  = require('./assets/se_item_preview.mp3'); // unknown_animal1.mp3 をコピー
const TUTORIAL_KEY           = '@creature_camera_tutorial_done';
const TUTORIAL_CREATURE_SIZE = 120; // ラージサイズ
```

#### `CreatureOverlay` に `pauseAfterCapturable` prop 追加
- `true` のとき、capturable 状態になった後に middle アニメーション・退場アニメーションを行わず停止
- チュートリアルで強制出現させた生き物/アイテムをユーザーが撮影するまで残す

#### 新規 state / ref
```js
const [tutorialStep, setTutorialStep] = useState(0); // 0=非表示
const tutorialStepRef      = useRef(0);
const tutorialAutoShootRef = useRef(null); // step12の30秒タイマー
const takePictureRef       = useRef(null);
const playSERef            = useRef(null);
```

#### `scheduleNextCreature` の変更
- `tutorialStepRef.current > 0` の場合は早期 return（チュートリアル中は生き物自動出現しない）
- 特殊アイテム選択時に `playSERef.current?.(SE_ITEM_PREVIEW)` を追加（通常プレイ時の予告SE）

#### `handleCreatureDone` の変更
- `tutorialStepRef.current === 0` の場合のみ `scheduleNextCreature()` を呼ぶ

#### 新規関数
| 関数 | 役割 |
|---|---|
| `completeTutorial()` | AsyncStorage に完了記録、step=0 に戻す |
| `skipTutorial()` | 強制クリア → completeTutorial |
| `advanceTutorial()` | 全ステップの遷移ロジック |

#### `advanceTutorial` のステップ遷移ロジック
| step | 次へ押下時の動作 |
|---|---|
| 2 | 宇宙人(👽, size=120)を fadein+pauseAfterCapturable で強制出現 → step3 |
| 4 | openGallery() → step5 |
| 8 | closeViewer() → step9 |
| 10 | ギャラリーを強制クローズ（overflow不問）→ step11 |
| 11 | SE_ITEM_PREVIEW 再生 → テーマアイテム(🎁, size=120)強制出現 → step12。30秒後に自動撮影タイマー起動 |
| 14 | setSettingsVisible(true) → step15 |
| 17 | setSettingsVisible(false) → step18 |
| 18 | completeTutorial() |
| その他 | step++ |

#### `takePicture` の変更
- 特殊アイテム撮影時: `tutorialStepRef.current === 0` の場合のみ `scheduleNextCreature()`
- テーマ取得 Alert の OK ハンドラで step12 → step14 へ進む
- 通常撮影 Alert の OK ハンドラで step3 → step4 へ進む（`scheduleNextCreature` はスキップ）

#### `handlePhotoTap` の変更
- step5 で写真タップ時 → step6 へ自動進行

#### `initMediaLibrary` の変更
- 設定あり／アルバムあり のどちらのパスでも末尾で `TUTORIAL_KEY` をチェック
- 未完了なら `tutorialStepRef.current = 1; setTutorialStep(1)` で起動

#### 設定画面 (step15) の操作制限
- ヘッダーの ✕ ボタン: `disabled={tutorialStep === 15}` + opacity 0.3
- テーマ以外のすべての設定項目: `pointerEvents="none"` + opacity 0.3

#### `renderTutorialOverlay()` 関数
- コンポーネント return の直後に定義（ネスト関数）
- STEP_DATA（全ステップのメッセージ・矢印・bubbleY・showNext）を内包
- メッセージバブルの**外側**に大型矢印絵文字（fontSize: 48）を配置
  - 上向き矢印（`↗️`）→ バブルの**上**
  - 下向き矢印（`⬇️` `↙️` `↘️`）→ バブルの**下**
- **ギャラリー Modal 内**（step5〜10）と**メイン画面**（それ以外）の両方で呼び出す

#### ギャラリー操作制限（step5〜10）
| 要素 | 制限 |
|---|---|
| ギャラリーヘッダー | step5〜10 中 `pointerEvents="none"` |
| グリッド(FlatList) | step6〜10 中 `pointerEvents="none"`（step5 のみサムネイルタップ許可） |
| ビューワーのアクション(✕・🗑・☆) | step6〜8 中 `pointerEvents="none"` |

#### チュートリアルのステップ一覧
| step | 画面 | 内容 | 次へトリガー |
|---|---|---|---|
| 1 | スプラッシュ後 | 開始確認（はい/いいえ） | はい |
| 2 | メイン | シャッターボタン説明 ⬇️ | 次へ（宇宙人強制出現） |
| 3 | メイン（宇宙人停止中） | シャッターを押して | シャッター押下 |
| 4 | メイン | ギャラリーアイコン説明 ↙️ | 次へ（ギャラリー自動オープン） |
| 5 | ギャラリー一覧 | 写真タップ説明 ⬇️ | 写真タップ |
| 6 | ビューワー | ゴミ箱アイコン説明 ↘️ | 次へ |
| 7 | ビューワー | ハートアイコン説明 ↙️ | 次へ |
| 8 | ビューワー | 閉じ方説明 ↗️ | 次へ（closeViewer） |
| 9 | ギャラリー一覧 | 選択☑️説明 ↗️ | 次へ |
| 10 | ギャラリー一覧 | 閉じ方説明 ↗️ | 次へ（ギャラリー強制クローズ） |
| 11 | メイン | アイテム予告音説明 🔔 | 次へ（予告SE再生→テーマアイテム強制出現） |
| 12 | メイン（テーマアイテム停止中） | アイテム撮影説明 ⬇️ | シャッター押下 or 30秒タイマー |
| 14 | メイン | 設定アイコン説明 ↘️ | 次へ（設定自動オープン） |
| 15 | 設定画面 | テーマ選択説明 ⬇️ | 次へ（テーマ以外無効化中） |
| 17 | 設定画面 | 閉じ方説明 ↗️ | 次へ（設定自動クローズ） |
| 18 | メイン | 終了メッセージ | 次へ（completeTutorial） |

#### 音声ファイル
- `assets/se_item_preview.mp3`：`C:\Users\tosum\Downloads\unknown_animal1.mp3` をコピー
- 通常プレイ時：特殊アイテム抽選成功時に自動再生（`scheduleNextCreature` 内）
- チュートリアル：step11 → step12 進行時に再生

---

## App Store 対応状況

| 指摘 | 対応状況 |
|---|---|
| Guideline 5.1.1(iv)：「許可する」ボタン | ✅ 「次へ」に変更済み |
| Guideline 2.1：フレームが1種類のみ | ✅ チュートリアルで複数テーマ・フレーム存在を審査員に提示 |
| Guideline 1.5：サポートURL | ⬜ App Store Connect で `http://tosumi.github.io/CreatureCamera54` に更新が必要（コード外） |

---

## 残課題（TODO）

| 優先度 | 内容 |
|---|---|
| 🔴 | App Store Connect のサポートURLを `http://tosumi.github.io/CreatureCamera54` に更新 |
| 🔴 | App Review へ返信（フレーム解放手順の説明・チュートリアルで確認可能な旨） |
| 🔴 | 新しいビルドを EAS で作成して App Store Connect に再提出 |
| 🟡 | チュートリアルの実機テスト（Expo Go で動作確認） |
| 🟡 | `DEBUG_UNLOCKED` / `DEBUG_FRAME_COUNTS` 変数名リネーム（line 698-699） |
| 🟡 | スプラッシュ画像を推奨サイズ（1284×2778px）に更新 |

---

## 改善ロードマップ（前セッションより継続）

議事録: `C:\Users\tosum\.claude\plans\abundant-spinning-goblet.md`

| 優先度 | 提案 | 状況 |
|---|---|---|
| ✅ 完了 | 初回チュートリアル | 今セッションで実装 |
| 🔴 最優先 | 初回アイテム確定出現（最初の10枚以内） | 未実装 |
| 🔴 最優先 | 英語ローカライズ | 未実装 |
| 🟡 優先 | フレーム画像クオリティ向上 | デザイン依存 |
| 🟡 優先 | 各テーマの生き物を5体→8体に増加 | 未実装 |
| 🟡 優先 | 天井補正（出現率漸増） | 未実装 |
| 🟡 優先 | アニメーションのランダム複数パターン化 | 未実装 |

---

## 定数・設定値（変更あり）

```js
const ALBUM_NAME              = 'CreatureCamera';
const SETTINGS_KEY            = 'creature_camera_settings';
const SAVED_PHOTOS_KEY        = '@creature_camera_saved_photos';
const AUTO_DELETE_KEY         = '@creature_camera_auto_delete';
const AUDIO_SETTINGS_KEY      = '@creature_camera_audio';
const TUTORIAL_KEY            = '@creature_camera_tutorial_done'; // 新規追加
const PHOTO_LIMIT             = 30;
const OVERFLOW_LIMIT          = 80;
const PROTECT_LIMIT           = 20;
const FRAME_MAX               = 20;
const SPECIAL_ITEM_CHANCE     = 0.05;
const TUTORIAL_CREATURE_SIZE  = 120; // 新規追加
```

---

## Z-index 順序（更新）

| 要素 | zIndex |
|---|---|
| **チュートリアルオーバーレイ** | **300**（新規） |
| デバッグオーバーレイ（現在非表示） | 100 |
| 設定オーバーレイ | 200 |
| controlPanel | 30 |
| camera finder | 20 |
| ScopeOverlay | 15 |
| creature | 10 |
| camera / compositing | 0 |

※ ギャラリー（Modal）内のチュートリアルオーバーレイは Modal 内の最後の要素として描画されるため zIndex 不要

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

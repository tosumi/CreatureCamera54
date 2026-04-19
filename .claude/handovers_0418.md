# CreatureCamera54 セッション引き継ぎ — 2026-04-18

## プロジェクト概要

- **場所**: `C:\Users\tosum\Projects\CreatureCamera54\`
- **内容**: Expo SDK 54 / React Native 0.81.5 / React 19.1.0 のシングルファイルアプリ
- **メインファイル**: `App.js`（約 3240 行）
- **動作環境**: Expo Go App Store 版 54.0.2（SDK 55+ は使用不可）
- **起動コマンド**: `npx expo start`

---

## 今セッションの変更内容

### 英語ローカライズ + 言語設定UI の実装（全ステップ完了）

#### 追加したモジュールレベルの仕組み

```js
const SUPPORTED_LANGUAGES = [
  { id: 'ja', label: '日本語' },
  { id: 'en', label: 'English' },
];

const _langRef = { current: 'ja' };  // stale closure対策（レンダー毎同期）

function t(key, params) { ... }  // {変数名}プレースホルダー置換付き

const TRANSLATIONS = { ja: {...}, en: {...} };  // 153キー
```

#### 追加した state / ref / 関数

| 項目 | 内容 |
|---|---|
| `language` state | 現在の言語（'ja' \| 'en'） |
| `langDropdownOpen` state | 言語ドロップダウン開閉 |
| `_langRef.current = language` | レンダー毎に同期（行 ~1750） |
| `handleLanguageChange(lang)` | 言語変更 + 即時同期 + 保存 |

#### `persistSettings` 変更

```js
// language = 'ja' をオプション第7引数として追加（後方互換）
async function persistSettings(theme, albumMode, frameEnabled, fullScreen, unlockedThemes, frameCounts, language = 'ja')
```

全28箇所の呼び出しに `language` を追加済み。初回起動パス（3箇所）はデフォルト 'ja' のまま。

#### 言語ドロップダウン UI

- 設定画面の **最下部**（SEセクションの後）に配置
- 誤操作で言語変更して操作不能になることを防ぐ
- チュートリアル step15/17 中は `pointerEvents="none"` ラッパー内で無効化
- テーマドロップダウンと同じデザイン（SE_OPEN_CABINET / SE_CLOSE_CABINET 効果音）

#### チュートリアル Step 1 の言語選択

- バイリンガルハードコードメッセージ（`t()` は未設定のため使用不可）
- ボタンを **はい/いいえ → 日本語/English** に変更
- ボタン押下時に `handleLanguageChange()` + `advanceTutorial()` を同時呼び出し

#### テキスト置換箇所（149箇所の `t()` 呼び出し）

| カテゴリ | 件数 |
|---|---|
| カメラ権限画面 | 2 |
| コントロールパネル（ギャラリー・設定ラベル） | 2 |
| 設定画面ラベル（テーマ・フレーム・アルバム等） | ~30 |
| ギャラリー画面（タイトル・選択解除） | 3 |
| テーマ名（`t('theme_' + id)`） | 複数箇所 |
| アイテム名（`t('item_' + type)`） | 複数箇所 |
| Alert ダイアログ（生き物・写真・ギャラリー・保護・上限） | ~50 |
| チュートリアル STEP_DATA メッセージ（2〜18） | 14 |
| チュートリアルボタン（次へ・スキップ） | 2 |

#### デバッグシーケンス（// ▼ DEBUG 〜 // ▲ DEBUG）

チュートリアル完了後に全4種の特殊アイテムを順番に強制表示：

```js
// モジュールレベル
const DEBUG_FORCED_SEQUENCE = [
  { type: 'theme',   emoji: '🎁' },
  { type: 'frame',   emoji: '🌟' },
  { type: 'harmony', emoji: '🎊' },
  { type: 'scope',   emoji: '🔭' },
];

// ref（completeTutorial の直後にリセット）
const debugForcedIdxRef = useRef(0);
```

本番化時は `// ▼ DEBUG` と `// ▲ DEBUG` で囲まれたブロック（4箇所）を削除。

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
```

`SETTINGS_KEY` の JSON に `language` フィールドを追加（後方互換：デフォルト `'ja'`）

---

## Z-index 順序

| 要素 | zIndex |
|---|---|
| チュートリアルオーバーレイ | 300 |
| 設定オーバーレイ | 200 |
| controlPanel | 30 |
| camera finder | 20 |
| ScopeOverlay | 15 |
| creature | 10 |
| camera / compositing | 0 |

---

## チュートリアルのステップ一覧

| step | 画面 | 内容 | 次へトリガー |
|---|---|---|---|
| 1 | スプラッシュ後 | バイリンガル開始確認（日本語/Englishボタン） | 言語選択ボタン押下 |
| 2 | メイン | シャッターボタン説明 ⬇️ | 次へ（宇宙人強制出現・画面上半分） |
| 3 | メイン（宇宙人停止中） | シャッターを押して（スキップなし） | シャッター押下 or 10秒タイマー |
| 4 | メイン | ギャラリーアイコン説明 ↙️ | 次へ（ギャラリー自動オープン） |
| 5 | ギャラリー一覧 | 写真タップ説明 ⬇️ | 写真タップ |
| 6 | ビューワー | ゴミ箱アイコン説明 ↘️ | 次へ |
| 7 | ビューワー | ハートアイコン説明 ↙️ | 次へ |
| 8 | ビューワー | 閉じ方説明 ↗️ | 次へ（closeViewer） |
| 9 | ギャラリー一覧 | 選択☑️説明 ↗️ | 次へ |
| 10 | ギャラリー一覧 | 閉じ方説明 ↗️ | 次へ（ギャラリー強制クローズ） |
| 11 | メイン | アイテム予告音説明 🔔 | 次へ（SE再生→テーマアイテム強制出現・画面上半分） |
| 12 | メイン（テーマアイテム停止中） | アイテム撮影説明 ⬇️（スキップなし） | シャッター押下 or 10秒タイマー |
| 14 | メイン | 設定アイコン説明 ↘️ | 次へ（設定自動オープン） |
| 15 | 設定画面 | テーマ選択説明 ⬇️ | 次へ（テーマ以外無効化中） |
| 17 | 設定画面 | 閉じ方説明 ↗️ | 次へ（設定自動クローズ） |
| 18 | メイン | 終了メッセージ | 次へ（completeTutorial） |

---

## 残課題（TODO）

| 優先度 | 内容 |
|---|---|
| ✅ | 実機テスト（Expo Go 54.0.2）：英語ローカライズの動作確認 |
| ✅ | 実機テスト：チュートリアル Step 1 の日本語/English ボタン確認 |
| ✅ | デバッグシーケンスの動作確認後、`// ▼ DEBUG` ブロックを削除（4箇所） |
| ✅ | EAS ビルドを作成して App Store Connect に再提出（2026-04-19） |
| 🟢 低優先 | 「和気あいあい」発動中をユーザーに通知する SE または画面効果の追加（現状：発動中は特殊アイテム抽選がスキップされるが、ユーザーへの通知なし。スコープパワーアップ削除により緊急度低下） |
| 🟡 | スプラッシュ画像を推奨サイズ（1284×2778px）に更新 |

---

## 改善ロードマップ

| 優先度 | 提案 | 状況 |
|---|---|---|
| ✅ 完了 | 初回チュートリアル | 実装済み |
| ✅ 完了 | 特殊アイテム出現率10%・天井補正 | 実装済み |
| ✅ 完了 | チュートリアルスキップ後5枚目強制特殊アイテム | 実装済み |
| ✅ 完了 | 英語ローカライズ + 設定画面言語切替 | 今セッションで実装 |
| 🟡 優先 | フレーム画像クオリティ向上 | デザイン依存 |
| 🟡 優先 | 各テーマの生き物を5体→8体に増加 | 未実装 |
| 🟡 優先 | アニメーションのランダム複数パターン化 | 未実装 |

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
12. **`t()` のstale closure**: モジュールレベル `_langRef` + レンダー毎同期で解決（Alert等のコールバックでも正常動作）

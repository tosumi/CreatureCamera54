# セッション継続用プロンプト

## プロジェクト
  プロジェクト: C:\Users\tosum\Projects\CreatureCamera54\App.js
  Expo SDK 54 / React Native 0.81.5 / React 19 / 単一ファイルアプリ（約1600行）

## このセッションで実装した内容

  1. ギャラリー大幅リワーク（前セッション末から継続）

  定数追加
  const PHOTO_LIMIT = 20;
  const OVERFLOW_LIMIT = 50;
  const PROTECT_LIMIT = 15;
  const SAVED_PHOTOS_KEY = '@creature_camera_saved_photos';

  新規 state / ref
  - selectionMode / selectedPhotoIds / savedPhotoIds — 選択・保護管理
  - viewerVisible — フォトビューワーのアニメーション付きclose用
  - overflowMode — 起動時上限超過検知フラグ
  - viewerSlideY / viewerOpacity — ビューワーcloseアニメーション用 Animated.Value
  - selectedPhotoIdsRef / savedPhotoIdsRef / overflowModeRef — stale closure対策 ref

  関数
  - persistSavedPhotoIds(ids) — AsyncStorage へ保護IDリストを保存
  - checkAlbumLimitAtStartup(effectiveSaveMode) — boolean を返す（超過なら true）
  - openViewer(index) — viewerSlideY/Opacity を reset してからマウント
  - closeViewer() — 上スライド＋フェードアウト(300ms)、アニメーション完了後 setTimeout(15ms) でアンマウント（setValue
  は呼ばない。呼ぶとネイティブ側が先に更新されてフラッシュするため）
  - handlePhotoTap(item, index) — 選択モード中はトグル、通常は openViewer
  - enterSelectionMode() / exitSelectionMode()
  - handleDeleteAction() / executeDelete() — 保護済みチェック付き削除
  - handleProtectAction() / executeProtect() — 保護上限チェック（既存保護数＋新規保護数 > PROTECT_LIMIT）
  - handleUnprotectAction() / executeUnprotect()
  - reloadGallery() — 削除後に再取得（overflowMode 時は OVERFLOW_LIMIT 枚）

  起動時超過モード
  initMediaLibrary → checkAlbumLimitAtStartup → setOverflowMode(true)
    → useEffect([overflowMode, saveMode]) → Alert "アルバムがいっぱい" → OK → openGallery()
  - openGallery / reloadGallery は overflowModeRef.current で取得上限を切り替え
  - closeGallery は galleryCountRef.current > PHOTO_LIMIT なら閉じない（ダイアログ表示）
  - ≤ PHOTO_LIMIT になったら setOverflowMode(false) してからアニメーションclose

  ギャラリー UI
  - ヘッダー通常時: タイトル + 保護枚数/全体枚数（超過中は赤太字）+ ☑️選択ボタン + ✕
  - ヘッダー選択中: 「選択解除」 + 🗑 + ☆（金色、保護解除）+ ⭐（保護） / 背景 #2c2c2e
  - グリッドバッジ: 金色丸背景（#f5a623）+ 白 ★（保護済み写真）
  - 選択バッジ: 白丸 + ✓（選択中）/ 白枠丸（未選択）
  - フォトビューワー: Animated.View でラップ、上スワイプ or ✕ で closeViewer()

  保護上限ダイアログ（超過時）
  「保護できる写真は15枚までです。選択しなおしてください。」
  キャンセル（選択維持）/ はい（exitSelectionMode）

## 現在の既知の状態

  - フラッシュ修正済み（closeViewer 内で setValue を呼ばない方針）
  - savedPhotoIds は AsyncStorage @creature_camera_saved_photos に永続化
  - 設定は creature_camera_settings に永続化（theme / albumMode / frameEnabled / fullScreen / unlockedThemes /
  frameCounts / deleteMode の7項目）
  - DEBUG 初期値: 全テーマ解放済み・全フレーム残り5回（設定ファイルがない場合のみ）

## 未実装・将来対応

  - サバンナテーマ（コメントアウト済み）
  - テーマ解放のゲームロジック（現在はDEBUGで全解放）
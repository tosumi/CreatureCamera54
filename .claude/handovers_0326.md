
  ---
  次回セッション用プロンプト

  CreatureCamera アプリの開発を続けます。

  ## プロジェクト概要
  iPhoneジョークカメラアプリ。カメラ画面に生き物がこっそり映り込む。
  Expo SDK 54（Expo Go 54.0.2 に合わせた）で構築。MacもXcodeもないため、
  Expo Go を使って実機確認している。

  ## ファイル構成
  - メインコード: C:\Users\tosum\Projects\CreatureCamera54\App.js
  - 設定: C:\Users\tosum\Projects\CreatureCamera54\app.json
  - フレーム画像:
    - assets/frame-default.png  （デフォルトテーマ用）
    - assets/frame-flower.png   （フラワーテーマ用）
    - assets/frame-stylish.png  （おしゃれテーマ用）
  - スプラッシュ: assets/splash-icon.png

  ## 使用ライブラリ
  - expo-camera（CameraView, useCameraPermissions）
  - expo-media-library
  - react-native-view-shot（captureRef）
  - @react-native-async-storage/async-storage
  - expo-status-bar

  ## 実装済み機能

  ### カメラ・撮影
  - ライブカメラビューに生き物（絵文字）がオーバーレイ表示
  - 撮影時は captureRef でカメラ写真＋生き物を合成して保存
  - 生き物が「撮影可能状態」（入場アニメーション完了〜退場開始前）の間だけシャッター有効
  - 合成後、フルスクリーンで撮影結果を表示→OKで閉じる

  ### 生き物システム
  - 3テーマ: デフォルト / フラワー / おしゃれ
  - サイズバリアント: Small(×1.0) 50%、Middle(×1.2) 30%、Large(×1.5) 20%
  - 出現間隔: 2〜8秒ランダム
  - アニメーション種別: edge（4方向、上10%/下左右各30%）/ top（上のみ）/ fadein（画面内）/ edge3（将来用）
  - テーマ別アニメーション割当:
    - デフォルト: spider→top, eye/ghost→fadein, その他→edge
    - フラワー: rose/tulip→edge, cherry/sunflower→fadein, bouquet→top
    - おしゃれ: 全員→fadein
  - アンマウント時に alive フラグ + stopAnimation() でアニメーション完全停止

  ### フレーム合成
  - 設定でON/OFF切替可能
  - 撮影時のみ合成（カメラ画面では非表示）
  - フレームありの場合: 写真＋生き物を90%サイズ（中央）に縮小し、フレームを最前面にフルサイズで重ねる
  - フレーム画像の onLoad を待ってから captureRef（最大3秒フォールバック）

  ### 保存モード
  - 'album': CreatureCamera アルバムに保存
  - 'default': カメラロールに保存
  - 'none': アクセス権限なし
  - 初回起動時のアルバム有無・権限状態で自動判定

  ### ギャラリー
  - 一覧表示（3列グリッド）
  - 写真ビューワー: 2スロット方式（slotX[0], slotX[1]）でフラッシュなし切替アニメーション
    - primarySlot（0 or 1）が現在表示中、もう一方が次画像の待機スロット
    - アニメーション時は2枚同時スライド（primary退場、secondary入場）
    - 完了後 primarySlot を入れ替え（Animated.Valueをリセットせず流用）
  - スワイプジェスチャー: 右→次、左→前、上→一覧に戻る
  - アニメーション中は✕ボタン非表示（pendingIndex !== null で判定）
  - ph:// URIは getAssetInfoAsync で localUri(file://)に変換

  ### 設定画面
  - テーマ選択（リスト）
  - フレーム ON/OFF（トグル）
  - アルバムモード ON/OFF（トグル）
  - AsyncStorage で永続化（キー: 'creature_camera_settings'）
  - テーマ切替時: タイマークリア + 生き物リセット + アニメーション停止

  ### その他
  - ✕ボタン（右上）: アプリ終了案内＋設定リセット機能
  - 設定ボタン（右下⚙️）: 設定画面へ
  - ギャラリーボタン（左下🖼️）: ギャラリーへ

  ## 重要な技術的ポイント
  - iOS では ph:// URIを Image コンポーネントで直接表示不可 → localUri が必須
  - captureRef のタイミング: フレーム画像の onLoad コールバックで resolve するPromise で同期
  - setCompositing(null) は finally ではなく Alert の OK ボタンで呼ぶ（2枚目以降のフレーム消失バグ対策）
  - PanResponder は useRef 内で作成し、stale closure 対策で triggerTransitionRef.current に最新関数を毎レンダーで上書き
  - Expo SDK 54 強制（App Store の Expo Go が 54.0.2 のため）
  - app.json: newArchEnabled: true（新アーキテクチャ有効）

  ## 現在の状態
  全機能が動作中。特に未解決の問題はなし。
  次に実装したいことがあればユーザーが指示する。
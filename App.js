import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  PanResponder,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  Alert,
  Easing,
} from 'react-native';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ALBUM_NAME = 'CreatureCamera';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const THUMB_SIZE = (SCREEN_W - 4) / 3;
const CAMERA_AREA_H = SCREEN_H * 0.8; // framed mode: camera area height
const PANEL_H       = SCREEN_H * 0.2; // framed mode: control panel height
const CAMERA_FINDER  = require('./assets/camera-finder.png');
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
const BGM_MAIN         = require('./assets/bgm_default.mp3');
const SE_ITEM_PREVIEW  = require('./assets/se_item_preview.mp3');
const TUTORIAL_KEY           = '@creature_camera_tutorial_done';
const SKIP_FORCED_ITEM_KEY   = '@creature_camera_skip_forced_item'; // チュートリアルスキップ後の強制特殊アイテム残りカウント
const PITY_COUNTER_KEY       = '@creature_camera_pity_counter';     // 連続通常撮影カウンタ（天井補正用）
const PITY_THRESHOLD         = 10; // この回数を超えると1回ごとに+1%
const TUTORIAL_CREATURE_SIZE = 120; // チュートリアル強制出現時のサイズ（ラージ）


// ── 対応言語 ──────────────────────────────────────────────
const SUPPORTED_LANGUAGES = [
  { id: 'ja', label: '日本語' },
  { id: 'en', label: 'English' },
];

// ── i18n ──────────────────────────────────────────────────
// _langRef：モジュールレベルのref（Alert・useCallback等のstale closure対策）
const _langRef = { current: 'ja' };

function t(key, params) {
  const dict = TRANSLATIONS[_langRef.current] ?? TRANSLATIONS.ja;
  const str  = dict[key] ?? TRANSLATIONS.ja[key] ?? key; // 英語キーが欠落した場合は日本語フォールバック
  if (!params) return str;
  return str.replace(/{(\w+)}/g, (_, k) => String(params[k] ?? ''));
}

// ── 翻訳辞書 ──────────────────────────────────────────────
const TRANSLATIONS = {
  ja: {
    // カメラ権限画面
    perm_text: 'カメラの許可が必要です',
    perm_btn:  '次へ',
    // カメラ画面
    panel_gallery:  'ギャラリー',
    panel_settings: '設定',
    // ギャラリー
    gallery_title_album:   'CreatureCamera',
    gallery_title_default: 'カメラロール',
    gallery_deselect:      '選択解除',
    // 設定画面
    settings_title:           '設定',
    settings_language:        '言語：',
    settings_theme:           'テーマ：',
    settings_frame_remain:    'フレーム残り：{remaining}回',
    settings_frame:           'フレーム：',
    settings_frame_on:        'あり',
    settings_frame_off:       'なし',
    settings_album_mode:      'アルバムモード：',
    settings_album_on:        'On（撮影上限あり）',
    settings_album_off:       'Off（撮影上限なし）',
    settings_album_no_perm:   '※ 写真へのアクセス許可がないため使用できません',
    settings_auto_delete:     '自動削除：',
    settings_auto_delete_on:  '有効',
    settings_auto_delete_off: '無効',
    settings_delete_target:   '自動で削除される写真：',
    settings_delete_newest:   '最新の写真',
    settings_delete_oldest:   '最後の写真',
    settings_camera_frame:    'カメラフレーム：',
    settings_camera_frame_off:'なし（全画面）',
    settings_camera_frame_on: 'あり',
    settings_bgm:             'BGM：',
    settings_bgm_on:          'あり',
    settings_bgm_off:         'なし',
    settings_se:              'SE：',
    settings_se_on:           'あり',
    settings_se_off:          'なし',
    // テーマ名
    theme_default:  'デフォルト',
    theme_flower:   'フラワー',
    theme_stylish:  'おしゃれ',
    theme_ocean:    '海の生き物',
    theme_forest:   '森の生き物',
    theme_savanna:  'サバンナの生き物',
    // 特殊アイテム名
    item_theme:    '新テーマ',
    item_frame:    'フレーム+5',
    item_harmony:  '和気あいあい',
    item_scope:    'スコープ',
    // Alert: 生き物・撮影
    alert_no_creature_title:   '生き物がいません！',
    alert_no_creature_body:    '生き物が現れたら撮影してね 👀',
    alert_photo_saved_title:   '📸 保存しました！',
    alert_photo_saved_body:    '生き物と一緒に写真フォルダに保存されたよ！',
    alert_photo_error_title:   'エラー',
    alert_photo_error_body:    '撮影に失敗しました',
    alert_save_error_body:     '保存に失敗しました: {msg}',
    // Alert: 特殊アイテム
    alert_theme_new_title:     '🎁 新しいテーマ！',
    alert_theme_new_body:      '「{label}」を取得しました！',
    alert_theme_all_title:     '🎁 テーマ',
    alert_theme_all_body:      '「{label}」のテーマは既に入手済みです。\n「{label}」のテーマにフレームを追加します。',
    alert_frame_plus_title:    '🌟 フレーム回数+5！',
    alert_frame_plus_body:     'フレームの残り回数が{count}回になりました！',
    alert_harmony_title:       '🎊 和気あいあい！',
    alert_harmony_body:        '次の撮影で生き物たちが集まります！',
    alert_scope_title:         '🔭 スコープ！',
    alert_scope_body:          '生き物の登場場所がわかるようになりました！',
    // Alert: ギャラリー
    alert_no_perm_title:              '写真へのアクセス許可がありません',
    alert_no_photos_title:            'まだ写真がありません',
    alert_no_photos_body:             '撮影するとここに表示されます。',
    alert_no_viewable_title:          '表示できる写真がありません',
    alert_no_viewable_body:           '写真へのアクセス権限を確認してください。',
    alert_gallery_error_title:        'エラー',
    alert_gallery_error_body:         'ギャラリーを開けませんでした: {msg}',
    alert_delete_protected_title:     '削除できません',
    alert_delete_protected_body:      '保護済みの写真は削除できません。\n先に保護を解除してください。',
    alert_delete_confirm_title:       '写真を削除',
    alert_delete_confirm_body:        'この写真を削除しますか？',
    alert_delete_multi_body:          '選択した{count}枚の写真を削除しますか？',
    alert_delete_protected_multi:     '保護済みの写真が含まれています。\n保護済みの写真を削除するには、先に保護を解除してください。',
    alert_unprotect_confirm_title:    '保護を解除',
    alert_unprotect_confirm_body:     'この写真の保護を解除しますか？',
    alert_unprotect_multi_body:       '選択された写真の保護を解除し、削除可能となります。\nよろしいですか？',
    alert_protect_limit_title:        '保護できません',
    alert_protect_limit_body:         '保護できる写真は{limit}枚までです。',
    alert_protect_limit_multi_body:   '保護できる写真は{limit}枚までです。選択しなおしてください。',
    alert_protect_confirm_title:      '写真を保護',
    alert_protect_confirm_body:       'この写真を保護しますか？\n保護された写真は削除できなくなります。',
    alert_protect_multi_body:         '選択した{count}枚の写真を保護しますか？\n保護された写真は削除できなくなります。',
    alert_perm_needed_title:          '権限の設定が必要です',
    alert_perm_needed_body:           'アルバムモードを使用するには、写真へのフルアクセスを許可してください。\n\n設定 → アプリ → Expo Go → 写真 → フルアクセス',
    // Alert: 上限・アルバム
    alert_overflow_title:       '📷 写真が上限を超えています',
    alert_overflow_body:        '写真が{limit}枚を超えています。\nギャラリーから写真を削除してください。',
    alert_album_full_title:     '📂 アルバムがいっぱいです',
    alert_album_full_body1:     '写真を削除して{limit}枚以下にしてください。',
    alert_album_full_body2:     '写真が{limit}枚を超えています。\n{over}枚以上削除してから戻ってください。',
    alert_album_create_title:   '📂 アルバムの作成',
    alert_album_create_body:    '撮影した写真を「CreatureCamera」アルバムにまとめますか？\n「いいえ」を選ぶと通常のカメラロールに保存されます。',
    // 共通ボタン
    btn_ok:      'OK',
    btn_cancel:  'キャンセル',
    btn_yes:     'はい',
    btn_no:      'いいえ',
    btn_delete:  '削除',
    btn_reset:   'リセット',
    // チュートリアル（Step 1 はバイリンガルハードコードのため辞書不要）
    tutorial_step2_msg:  'この🔵シャッターボタンを押して、\n生き物を撮影しよう！',
    tutorial_step3_msg:  '生き物が出現したよ。\nシャッターを押して！',
    tutorial_step4_msg:  '撮影した写真は、この🖼️ボタンをタップすると\nギャラリーで観られるよ。',
    tutorial_step5_msg:  '見たい写真をタップしてね。',
    tutorial_step6_msg:  '削除したいときは、\nこの🗑ゴミ箱アイコンをタップしてね。',
    tutorial_step7_msg:  '写真を間違えて消したくないときは、\nこの☆アイコンをタップして保護してね。',
    tutorial_step8_msg:  '画面右上の✕アイコンをタップすると、\n一覧に戻るよ。',
    tutorial_step9_msg:  'この☑️アイコンをタップすると、\n複数の写真をまとめて削除・保護できるよ。',
    tutorial_step10_msg: '画面右上の✕アイコンをタップすると、\nカメラ画面に戻るよ。',
    tutorial_step11_msg: 'この🔔チャイムが鳴ったら、\nラッキーチャンス！',
    tutorial_step12_msg: '特殊なアイテムを撮影して、\nアイテムをゲットしよう！',
    tutorial_step14_msg: '手に入れたテーマは、\nこの⚙️設定アイコンから使えるよ。',
    tutorial_step15_msg: '「テーマ」をタップして、\n撮影したいテーマを選択しよう。',
    tutorial_step17_msg: '画面右上の✕アイコンをタップすると、\nカメラ画面に戻るよ。',
    tutorial_step18_msg: 'これでチュートリアルは終了だよ。\nいろいろな生き物や、楽しいアイテムを撮影してね！',
    tutorial_btn_next:   '次へ',
    tutorial_btn_skip:   'スキップ',
    // テーマ削除
    alert_theme_delete_title: 'テーマを削除',
    alert_theme_delete_body:  '「{label}」を削除しますか？\n再取得するまで使えなくなります。',
  },
  en: {
    // カメラ権限画面
    perm_text: 'Camera access is required',
    perm_btn:  'Next',
    // カメラ画面
    panel_gallery:  'Gallery',
    panel_settings: 'Settings',
    // ギャラリー
    gallery_title_album:   'CreatureCamera',
    gallery_title_default: 'Camera Roll',
    gallery_deselect:      'Deselect',
    // 設定画面
    settings_title:           'Settings',
    settings_language:        'Language:',
    settings_theme:           'Theme:',
    settings_frame_remain:    'Frames left: {remaining}',
    settings_frame:           'Frame:',
    settings_frame_on:        'On',
    settings_frame_off:       'Off',
    settings_album_mode:      'Album Mode:',
    settings_album_on:        'On (photo limit)',
    settings_album_off:       'Off (no limit)',
    settings_album_no_perm:   '※ Requires full photo access permission',
    settings_auto_delete:     'Auto Delete:',
    settings_auto_delete_on:  'On',
    settings_auto_delete_off: 'Off',
    settings_delete_target:   'Photos to delete:',
    settings_delete_newest:   'Newest photos',
    settings_delete_oldest:   'Oldest photos',
    settings_camera_frame:    'Camera Frame:',
    settings_camera_frame_off:'Off (full screen)',
    settings_camera_frame_on: 'On',
    settings_bgm:             'BGM:',
    settings_bgm_on:          'On',
    settings_bgm_off:         'Off',
    settings_se:              'Sound:',
    settings_se_on:           'On',
    settings_se_off:          'Off',
    // テーマ名
    theme_default:  'Default',
    theme_flower:   'Flower',
    theme_stylish:  'Stylish',
    theme_ocean:    'Ocean',
    theme_forest:   'Forest',
    theme_savanna:  'Savanna',
    // 特殊アイテム名
    item_theme:    'New Theme',
    item_frame:    'Frame +5',
    item_harmony:  'Harmony',
    item_scope:    'Scope',
    // Alert: 生き物・撮影
    alert_no_creature_title:   'No creature!',
    alert_no_creature_body:    'Wait for a creature to appear 👀',
    alert_photo_saved_title:   '📸 Photo saved!',
    alert_photo_saved_body:    'Saved with the creature to your photo library!',
    alert_photo_error_title:   'Error',
    alert_photo_error_body:    'Failed to take photo',
    alert_save_error_body:     'Failed to save: {msg}',
    // Alert: 特殊アイテム
    alert_theme_new_title:     '🎁 New Theme!',
    alert_theme_new_body:      '"{label}" has been unlocked!',
    alert_theme_all_title:     '🎁 Theme',
    alert_theme_all_body:      'You already have the "{label}" theme.\nAdding frames to the "{label}" theme.',
    alert_frame_plus_title:    '🌟 Frame +5!',
    alert_frame_plus_body:     'You now have {count} frames remaining!',
    alert_harmony_title:       '🎊 Harmony!',
    alert_harmony_body:        'Creatures will gather on your next shot!',
    alert_scope_title:         '🔭 Scope!',
    alert_scope_body:          "You can now see where creatures will appear!",
    // Alert: ギャラリー
    alert_no_perm_title:              'Photo Access Required',
    alert_no_photos_title:            'No photos yet',
    alert_no_photos_body:             'Take some photos and they will appear here.',
    alert_no_viewable_title:          'No photos to display',
    alert_no_viewable_body:           'Please check your photo access permission.',
    alert_gallery_error_title:        'Error',
    alert_gallery_error_body:         'Could not open gallery: {msg}',
    alert_delete_protected_title:     'Cannot delete',
    alert_delete_protected_body:      'Protected photos cannot be deleted.\nPlease remove protection first.',
    alert_delete_confirm_title:       'Delete photo',
    alert_delete_confirm_body:        'Delete this photo?',
    alert_delete_multi_body:          'Delete {count} selected photos?',
    alert_delete_protected_multi:     'Protected photos are included.\nRemove protection before deleting.',
    alert_unprotect_confirm_title:    'Remove protection',
    alert_unprotect_confirm_body:     'Remove protection from this photo?',
    alert_unprotect_multi_body:       'Remove protection from selected photos?\nThey will become deletable.',
    alert_protect_limit_title:        'Protection limit reached',
    alert_protect_limit_body:         'You can protect up to {limit} photos.',
    alert_protect_limit_multi_body:   'You can protect up to {limit} photos. Please reselect.',
    alert_protect_confirm_title:      'Protect photo',
    alert_protect_confirm_body:       'Protect this photo?\nProtected photos cannot be deleted.',
    alert_protect_multi_body:         'Protect {count} selected photos?\nProtected photos cannot be deleted.',
    alert_perm_needed_title:          'Permission Required',
    alert_perm_needed_body:           'Album mode requires full photo access.\n\nSettings → Apps → Expo Go → Photos → Full Access',
    // Alert: 上限・アルバム
    alert_overflow_title:       '📷 Photo limit exceeded',
    alert_overflow_body:        'You have more than {limit} photos.\nPlease delete some from the gallery.',
    alert_album_full_title:     '📂 Album is full',
    alert_album_full_body1:     'Please delete photos until you have {limit} or fewer.',
    alert_album_full_body2:     'You have more than {limit} photos.\nPlease delete at least {over} photos before returning.',
    alert_album_create_title:   '📂 Create Album',
    alert_album_create_body:    'Save photos to a "CreatureCamera" album?\nSelect "No" to save to your regular camera roll.',
    // 共通ボタン
    btn_ok:      'OK',
    btn_cancel:  'Cancel',
    btn_yes:     'Yes',
    btn_no:      'No',
    btn_delete:  'Delete',
    btn_reset:   'Reset',
    // チュートリアル（Step 1 はバイリンガルハードコードのため辞書不要）
    tutorial_step2_msg:  'Press this 🔵 shutter button\nto photograph a creature!',
    tutorial_step3_msg:  'A creature has appeared!\nPress the shutter!',
    tutorial_step4_msg:  'Tap this 🖼️ button\nto view your photos in the gallery.',
    tutorial_step5_msg:  'Tap a photo to view it.',
    tutorial_step6_msg:  'Tap this 🗑 trash icon\nto delete a photo.',
    tutorial_step7_msg:  'Tap this ☆ icon to protect a photo\nso it cannot be accidentally deleted.',
    tutorial_step8_msg:  'Tap the ✕ icon at the top right\nto go back to the list.',
    tutorial_step9_msg:  'Tap this ☑️ icon to select\nmultiple photos for deletion or protection.',
    tutorial_step10_msg: 'Tap the ✕ icon at the top right\nto return to the camera.',
    tutorial_step11_msg: "When you hear this 🔔 chime,\nit's your lucky chance!",
    tutorial_step12_msg: 'Photograph the special item\nto add it to your collection!',
    tutorial_step14_msg: "Use the ⚙️ settings icon\nto apply themes you've collected.",
    tutorial_step15_msg: 'Tap "Theme" to choose\nthe theme you want to shoot with.',
    tutorial_step17_msg: 'Tap the ✕ icon at the top right\nto return to the camera.',
    tutorial_step18_msg: 'Tutorial complete!\nEnjoy photographing creatures and collecting items!',
    tutorial_btn_next:   'Next',
    tutorial_btn_skip:   'Skip',
    // テーマ削除
    alert_theme_delete_title: 'Delete Theme',
    alert_theme_delete_body:  'Delete "{label}"?\nYou won\'t be able to use it until you get it again.',
  },
};

// テーマ別BGM（未設定テーマは null = BGMなし）
const THEME_BGM = {
  default: BGM_MAIN,                               // もぐらの親子
  flower:  require('./assets/bgm_flower.mp3'),     // 日日是好日
  stylish: require('./assets/bgm_stylish.mp3'),    // お城の舞踏会
  ocean:   require('./assets/bgm_ocean.mp3'),      // 粉雪のワルツ
  forest:  require('./assets/bgm_forest.mp3'),     // おそうじ日和
  savanna: require('./assets/bgm_main.mp3'),       // 電話をする人
};

const THEMES = [
  { id: 'default', label: 'デフォルト',        deletable: false },
  { id: 'flower',  label: 'フラワー',          deletable: true  },
  { id: 'stylish', label: 'おしゃれ',          deletable: true  },
  { id: 'ocean',   label: '海の生き物',        deletable: true  },
  { id: 'forest',  label: '森の生き物',        deletable: true  },
  { id: 'savanna', label: 'サバンナの生き物',  deletable: true  },
];

const SETTINGS_KEY      = 'creature_camera_settings';
const SAVED_PHOTOS_KEY  = '@creature_camera_saved_photos';
const AUTO_DELETE_KEY   = '@creature_camera_auto_delete';
const AUDIO_SETTINGS_KEY = '@creature_camera_audio';
const PHOTO_LIMIT = 30;
const OVERFLOW_LIMIT = 80; // 超過モード時の表示上限
const PROTECT_LIMIT = 20;  // 保護できる写真の上限枚数
const FRAME_MAX = 20;      // フレーム残り回数の上限
const SPECIAL_ITEM_CHANCE = 0.10; // 特殊アイテム出現確率（10%）
const SPECIAL_ITEMS = [
  { type: 'theme',   weight: 10, emoji: '🎁', label: '新テーマ' },
  { type: 'frame',   weight: 40, emoji: '🌟', label: 'フレーム+5' },
  { type: 'harmony', weight: 20, emoji: '🎊', label: '和気あいあい' },
  { type: 'scope',   weight: 30, emoji: '🔭', label: 'スコープ' },
];
function pickSpecialItem(excludeTypes = []) {
  const pool  = excludeTypes.length ? SPECIAL_ITEMS.filter(i => !excludeTypes.includes(i.type)) : SPECIAL_ITEMS;
  const total = pool.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of pool) { r -= item.weight; if (r <= 0) return item; }
  return pool[pool.length - 1];
}
// 和気あいあい：画面中央50%面積の範囲にランダム配置（生き物同士の重なり面積50%未満）
function calculateHarmonyPositions(count, size) {
  const S  = size ?? 60;
  const SW = SCREEN_W * Math.SQRT1_2;
  const SH = SCREEN_H * Math.SQRT1_2;
  const mx = (SCREEN_W - SW) / 2;
  const my = (SCREEN_H - SH) / 2;
  // 2つの配置が50%以上重なっているか判定（top-leftベースの正方形として計算）
  const overlaps = (a, b) => {
    const ox = Math.max(0, S - Math.abs(a.left - b.left));
    const oy = Math.max(0, S - Math.abs(a.top  - b.top));
    return ox * oy > 0.5 * S * S;
  };
  const positions = [];
  for (let i = 0; i < count; i++) {
    let pos;
    let tries = 0;
    do {
      pos = {
        left: mx + Math.random() * Math.max(0, SW - S),
        top:  my + Math.random() * Math.max(0, SH - S),
      };
      tries++;
    } while (tries < 50 && positions.some(p => overlaps(pos, p)));
    positions.push(pos);
  }
  return positions;
}

// テーマ別フレーム画像（保存時のみ合成）
const THEME_FRAMES = {
  default: require('./assets/frame-default.png'),
  flower:  require('./assets/frame-flower.png'),
  stylish: require('./assets/frame-stylish.png'),
  ocean:   require('./assets/frame-ocean.png'),
  forest:  require('./assets/frame-forest.png'),
  savanna: require('./assets/frame-savanna.png'),
};

async function loadSettings() {
  try {
    const json = await AsyncStorage.getItem(SETTINGS_KEY);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

async function persistSettings(theme, albumMode, frameEnabled, fullScreen, unlockedThemes, frameCounts, language = 'ja') {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme, albumMode, frameEnabled, fullScreen, unlockedThemes, frameCounts, language }));
  } catch {}
}

async function persistAutoDelete(autoDelete, autoDeleteTarget) {
  try {
    await AsyncStorage.setItem(AUTO_DELETE_KEY, JSON.stringify({ autoDelete, autoDeleteTarget }));
  } catch {}
}

async function persistAudioSettings(bgmEnabled, seEnabled) {
  try {
    await AsyncStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify({ bgmEnabled, seEnabled }));
  } catch {}
}

async function persistSavedPhotoIds(ids) {
  try {
    await AsyncStorage.setItem(SAVED_PHOTOS_KEY, JSON.stringify(ids));
  } catch {}
}

// テーマIDのリスト（frameCounts の初期値生成用）
const ALL_THEME_IDS = ['default', 'flower', 'stylish', 'ocean', 'forest', 'savanna'];
const INITIAL_FRAME_COUNTS = Object.fromEntries(ALL_THEME_IDS.map(id => [id, 0]));

// テーマ別の生き物セット
const CREATURE_SETS = {
  default: [
    { id: 'octopus', emoji: '🐙',  size: 80 },
    { id: 'alien',   emoji: '👽',  size: 70 },
    { id: 'spider',  emoji: '🕷️', size: 60 },
    { id: 'ghost',   emoji: '👻',  size: 75 },
    { id: 'eye',     emoji: '👁️', size: 65 },
    { id: 'bug',     emoji: '🐛',  size: 55 },
    // 追加（6→8）
    { id: 'microbe', emoji: '🦠',  size: 55 },
    { id: 'zombie',  emoji: '🧟',  size: 75 },
  ],
  flower: [
    { id: 'rose',      emoji: '🌹', size: 70 },
    { id: 'tulip',     emoji: '🌷', size: 65 },
    { id: 'cherry',    emoji: '🌸', size: 75 },
    { id: 'sunflower', emoji: '🌻', size: 80 },
    { id: 'bouquet',   emoji: '💐', size: 85 },
    // 追加（5→8）
    { id: 'hibiscus',  emoji: '🌺', size: 70 },
    { id: 'blossom',   emoji: '🌼', size: 65 },
    { id: 'lotus',     emoji: '🪷', size: 75 },
  ],
  stylish: [
    { id: 'diamond',  emoji: '💎', size: 65 },
    { id: 'sparkle',  emoji: '✨', size: 70 },
    { id: 'ring',     emoji: '💍', size: 60 },
    { id: 'sheart',   emoji: '💖', size: 75 },
    { id: 'ribbon',   emoji: '🎀', size: 65 },
    // 追加（5→8）
    { id: 'crown',    emoji: '👑', size: 70 },
    { id: 'fan',      emoji: '🪭', size: 65 },
    { id: 'lipstick', emoji: '💄', size: 55 },
  ],
  ocean: [
    { id: 'jellyfish', emoji: '🪼', size: 70 },
    { id: 'fish',      emoji: '🐟', size: 60 },
    { id: 'whale',     emoji: '🐳', size: 90 },
    { id: 'octopus2',  emoji: '🐙', size: 80 },
    { id: 'dolphin',   emoji: '🐬', size: 85 },
    // 追加（5→8）
    { id: 'shell',     emoji: '🐚', size: 65 },
    { id: 'crab',      emoji: '🦀', size: 65 },
    { id: 'shark',     emoji: '🦈', size: 85 },
  ],
  forest: [
    { id: 'squirrel', emoji: '🐿️', size: 60 },
    { id: 'monkey',   emoji: '🐒',  size: 70 },
    { id: 'bear',     emoji: '🐻',  size: 85 },
    { id: 'raccoon',  emoji: '🦝',  size: 70 },
    { id: 'owl',      emoji: '🦉',  size: 65 },
    // 追加（5→8）
    { id: 'fox',      emoji: '🦊',  size: 65 },
    { id: 'deer',     emoji: '🦌',  size: 80 },
    { id: 'rabbit',   emoji: '🐇',  size: 60 },
  ],
  savanna: [
    { id: 'lion',     emoji: '🦁', size: 85 },
    { id: 'giraffe',  emoji: '🦒', size: 90 },
    { id: 'elephant', emoji: '🐘', size: 95 },
    { id: 'zebra',    emoji: '🦓', size: 80 },
    { id: 'flamingo', emoji: '🦩', size: 75 },
    // 追加（5→8）
    { id: 'rhino',    emoji: '🦏', size: 90 },
    { id: 'leopard',  emoji: '🐆', size: 80 },
    { id: 'hippo',    emoji: '🦛', size: 95 },
  ],
};

const SIZE_VARIANTS = [
  ...Array(5).fill({ scale: 1.0 }),
  ...Array(3).fill({ scale: 1.2 }),
  ...Array(2).fill({ scale: 1.5 }),
];

function pickCreature(theme) {
  const set     = CREATURE_SETS[theme] ?? CREATURE_SETS.default;
  const base    = set[Math.floor(Math.random() * set.length)];
  const variant = SIZE_VARIANTS[Math.floor(Math.random() * SIZE_VARIANTS.length)];
  return { ...base, size: base.size * variant.scale, scale: variant.scale };
}

// 上:10%、下・左・右:各30%（4方向）
const EDGE_POOL = [
  ...Array(1).fill('top'),
  ...Array(3).fill('bottom'),
  ...Array(3).fill('left'),
  ...Array(3).fill('right'),
];

// 下・左・右の3方向（均等）
const EDGE3_POOL = ['bottom', 'left', 'right'];

// 生き物ごとのアニメーション種別
// edge: 4方向ランダム / edge3: 下・左・右の3方向 / top: 上のみ / fadein: 画面内フェードイン
const CREATURE_ANIM = {
  // デフォルトテーマ
  spider: 'top',
  eye:    'fadein',
  ghost:  'fadein',
  // フラワーテーマ
  rose:      'edge',
  tulip:     'edge',
  cherry:    'fadein',
  sunflower: 'fadein',
  bouquet:   'top',
  // おしゃれテーマ
  diamond: 'fadein',
  sparkle: 'fadein',
  ring:    'fadein',
  sheart:  'fadein',
  ribbon:  'fadein',
  // 海の生き物テーマ
  jellyfish: 'fadein',
  fish:      'edge',
  whale:     'edge',
  octopus2:  'edge',
  dolphin:   'edge3',
  // 森の生き物テーマ
  squirrel: 'top',
  monkey:   'top',
  bear:     'edge3',
  raccoon:  'edge',
  owl:      'fadein',
  // サバンナの生き物テーマ
  lion:     'edge3',
  giraffe:  'edge',
  elephant: 'edge3',
  zebra:    'edge',
  flamingo: 'fadein',
  // サバンナ追加分
  rhino:    'edge3',
  leopard:  'edge3',
  hippo:    'edge3',
  // デフォルト追加分
  microbe:  'fadein',
  zombie:   'edge',
  // フラワー追加分
  hibiscus: 'fadein',
  blossom:  'fadein',
  lotus:    'fadein',
  // おしゃれ追加分
  crown:    'fadein',
  fan:      'fadein',
  lipstick: 'fadein',
  // 海追加分
  shell:    'fadein',  // フェードイン（砂浜から現れるイメージ）
  crab:     'edge3',
  shark:    'edge3',
  // 森追加分
  fox:      'edge',
  deer:     'edge3',
  rabbit:   'edge3',
};
function getAnimMode(id) { return CREATURE_ANIM[id] || 'edge'; }

// テーマごとの特殊アニメーション（出現のたびに50%の確率で通常アニメーションと差し替え）
const THEME_SPECIAL_ANIMS = {
  default: ['bounce',   'spin_in' ],  // 不気味な落下・回転出現
  flower:  ['float_up', 'spin_in' ],  // 花びらが浮かぶ・ひらひら回転出現
  stylish: ['spin_in',  'float_up'],  // キラキラ回転・ひらひら浮く
  ocean:   ['float_up', 'bounce'  ],  // 水中から浮上・底から跳ねる
  forest:  ['bounce',   'spin_in' ],  // 木から落下・旋回しながら降りる
  savanna: ['bounce',   'spin_in' ],  // ドシンと着地・くるっと舞い降りる
};


// vp: { x, y, w, h, fullScreen } — creature spawn viewport
// 安全フレーム（生き物の出現アニメーション完了時の収納範囲）を計算
function getSafeFrame(vp) {
  const { x: VX, y: VY, w: VW, h: VH, fullScreen: isFS } = vp;
  const hmPct = isFS ? 0.25 : 0.20; // 上下マージン割合
  const wPct  = 0.10;                // 左右マージン割合
  return {
    left:   VX + VW * wPct,
    top:    VY + VH * hmPct,
    right:  VX + VW * (1 - wPct),
    bottom: VY + VH * (1 - hmPct),
  };
}

function getEdgeSetup(edge, size, vp) {
  const { x: VX, y: VY, w: VW, h: VH } = vp;
  const sf   = getSafeFrame(vp);
  // ビューポートの中心（各方向で画面半分を超えないようにするため）
  const midX = VX + VW / 2;
  const midY = VY + VH / 2;
  const safeW = Math.max(0, sf.right  - sf.left  - size);
  const safeH = Math.max(0, sf.bottom - sf.top   - size);

  switch (edge) {
    case 'top': {
      // 上から入る → 上半分（midY）を超えない
      const rH = Math.max(0, Math.min(sf.bottom, midY) - size - sf.top);
      return {
        initTop:  VY - size,
        initLeft: sf.left + Math.random() * safeW,
        enterTo:  { top: sf.top + Math.random() * rH },
      };
    }
    case 'bottom': {
      // 下から入る → 下半分（midY）を超えない
      const rTop = Math.max(sf.top, midY);
      const rH   = Math.max(0, sf.bottom - size - rTop);
      return {
        initTop:  VY + VH,
        initLeft: sf.left + Math.random() * safeW,
        enterTo:  { top: rTop + Math.random() * rH },
      };
    }
    case 'left': {
      // 左から入る → 左半分（midX）を超えない
      const rW = Math.max(0, Math.min(sf.right, midX) - size - sf.left);
      return {
        initTop:  sf.top + Math.random() * safeH,
        initLeft: VX - size,
        enterTo:  { left: sf.left + Math.random() * rW },
      };
    }
    case 'right': {
      // 右から入る → 右半分（midX）を超えない
      const rLeft = Math.max(sf.left, midX);
      const rW    = Math.max(0, sf.right - size - rLeft);
      return {
        initTop:  sf.top + Math.random() * safeH,
        initLeft: VX + VW,
        enterTo:  { left: rLeft + Math.random() * rW },
      };
    }
  }
}

const FULL_VP = { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, fullScreen: true };

function CreatureOverlay({ creature, mode, edge, onDone, posRef, onFinalPos, onCapturable, onUncapturable, vp, isSpecial, itemLabel, pauseAfterCapturable }) {
  const viewport      = vp ?? FULL_VP;
  const { x: VX, y: VY, w: VW, h: VH } = viewport;
  const isFade        = mode === 'fadein';
  const isBounce      = mode === 'bounce';
  const isFloatUp     = mode === 'float_up';
  const isSpinIn      = mode === 'spin_in';
  const isSpecialMode = isBounce || isFloatUp || isSpinIn;
  const edgeSetup = (isFade || isSpecialMode) ? null : getEdgeSetup(edge, creature.size, viewport);
  const sf = getSafeFrame(viewport);
  // bounce は横から入る：左右どちらからかを決定
  const bounceFromLeft = isBounce ? Math.random() < 0.5 : false;
  const initTop  = isFloatUp  ? VY + VH   // 画面下外から浮き上がり
                 : isBounce   ? sf.bottom - creature.size  // 床レベルから横バウンド開始
                 : isSpinIn   ? sf.top  + Math.random() * Math.max(0, sf.bottom - sf.top  - creature.size)
                 : isFade     ? sf.top  + Math.random() * Math.max(0, sf.bottom - sf.top  - creature.size)
                 :               edgeSetup.initTop;
  const initLeft = isBounce               ? (bounceFromLeft ? VX - creature.size : VX + VW)  // 画面横外から
                 : (isSpecialMode || isFade) ? sf.left + Math.random() * Math.max(0, sf.right - sf.left - creature.size)
                 :                             edgeSetup.initLeft;
  const enterTo  = (isFade || isSpecialMode) ? null : edgeSetup.enterTo;

  const topAnim     = useRef(new Animated.Value(initTop)).current;
  const leftAnim    = useRef(new Animated.Value(initLeft)).current;
  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(isFade || isFloatUp || isSpinIn ? 0 : 1)).current;
  const rotateAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    posRef.current = { top: initTop, left: initLeft };
    const tl = topAnim.addListener(({ value })  => { posRef.current.top  = value; });
    const ll = leftAnim.addListener(({ value }) => { posRef.current.left = value; });
    // 生き物の最終停止座標をスコープへ通知（特殊モードは入場アニメーション内で呼ぶ）
    if (!isSpecialMode) {
      const finalTop  = isFade ? initTop  : (enterTo?.top  !== undefined ? enterTo.top  : initTop);
      const finalLeft = isFade ? initLeft : (enterTo?.left !== undefined ? enterTo.left : initLeft);
      onFinalPos?.({ top: finalTop, left: finalLeft });
    }
    let alive = true;

    const middle = Animated.sequence([
      Animated.delay(1500),
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.3, duration: 200, useNativeDriver: false }),
        Animated.timing(scaleAnim, { toValue: 1.0, duration: 200, useNativeDriver: false }),
      ]),
      Animated.delay(800),
    ]);

    if (isFade) {
      Animated.timing(opacityAnim, { toValue: 1, duration: 600, useNativeDriver: false })
        .start(({ finished }) => {
          if (!finished || !alive) return;
          onCapturable?.();
          if (pauseAfterCapturable) return; // チュートリアル：capturable状態のまま停止
          middle.start(({ finished }) => {
            if (!finished || !alive) return;
            onUncapturable?.();
            Animated.timing(opacityAnim, { toValue: 0, duration: 400, useNativeDriver: false })
              .start(({ finished }) => { if (finished && alive) onDone(); });
          });
        });
    } else if (isBounce) {
      // 横から入りながら大小の放物線バウンド → フェードアウト退場
      const safeW      = sf.right  - sf.left;
      const safeH      = sf.bottom - sf.top;
      const groundY    = sf.bottom - creature.size;               // 着地する床の高さ
      const targetLeft = sf.left + safeW * 0.2 + Math.random() * safeW * 0.4;
      const peakY1     = groundY - safeH * 0.55;                 // 大きな弧の頂点
      const peakY2     = groundY - safeH * 0.25;                 // 小さな弧の頂点
      onFinalPos?.({ top: groundY, left: targetLeft });
      Animated.parallel([
        // 横: 画面横外から中央へスムーズに移動（合計1000ms）
        Animated.timing(leftAnim, { toValue: targetLeft, duration: 1000, useNativeDriver: false }),
        // 縦: 大小の放物線を連続バウンド（合計1000ms）
        Animated.sequence([
          Animated.timing(topAnim, { toValue: peakY1,  duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(topAnim, { toValue: groundY, duration: 280, easing: Easing.in(Easing.quad),  useNativeDriver: false }),
          Animated.timing(topAnim, { toValue: peakY2,  duration: 210, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(topAnim, { toValue: groundY, duration: 210, easing: Easing.in(Easing.quad),  useNativeDriver: false }),
        ]),
      ]).start(({ finished }) => {
        if (!finished || !alive) return;
        onCapturable?.();
        if (pauseAfterCapturable) return;
        middle.start(({ finished }) => {
          if (!finished || !alive) return;
          onUncapturable?.();
          Animated.timing(opacityAnim, { toValue: 0, duration: 400, useNativeDriver: false })
            .start(({ finished }) => { if (finished && alive) onDone(); });
        });
      });
    } else if (isFloatUp) {
      // 下から浮き上がり＋フェードイン → フェードアウト退場
      const targetTop = sf.top + Math.random() * Math.max(0, sf.bottom - sf.top - creature.size);
      onFinalPos?.({ top: targetTop, left: initLeft });
      Animated.parallel([
        Animated.timing(topAnim,     { toValue: targetTop, duration: 800, useNativeDriver: false }),
        Animated.timing(opacityAnim, { toValue: 1,         duration: 800, useNativeDriver: false }),
      ]).start(({ finished }) => {
        if (!finished || !alive) return;
        onCapturable?.();
        if (pauseAfterCapturable) return;
        middle.start(({ finished }) => {
          if (!finished || !alive) return;
          onUncapturable?.();
          Animated.timing(opacityAnim, { toValue: 0, duration: 400, useNativeDriver: false })
            .start(({ finished }) => { if (finished && alive) onDone(); });
        });
      });
    } else if (isSpinIn) {
      // 回転しながらフェードイン → フェードアウト退場
      onFinalPos?.({ top: initTop, left: initLeft });
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(rotateAnim,  { toValue: 1, duration: 700, useNativeDriver: false }),
      ]).start(({ finished }) => {
        if (!finished || !alive) return;
        onCapturable?.();
        if (pauseAfterCapturable) return;
        middle.start(({ finished }) => {
          if (!finished || !alive) return;
          onUncapturable?.();
          Animated.timing(opacityAnim, { toValue: 0, duration: 400, useNativeDriver: false })
            .start(({ finished }) => { if (finished && alive) onDone(); });
        });
      });
    } else {
      const enterAnims = [];
      if (enterTo.top  !== undefined) enterAnims.push(Animated.timing(topAnim,  { toValue: enterTo.top,  duration: 600, useNativeDriver: false }));
      if (enterTo.left !== undefined) enterAnims.push(Animated.timing(leftAnim, { toValue: enterTo.left, duration: 600, useNativeDriver: false }));
      Animated.parallel(enterAnims).start(({ finished }) => {
        if (!finished || !alive) return;
        onCapturable?.();
        if (pauseAfterCapturable) return; // チュートリアル：capturable状態のまま停止
        middle.start(({ finished }) => {
          if (!finished || !alive) return;
          onUncapturable?.();
          const exitAnim = edge === 'top' || edge === 'bottom'
            ? Animated.timing(topAnim,  { toValue: initTop,  duration: 400, useNativeDriver: false })
            : Animated.timing(leftAnim, { toValue: initLeft, duration: 400, useNativeDriver: false });
          exitAnim.start(({ finished }) => { if (finished && alive) onDone(); });
        });
      });
    }

    return () => {
      alive = false;
      topAnim.stopAnimation();
      leftAnim.stopAnimation();
      opacityAnim.stopAnimation();
      scaleAnim.stopAnimation();
      rotateAnim.stopAnimation();
      topAnim.removeListener(tl);
      leftAnim.removeListener(ll);
    };
  }, []);

  return (
    <Animated.View style={[styles.creature, {
      top: topAnim, left: leftAnim,
      opacity: opacityAnim,
      transform: [
        { rotate: rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
        { scale: scaleAnim },
        ...(edge === 'left' ? [{ scaleX: -1 }] : []),
      ],
    }]}>
      <Text style={{ fontSize: creature.size * 0.8 }}>{creature.emoji}</Text>
      {isSpecial && itemLabel && (
        <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 4, paddingHorizontal: 4, marginTop: 2 }}>
          {itemLabel}
        </Text>
      )}
    </Animated.View>
  );
}

// スコープオーバーレイ：漂い → 生き物追跡 → 二回拡大アニメーション → 消える
function ScopeOverlay({ posRef, creatureSize, finalPosRef, creatureActive, capturable, onAnimComplete, fullScreen }) {
  const SIZE = 72;
  // フレームあり（fullScreen=false）のときはカメラ表示域（CAMERA_AREA_H）内に収める
  const areaH = fullScreen ? SCREEN_H : CAMERA_AREA_H;
  const leftAnim    = useRef(new Animated.Value(SCREEN_W / 2 - SIZE / 2)).current;
  const topAnim     = useRef(new Animated.Value(areaH / 2 - SIZE / 2)).current;
  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.75)).current;
  const phaseRef    = useRef('float'); // 'float' | 'track' | 'zoom' | 'done'

  // 漂うアニメーション（creature が現れるまで）
  useEffect(() => {
    let alive = true;
    const drift = () => {
      if (!alive || phaseRef.current !== 'float') return;
      // 漂い範囲：カメラ表示域の中央50%面積に限定（各辺 sqrt(0.5) ≈ 70.7%）
      const SW = SCREEN_W * Math.SQRT1_2;
      const SH = areaH    * Math.SQRT1_2;
      const mx = (SCREEN_W - SW) / 2;
      const my = (areaH   - SH) / 2;
      const tx = mx + Math.random() * Math.max(0, SW - SIZE);
      const ty = my + Math.random() * Math.max(0, SH - SIZE);
      Animated.parallel([
        Animated.timing(leftAnim, { toValue: tx, duration: 1800 + Math.random() * 800, useNativeDriver: false }),
        Animated.timing(topAnim,  { toValue: ty, duration: 1800 + Math.random() * 800, useNativeDriver: false }),
      ]).start(({ finished }) => {
        if (alive && finished && phaseRef.current === 'float') setTimeout(drift, 300 + Math.random() * 600);
      });
    };
    drift();
    return () => { alive = false; };
  }, []);

  // 生き物が出現したら最終停止地点へ1本の直線アニメーション（座標飛び防止）
  useEffect(() => {
    if (!creatureActive) { phaseRef.current = 'float'; return; }
    phaseRef.current = 'track';
    // 生き物の最終停止座標の中心を照準
    const targetLeft = (finalPosRef?.current?.left ?? 0) + (creatureSize ?? 0) / 2 - SIZE / 2;
    const targetTop  = (finalPosRef?.current?.top  ?? 0) + (creatureSize ?? 0) / 2 - SIZE / 2;
    const TRACK_SPEED = 380;
    // stopAnimation(callback) で追跡開始時の実座標を取得してからアニメーション開始
    let startLeft = SCREEN_W / 2 - SIZE / 2;
    let startTop  = SCREEN_H / 2 - SIZE / 2;
    leftAnim.stopAnimation((vl) => { startLeft = vl; });
    topAnim.stopAnimation((vt)  => { startTop  = vt; });
    const dx = targetLeft - startLeft;
    const dy = targetTop  - startTop;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = Math.max(250, (dist / TRACK_SPEED) * 1000);
    Animated.parallel([
      Animated.timing(leftAnim, { toValue: targetLeft, duration, useNativeDriver: false }),
      Animated.timing(topAnim,  { toValue: targetTop,  duration, useNativeDriver: false }),
    ]).start();
  }, [creatureActive]);

  // 撮影可能になったら二回拡大アニメーション → 消える
  useEffect(() => {
    if (!capturable || phaseRef.current === 'zoom' || phaseRef.current === 'done') return;
    phaseRef.current = 'zoom';
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.9, duration: 220, useNativeDriver: false }),
      Animated.timing(scaleAnim, { toValue: 1.0, duration: 180, useNativeDriver: false }),
      Animated.timing(scaleAnim, { toValue: 1.9, duration: 220, useNativeDriver: false }),
      Animated.timing(scaleAnim, { toValue: 1.0, duration: 180, useNativeDriver: false }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start(() => { phaseRef.current = 'done'; onAnimComplete?.(); });
  }, [capturable]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', zIndex: 15,
        width: SIZE, height: SIZE, borderRadius: SIZE / 2,
        backgroundColor: 'rgba(0,10,20,0.12)',
        borderWidth: 2, borderColor: 'rgba(140,220,255,0.9)',
        left: leftAnim, top: topAnim,
        opacity: opacityAnim,
        transform: [{ scale: scaleAnim }],
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* 十字線 */}
      <View pointerEvents="none" style={{ position: 'absolute', width: SIZE, height: 1, backgroundColor: 'rgba(140,220,255,0.6)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', height: SIZE, width: 1, backgroundColor: 'rgba(140,220,255,0.6)' }} />
      {/* 中心円 */}
      <View pointerEvents="none" style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(140,220,255,0.9)' }} />
    </Animated.View>
  );
}

export default function App() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef      = useRef(null);
  const compositeRef   = useRef(null);
  const creaturePosRef = useRef({ top: 0, left: 0 });

  const [activeCreature, setActiveCreature] = useState(null);
  const [compositing, setCompositing]       = useState(null);
  const [successPhoto, setSuccessPhoto]     = useState(null);

  // 'album' = CreatureCameraアルバムに保存 / 'default' = 通常保存 / null = 初期化中
  const [saveMode, setSaveMode] = useState(null);

  const [galleryVisible, setGalleryVisible]   = useState(false);
  const [galleryAssets, setGalleryAssets]     = useState([]);
  const [selectedIndex, setSelectedIndex]     = useState(null);
  const [pendingIndex, setPendingIndex]       = useState(null);
  const [primarySlot, setPrimarySlot]         = useState(0);
  const [settingsVisible, setSettingsVisible]   = useState(false);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [theme, setTheme]                       = useState('default');
  const [frameEnabled, setFrameEnabled]       = useState(true);
  const [fullScreen, setFullScreen]           = useState(false);
  // 取得済みテーマID一覧（デフォルトは常に含む）
  const [unlockedThemes, setUnlockedThemes]   = useState(['default', 'flower', 'stylish']);
  // テーマごとのフレーム残り使用回数（上限20、初期値0）
  const [frameCounts, setFrameCounts]         = useState(INITIAL_FRAME_COUNTS);
  const frameCountsRef = useRef(INITIAL_FRAME_COUNTS);

  // ギャラリー選択モード
  const [selectionMode, setSelectionMode]     = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState({});  // { id: true }
  const [savedPhotoIds, setSavedPhotoIds]     = useState({});    // { id: true }
  // フォトビューワー表示フラグ（アニメーション付きclose用）
  const [viewerVisible, setViewerVisible]     = useState(false);
  // 超過モード：起動時に上限超過を検知した場合にtrue
  const [overflowMode, setOverflowMode]       = useState(false);
  // 特殊アイテム状態
  const [harmonyActive, setHarmonyActive]     = useState(false); // 和気あいあい発動中
  const [scopeActive, setScopeActive]         = useState(false); // スコープ発動中
  const [creatureCapturable, setCreatureCapturable] = useState(false); // 現在の生き物が撮影可能か
  const [autoDelete, setAutoDelete]           = useState(false);        // 自動削除：有効/無効
  const [autoDeleteTarget, setAutoDeleteTarget] = useState('oldest');   // 'oldest' | 'newest'
  const [bgmEnabled, setBgmEnabled]           = useState(true);         // BGM：あり/なし
  const [seEnabled, setSeEnabled]             = useState(true);         // SE：あり/なし
  const [language, setLanguage]               = useState('ja');         // 表示言語（'ja' | 'en'）
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);      // 言語ドロップダウン開閉
  const harmonyActiveRef   = useRef(false);
  const scopeActiveRef     = useRef(false);
  const autoDeleteRef      = useRef(false);
  const autoDeleteTargetRef = useRef('oldest');
  const bgmEnabledRef         = useRef(true);
  const seEnabledRef          = useRef(true);
  const bgmSoundRef           = useRef(null);
  const bgmIntentionalStopRef = useRef(false); // 意図的な停止フラグ（自動再開と区別）
  const scopeCountRef      = useRef(0);  // スコープ残り使用回数
  const [tutorialStep, setTutorialStep] = useState(0); // 0=非表示, 1〜18=各ステップ
  const [tutorialCapturing, setTutorialCapturing] = useState(false); // シャッター押下〜保存完了中にバブルを隠す
  const tutorialStepRef      = useRef(0);
  const tutorialAutoShootRef = useRef(null); // step12の10秒自動撮影タイマー
  const takePictureRef       = useRef(null); // stale closure対策
  const playSERef            = useRef(null); // stale closure対策
  const skipForcedItemRef      = useRef(0);     // チュートリアルスキップ後の強制特殊アイテム残りカウント（4→0）
  const forceNextSpecialItemRef = useRef(false); // 次の scheduleNextCreature で強制的に特殊アイテムを出現させるフラグ
  const pityCounterRef         = useRef(0);     // 連続通常撮影カウンタ（PITY_THRESHOLD超過で出現率+1%/回）

  const timerRef             = useRef(null);
  const isTakingPictureRef   = useRef(false); // 撮影〜保存完了までの多重入力防止
  const skipOverflowAlertRef = useRef(false);  // コンポジット後の超過アラートと起動時アラートの重複防止
  const capturableRef        = useRef(false);
  const lastCreatureIdRef       = useRef(null);              // 連続同生き物防止
  const scheduleNextCreatureRef = useRef(null);              // stale closure 対策
  const creatureFinalPosRef     = useRef({ top: 0, left: 0 }); // 生き物の最終停止座標（スコープ用）
  const frameLoadResolveRef  = useRef(null);
  const selectedIndexRef     = useRef(null);
  const galleryCountRef      = useRef(0);
  const slotX0               = useRef(new Animated.Value(0)).current;
  const slotX1               = useRef(new Animated.Value(0)).current;
  const isViewerAnimatingRef = useRef(false);
  const triggerTransitionRef = useRef(null);
  const primarySlotRef       = useRef(0);
  const slotX                = [slotX0, slotX1];
  // ギャラリーアニメーション
  const gallerySlideY  = useRef(new Animated.Value(SCREEN_H)).current;
  const galleryOpacity = useRef(new Animated.Value(0)).current;
  // フォトビューワーclose アニメーション
  const viewerSlideY   = useRef(new Animated.Value(0)).current;
  const viewerOpacity  = useRef(new Animated.Value(1)).current;
  // stale closure 対策 ref
  const selectedPhotoIdsRef = useRef({});
  const savedPhotoIdsRef    = useRef({});
  const overflowModeRef     = useRef(false);
  const saveModeRef         = useRef(null);

  // 起動時にAudioモードを設定
  // playsInSilentModeIOS: false → サイレントモード時はBGM/SE再生しない
  // MixWithOthers → カメラシャッター時にBGMが止まらないようにする
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      staysActiveInBackground: false,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: false,
    }).catch(() => {});
  }, []);

  // カメラ許可取得後にメディアライブラリを初期化
  useEffect(() => {
    if (!cameraPermission?.granted) return;
    initMediaLibrary();
  }, [cameraPermission?.granted]);

  async function initMediaLibrary() {
    const perm = await MediaLibrary.requestPermissionsAsync(false);

    if (perm.status !== 'granted') {
      setSaveMode('none');
      return;
    }

    const hasFullAccess = perm.accessPrivileges === 'all';

    if (!hasFullAccess) {
      setSaveMode('default');
      return;
    }

    // 保存済み設定を読み込む
    const saved = await loadSettings();

    // 自動削除設定を読み込む
    try {
      const adJson = await AsyncStorage.getItem(AUTO_DELETE_KEY);
      if (adJson) {
        const ad = JSON.parse(adJson);
        setAutoDelete(ad.autoDelete === true);
        setAutoDeleteTarget(ad.autoDeleteTarget === 'newest' ? 'newest' : 'oldest');
        autoDeleteRef.current = ad.autoDelete === true;
        autoDeleteTargetRef.current = ad.autoDeleteTarget === 'newest' ? 'newest' : 'oldest';
      }
    } catch {}

    // 音声設定を読み込む
    try {
      const audioJson = await AsyncStorage.getItem(AUDIO_SETTINGS_KEY);
      if (audioJson) {
        const audio = JSON.parse(audioJson);
        if (audio.bgmEnabled === false) { setBgmEnabled(false); bgmEnabledRef.current = false; }
        if (audio.seEnabled  === false) { setSeEnabled(false);  seEnabledRef.current  = false; }
      }
    } catch {}

    // 保存済み写真IDを読み込む
    try {
      const savedIdsJson = await AsyncStorage.getItem(SAVED_PHOTOS_KEY);
      if (savedIdsJson) {
        const ids = JSON.parse(savedIdsJson);
        setSavedPhotoIds(ids);
        savedPhotoIdsRef.current = ids;
      }
    } catch {}

    // チュートリアルスキップ後の強制特殊アイテム残りカウントを読み込む
    try {
      const skipForcedJson = await AsyncStorage.getItem(SKIP_FORCED_ITEM_KEY);
      if (skipForcedJson) {
        const count = parseInt(skipForcedJson, 10);
        if (!isNaN(count) && count > 0) skipForcedItemRef.current = count;
      }
    } catch {}

    // 天井補正カウンタを読み込む
    try {
      const pityJson = await AsyncStorage.getItem(PITY_COUNTER_KEY);
      if (pityJson) {
        const count = parseInt(pityJson, 10);
        if (!isNaN(count) && count > 0) pityCounterRef.current = count;
      }
    } catch {}

    if (saved !== null) {
      // 設定あり → そのまま反映
      const savedLang = saved.language ?? 'ja';
      setLanguage(savedLang);
      _langRef.current = savedLang; // 即時同期（setLanguage は非同期のため）
      const savedTheme = saved.theme || 'default';
      setTheme(savedTheme);
      const albumMode = saved.albumMode ? 'album' : 'default';
      setSaveMode(albumMode);
      setFrameEnabled(saved.frameEnabled !== false);
      setFullScreen(saved.fullScreen !== false);
      // unlockedThemes がない場合は後方互換として既存テーマ＋保存済みテーマを解放済みに
      const defaultUnlocked = ['default', 'flower', 'stylish'];
      if (savedTheme && !defaultUnlocked.includes(savedTheme)) defaultUnlocked.push(savedTheme);
      setUnlockedThemes(saved.unlockedThemes || defaultUnlocked);
      // frameCounts：ない場合は初期値0で補完
      const loadedCounts = { ...INITIAL_FRAME_COUNTS, ...(saved.frameCounts || {}) };
      setFrameCounts(loadedCounts);
      frameCountsRef.current = loadedCounts;
      // 起動時に上限チェック（アルバムモードのみ）→ 超過していれば超過モードをセット
      if (albumMode === 'album') {
        const isOverflow = await checkAlbumLimitAtStartup(albumMode);
        if (isOverflow) setOverflowMode(true);
      }
      // チュートリアル未完了チェック
      try {
        const tutorialDone = await AsyncStorage.getItem(TUTORIAL_KEY);
        if (!tutorialDone) { tutorialStepRef.current = 1; setTutorialStep(1); }
      } catch {}
      return;
    }

    // 設定なし → デフォルトテーマのみ所持・フレーム5回で初期化
    const initialUnlocked = ['default'];
    const initialFrameCounts = Object.fromEntries(ALL_THEME_IDS.map(id => [id, id === 'default' ? 5 : 0]));
    setUnlockedThemes(initialUnlocked);
    setFrameCounts(initialFrameCounts);
    frameCountsRef.current = initialFrameCounts;

    // 設定なし → アルバムの有無で判定
    const existingAlbum = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
    if (existingAlbum) {
      // アルバムあり → アルバムモードで開始（設定として保存）
      setSaveMode('album');
      persistSettings('default', true, true, false, initialUnlocked, initialFrameCounts);
      const isOverflow = await checkAlbumLimitAtStartup('album');
      if (isOverflow) setOverflowMode(true);
      // チュートリアル未完了チェック
      try {
        const tutorialDone = await AsyncStorage.getItem(TUTORIAL_KEY);
        if (!tutorialDone) { tutorialStepRef.current = 1; setTutorialStep(1); }
      } catch {}
      return;
    }

    // 設定なし・アルバムなし → 同意を求める
    Alert.alert(
      t('alert_album_create_title'),
      t('alert_album_create_body'),
      [
        { text: t('btn_no'), style: 'cancel', onPress: () => {
          setSaveMode('default');
          persistSettings('default', false, true, false, initialUnlocked, initialFrameCounts);
        }},
        { text: t('btn_yes'), onPress: () => {
          setSaveMode('album');
          persistSettings('default', true, true, false, initialUnlocked, initialFrameCounts);
        }},
      ]
    );

    // チュートリアル未完了チェック（設定なし初回ユーザー）
    try {
      const tutorialDone = await AsyncStorage.getItem(TUTORIAL_KEY);
      if (!tutorialDone) { tutorialStepRef.current = 1; setTutorialStep(1); }
    } catch {}
  }

  // 起動時アルバム上限チェック。上限超過なら true を返す。
  async function checkAlbumLimitAtStartup(effectiveSaveMode) {
    try {
      let count = 0;
      if (effectiveSaveMode === 'album') {
        const album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
        if (!album) return false;
        const result = await MediaLibrary.getAssetsAsync({
          album,
          mediaType: MediaLibrary.MediaType.photo,
          first: PHOTO_LIMIT + 1,
        });
        count = result.assets.length;
      } else {
        const result = await MediaLibrary.getAssetsAsync({
          mediaType: MediaLibrary.MediaType.photo,
          first: PHOTO_LIMIT + 1,
        });
        count = result.assets.length;
      }
      return count > PHOTO_LIMIT;
    } catch {
      return false;
    }
  }

  // 写真の保存（saveModeに応じて切り替え）
  async function savePicture(uri) {
    if (saveMode === 'album') {
      const asset = await MediaLibrary.createAssetAsync(uri);
      const album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync(ALBUM_NAME, asset, false);
      }
    } else {
      await MediaLibrary.saveToLibraryAsync(uri);
    }
  }

  const scheduleNextCreature = useCallback(() => {
    if (tutorialStepRef.current > 0) return; // チュートリアル中は自動出現しない
    const delay = 2000 + Math.random() * 6000;
    timerRef.current = setTimeout(() => {
      if (tutorialStepRef.current > 0) return; // タイマー発火時にも再確認
      const vp = fullScreen
        ? { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, fullScreen: true }
        : { x: 10, y: 20, w: SCREEN_W - 20, h: CAMERA_AREA_H - 20, clampBottom: true, fullScreen: false };
      // チュートリアルスキップ後の強制特殊アイテム（5枚目撮影保証）
      if (forceNextSpecialItemRef.current) {
        forceNextSpecialItemRef.current = false;
        playSERef.current?.(SE_ITEM_PREVIEW);
        // 予兆SE再生後1秒待ってから出現アニメーション開始
        const item = pickSpecialItem(scopeActiveRef.current ? ['scope'] : []);
        timerRef.current = setTimeout(() => {
          setActiveCreature({ creature: { id: item.type, emoji: item.emoji, size: 80 }, mode: 'fadein', edge: null, key: Date.now(), vp, isSpecial: true, itemType: item.type, itemLabel: t('item_' + item.type) });
        }, 1000);
        return;
      }
      // 1段階目：特殊アイテム抽選（和気あいあい発動中はスキップ）
      // 天井補正：PITY_THRESHOLD 超過後は1回ごとに+1%
      const effectiveChance = SPECIAL_ITEM_CHANCE +
        Math.max(0, (pityCounterRef.current - PITY_THRESHOLD) * 0.01);
      if (!harmonyActiveRef.current && Math.random() < effectiveChance) {
        playSERef.current?.(SE_ITEM_PREVIEW); // アイテム出現予告SE
        // 予兆SE再生後1秒待ってから出現アニメーション開始
        const item = pickSpecialItem(scopeActiveRef.current ? ['scope'] : []);
        timerRef.current = setTimeout(() => {
          setActiveCreature({ creature: { id: item.type, emoji: item.emoji, size: 80 }, mode: 'fadein', edge: null, key: Date.now(), vp, isSpecial: true, itemType: item.type, itemLabel: t('item_' + item.type) });
        }, 1000);
        return;
      }
      // 2段階目：通常生き物抽選（直前と同じ生き物は1回リトライ）
      let creature = pickCreature(theme);
      if (creature.id === lastCreatureIdRef.current) {
        const alt = pickCreature(theme);
        if (alt.id !== creature.id) creature = alt;
      }
      lastCreatureIdRef.current = creature.id;
      // 50%の確率でテーマ固有の特殊アニメーションに差し替え
      const normalMode   = getAnimMode(creature.id);
      const specialAnims = THEME_SPECIAL_ANIMS[theme];
      const mode         = (specialAnims && Math.random() < 0.5)
        ? specialAnims[Math.floor(Math.random() * specialAnims.length)]
        : normalMode;
      const edge     = mode === 'fadein'   ? null
                     : mode === 'bounce'   ? null
                     : mode === 'float_up' ? null
                     : mode === 'spin_in'  ? null
                     : mode === 'top'      ? 'top'
                     : mode === 'edge3'    ? EDGE3_POOL[Math.floor(Math.random() * EDGE3_POOL.length)]
                     : EDGE_POOL[Math.floor(Math.random() * EDGE_POOL.length)];
      setActiveCreature({ creature, mode, edge, key: Date.now(), vp });
    }, delay);
  }, [theme, fullScreen]);

  useEffect(() => {
    scheduleNextCreature();
    return () => clearTimeout(timerRef.current);
  }, [scheduleNextCreature]);

  // 設定・ギャラリーが開いたらアニメーション停止、閉じたら再スケジュール
  const wasOverlayOpenRef = useRef(false);
  useEffect(() => {
    const isOpen = settingsVisible || galleryVisible;
    if (isOpen) {
      clearTimeout(timerRef.current);
      setActiveCreature(null);
      capturableRef.current = false;
      setCreatureCapturable(false);
      wasOverlayOpenRef.current = true;
    } else if (wasOverlayOpenRef.current) {
      wasOverlayOpenRef.current = false;
      if (tutorialStepRef.current === 0) scheduleNextCreatureRef.current?.();
    }
  }, [settingsVisible, galleryVisible]);

  // 超過モード検知時：ダイアログを表示してからギャラリーを開く（起動時のみ）
  useEffect(() => {
    if (overflowMode && saveMode !== null) {
      if (skipOverflowAlertRef.current) { skipOverflowAlertRef.current = false; return; }
      Alert.alert(
        t('alert_overflow_title'),
        t('alert_overflow_body', { limit: PHOTO_LIMIT }),
        [{ text: t('btn_ok'), onPress: () => openGallery() }]
      );
    }
  }, [overflowMode, saveMode]);

  const handleCreatureDone = useCallback(() => {
    capturableRef.current = false;
    setCreatureCapturable(false);
    setActiveCreature(null);
    if (tutorialStepRef.current === 0) scheduleNextCreature(); // チュートリアル中は自動スケジュールしない
  }, [scheduleNextCreature]);

  // チュートリアル完了
  const completeTutorial = useCallback(async () => {
    if (tutorialAutoShootRef.current) { clearTimeout(tutorialAutoShootRef.current); tutorialAutoShootRef.current = null; }
    capturableRef.current = false;
    setCreatureCapturable(false);
    setActiveCreature(null);
    tutorialStepRef.current = 0;
    setTutorialStep(0);
    try { await AsyncStorage.setItem(TUTORIAL_KEY, 'done'); } catch {}
    scheduleNextCreature();
  }, [scheduleNextCreature]);

  // チュートリアルスキップ
  const skipTutorial = useCallback(() => {
    if (tutorialAutoShootRef.current) { clearTimeout(tutorialAutoShootRef.current); tutorialAutoShootRef.current = null; }
    capturableRef.current = false;
    setCreatureCapturable(false);
    setActiveCreature(null);
    setGalleryVisible(false);
    setSettingsVisible(false);
    // アイテム入手前（step12未到達）にスキップ → 5枚目の撮影を強制特殊アイテムにする
    if (tutorialStepRef.current < 12) {
      skipForcedItemRef.current = 4; // 4枚撮影後に強制特殊アイテム出現 → 5枚目で撮影
      AsyncStorage.setItem(SKIP_FORCED_ITEM_KEY, '4').catch(() => {});
    }
    completeTutorial();
  }, [completeTutorial]);

  // チュートリアル次のステップへ進む
  const advanceTutorial = useCallback(() => {
    const step = tutorialStepRef.current;
    if (tutorialAutoShootRef.current) { clearTimeout(tutorialAutoShootRef.current); tutorialAutoShootRef.current = null; }

    const setStep = (n) => { tutorialStepRef.current = n; setTutorialStep(n); };

    if (step === 2) {
      // 次へ → 宇宙人をラージサイズで強制出現（fadein・一時停止）→ step 3
      // メッセージバブル（下半分）と重ならないよう上半分に固定
      clearTimeout(timerRef.current);
      const vp = { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H * 0.5, fullScreen: true };
      setActiveCreature({
        creature: { id: 'alien', emoji: '👽', size: TUTORIAL_CREATURE_SIZE },
        mode: 'fadein', edge: null, key: Date.now(), vp,
        isSpecial: false, pauseAfterCapturable: true,
      });
      setStep(3);
      // 10秒後に自動撮影（シャッターを押し忘れた場合のフォールバック）
      tutorialAutoShootRef.current = setTimeout(() => {
        if (tutorialStepRef.current === 3) takePictureRef.current?.();
      }, 10000);
    } else if (step === 4) {
      // 次へ → ギャラリーを自動オープン → step 5
      setStep(5);
      openGallery();
    } else if (step === 8) {
      // 次へ → ビューワーを閉じて一覧へ → step 9
      setStep(9);
      closeViewer();
    } else if (step === 10) {
      // 次へ → ギャラリーを強制クローズ → SE再生 → 1秒後にstep 11表示
      setGalleryVisible(false);
      setSelectedIndex(null); setPendingIndex(null);
      setViewerVisible(false); setSelectionMode(false); setSelectedPhotoIds({});
      playSERef.current?.(SE_ITEM_PREVIEW); // チャイムを即再生
      // tutorialStepRef は 10 のまま1秒待機（5〜10はギャラリー内表示なので主画面には出ない）
      setTimeout(() => { setStep(11); }, 1000);
    } else if (step === 11) {
      // 次へ → テーマアイテムをラージサイズで強制出現（SE はstep10移行時に再生済み）→ step 12
      // メッセージバブル（下半分）と重ならないよう上半分に固定
      clearTimeout(timerRef.current);
      const vp = { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H * 0.5, fullScreen: true };
      setActiveCreature({
        creature: { id: 'theme', emoji: '🎁', size: TUTORIAL_CREATURE_SIZE },
        mode: 'fadein', edge: null, key: Date.now(), vp,
        isSpecial: true, itemType: 'theme', itemLabel: t('item_theme'),
        pauseAfterCapturable: true,
      });
      setStep(12);
      // 10秒後に自動撮影（30秒から短縮）
      tutorialAutoShootRef.current = setTimeout(() => {
        if (tutorialStepRef.current === 12) takePictureRef.current?.();
      }, 10000);
    } else if (step === 14) {
      // 次へ → 設定を自動オープン → step 15
      setStep(15);
      setSettingsVisible(true);
    } else if (step === 15) {
      // 次へ → step 17へ（step 16は存在しない）
      setStep(17);
    } else if (step === 17) {
      // 次へ → 設定を自動クローズ → step 18
      setStep(18);
      setSettingsVisible(false);
    } else if (step === 18) {
      completeTutorial();
    } else {
      setStep(step + 1); // step 6, 7, 9 → そのままインクリメント
    }
  }, [completeTutorial, openGallery, closeViewer]);

  const takePicture = async () => {
    if (isTakingPictureRef.current || !cameraRef.current || compositing || saveMode === null) return;

    const isSpecialCapture = !!(activeCreature?.isSpecial && capturableRef.current);
    const hasHarmony = harmonyActiveRef.current && !isSpecialCapture;

    // 和気あいあい発動中は生き物なしでも撮影可能。それ以外は撮影可能状態が必要。
    if (!capturableRef.current && !hasHarmony) {
      playSE(SE_NO_CREATURE);
      Alert.alert(t('alert_no_creature_title'), t('alert_no_creature_body'));
      return;
    }

    // チュートリアル step3/12 中はシャッター押下時点でバブルを即時非表示（誤スキップ防止）
    if (tutorialStepRef.current === 3 || tutorialStepRef.current === 12) {
      setTutorialCapturing(true);
    }

    // 特殊アイテム撮影：写真保存なし・生き物を消去して直接効果を適用
    if (isSpecialCapture) {
      // スコープ発動中かつスコープのパワーアップ以外の場合は使用回数を消費
      if (scopeActiveRef.current) {
        scopeCountRef.current = Math.max(0, scopeCountRef.current - 1);
        if (scopeCountRef.current === 0) {
          setScopeActive(false);
          scopeActiveRef.current = false;
        }
      }
      capturableRef.current = false;
      setCreatureCapturable(false);
      setActiveCreature(null);
      // 天井補正カウンタをリセット
      pityCounterRef.current = 0;
      AsyncStorage.setItem(PITY_COUNTER_KEY, '0').catch(() => {});
      if (tutorialStepRef.current === 0) scheduleNextCreature(); // チュートリアル中はスケジュールしない
      const itype = activeCreature.itemType;
      if (itype === 'theme') {
        const locked = ALL_THEME_IDS.filter(id => !unlockedThemes.includes(id));
        if (locked.length > 0) {
          const newId = locked[Math.floor(Math.random() * locked.length)];
          const newUnlocked = [...unlockedThemes, newId];
          setUnlockedThemes(newUnlocked);
          const newCounts = { ...frameCountsRef.current };
          if ((newCounts[newId] ?? 0) < 5) newCounts[newId] = 5;
          setFrameCounts(newCounts);
          frameCountsRef.current = newCounts;
          persistSettings(theme, saveMode === 'album', frameEnabled, fullScreen, newUnlocked, newCounts, language);
          const label = t('theme_' + newId);
          playSE(SE_ITEM_THEME);
          // チュートリアル step12 の場合は OK 後に step14 へ進む
          if (tutorialStepRef.current === 12) {
            if (tutorialAutoShootRef.current) { clearTimeout(tutorialAutoShootRef.current); tutorialAutoShootRef.current = null; }
            Alert.alert(t('alert_theme_new_title'), t('alert_theme_new_body', { label }), [{
              text: t('btn_ok'), onPress: () => { setTutorialCapturing(false); tutorialStepRef.current = 14; setTutorialStep(14); }
            }]);
          } else {
            Alert.alert(t('alert_theme_new_title'), t('alert_theme_new_body', { label }));
          }
        } else {
          // 全テーマ取得済み → ランダムなテーマにフレーム+5を付与
          const targetId = unlockedThemes[Math.floor(Math.random() * unlockedThemes.length)];
          const newCount = Math.min(FRAME_MAX, (frameCountsRef.current[targetId] ?? 0) + 5);
          const newCounts = { ...frameCountsRef.current, [targetId]: newCount };
          setFrameCounts(newCounts);
          frameCountsRef.current = newCounts;
          persistSettings(theme, saveMode === 'album', frameEnabled, fullScreen, unlockedThemes, newCounts, language);
          const label = t('theme_' + targetId);
          playSE(SE_ITEM_FRAME);
          if (tutorialStepRef.current === 12) {
            if (tutorialAutoShootRef.current) { clearTimeout(tutorialAutoShootRef.current); tutorialAutoShootRef.current = null; }
            Alert.alert(t('alert_theme_all_title'), t('alert_theme_all_body', { label }), [{
              text: t('btn_ok'), onPress: () => { setTutorialCapturing(false); tutorialStepRef.current = 14; setTutorialStep(14); }
            }]);
          } else {
            Alert.alert(t('alert_theme_all_title'), t('alert_theme_all_body', { label }));
          }
        }
      } else if (itype === 'frame') {
        const newCount = Math.min(FRAME_MAX, (frameCountsRef.current[theme] ?? 0) + 5);
        const newCounts = { ...frameCountsRef.current, [theme]: newCount };
        setFrameCounts(newCounts);
        frameCountsRef.current = newCounts;
        persistSettings(theme, saveMode === 'album', frameEnabled, fullScreen, unlockedThemes, newCounts, language);
        playSE(SE_ITEM_FRAME);
        Alert.alert(t('alert_frame_plus_title'), t('alert_frame_plus_body', { count: newCount }));
      } else if (itype === 'harmony') {
        setHarmonyActive(true);
        harmonyActiveRef.current = true;
        playSE(SE_ITEM_HARMONY);
        Alert.alert(t('alert_harmony_title'), t('alert_harmony_body'));
      } else if (itype === 'scope') {
        setScopeActive(true);
        scopeActiveRef.current = true;
        scopeCountRef.current = 1;
        playSE(SE_ITEM_SCOPE);
        Alert.alert(t('alert_scope_title'), t('alert_scope_body'));
      }
      return;
    }

    isTakingPictureRef.current = true;

    const creatureSnapshot = (activeCreature && capturableRef.current)
      ? { creature: activeCreature.creature, pos: { ...creaturePosRef.current }, edge: activeCreature.edge }
      : null;

    // 和気あいあい：使用回数を消費し、4体分のポジションと生き物を生成
    let harmonyEntries = null;
    if (hasHarmony) {
      const HARM_SIZE = 60;
      playSE(SE_HARMONY_PHOTO);
      const positions = calculateHarmonyPositions(4, HARM_SIZE);
      harmonyEntries = positions.map(pos => ({ creature: pickCreature(theme), pos }));
      harmonyActiveRef.current = false;
      setHarmonyActive(false);
    }

    // スコープが発動中かどうかを記録（通常生き物撮影時のみ消費）
    const wasScope = scopeActiveRef.current && !!creatureSnapshot && !isSpecialCapture;

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      const frameSource = (frameEnabled && (frameCountsRef.current[theme] ?? 0) > 0)
        ? (THEME_FRAMES[theme] ?? null) : null;
      setCompositing({ photoUri: photo.uri, creatureSnapshot, frameSource, usedFrameTheme: frameSource ? theme : null, harmonyEntries, wasScope, fullScreen });
    } catch (e) {
      isTakingPictureRef.current = false;
      Alert.alert(t('alert_photo_error_title'), t('alert_photo_error_body'));
    }
  };

  useEffect(() => {
    if (!compositing || !compositeRef.current) return;
    const run = async () => {
      try {
        await new Promise(r => setTimeout(r, 100));
        if (compositing.frameSource) {
          // フレーム画像のonLoadを待つ（最大3秒）
          await Promise.race([
            new Promise(r => { frameLoadResolveRef.current = r; }),
            new Promise(r => setTimeout(r, 3000)),
          ]);
        }
        const uri = await captureRef(compositeRef, { format: 'jpg', quality: 0.9 });
        await savePicture(uri);

        // フレームを使った場合は残り回数を -1
        if (compositing.usedFrameTheme) {
          const tid = compositing.usedFrameTheme;
          const newCounts = {
            ...frameCountsRef.current,
            [tid]: Math.max(0, (frameCountsRef.current[tid] ?? 0) - 1),
          };
          setFrameCounts(newCounts);
          frameCountsRef.current = newCounts;
          persistSettings(theme, saveMode === 'album', frameEnabled, fullScreen, unlockedThemes, newCounts, language);
        }

        // スコープ消費（通常生き物撮影時のみ）
        if (compositing.wasScope) {
          scopeCountRef.current = Math.max(0, scopeCountRef.current - 1);
          if (scopeCountRef.current === 0) {
            setScopeActive(false);
            scopeActiveRef.current = false;
          }
        }

        setSuccessPhoto(uri);
        Alert.alert(t('alert_photo_saved_title'), t('alert_photo_saved_body'), [
          { text: t('btn_ok'), onPress: async () => {
            isTakingPictureRef.current = false;
            setSuccessPhoto(null);
            setCompositing(null);
            // 撮影後：現在の生き物を即クリアしてシャッフル（連続同生き物防止）
            clearTimeout(timerRef.current);
            capturableRef.current = false;
            setCreatureCapturable(false);
            setActiveCreature(null);
            if (tutorialStepRef.current === 3) {
              // チュートリアル step3：撮影完了 → step4 へ進む
              setTutorialCapturing(false);
              tutorialStepRef.current = 4;
              setTutorialStep(4);
              return;
            }
            // チュートリアルスキップ後の強制特殊アイテムカウンタ更新
            if (skipForcedItemRef.current > 0) {
              skipForcedItemRef.current -= 1;
              AsyncStorage.setItem(SKIP_FORCED_ITEM_KEY, String(skipForcedItemRef.current)).catch(() => {});
              if (skipForcedItemRef.current === 0) forceNextSpecialItemRef.current = true;
            }
            // 天井補正カウンタ更新（通常撮影のたびにインクリメント）
            pityCounterRef.current += 1;
            AsyncStorage.setItem(PITY_COUNTER_KEY, String(pityCounterRef.current)).catch(() => {});
            scheduleNextCreatureRef.current?.();

            // 上限チェック＆自動削除（アルバムモードのみ・「写真が撮れた」OK後に実行）
            if (saveModeRef.current !== 'album') return;
            let isOverLimit = false;
            try {
              const album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
              if (album) {
                const result = await MediaLibrary.getAssetsAsync({
                  album,
                  mediaType: MediaLibrary.MediaType.photo,
                  sortBy: MediaLibrary.SortBy.creationTime,
                  first: PHOTO_LIMIT + 5,
                });
                if (result.assets.length > PHOTO_LIMIT) {
                  if (autoDeleteRef.current) {
                    // 自動削除：deleteAssetsAsync はキャンセル時に例外を投げるため個別にtry/catch
                    let deleteSucceeded = false;
                    const candidates = autoDeleteTargetRef.current === 'newest'
                      ? [...result.assets]
                      : [...result.assets].reverse();
                    const target = candidates.find(a => !savedPhotoIdsRef.current[a.id]);
                    if (target) {
                      try {
                        await MediaLibrary.deleteAssetsAsync([target]);
                        deleteSucceeded = true;
                      } catch {
                        deleteSucceeded = false;
                      }
                    }
                    if (deleteSucceeded) {
                      const recheck = await MediaLibrary.getAssetsAsync({
                        album, mediaType: MediaLibrary.MediaType.photo, first: PHOTO_LIMIT + 1,
                      });
                      isOverLimit = recheck.assets.length > PHOTO_LIMIT;
                    } else {
                      isOverLimit = true;
                    }
                  } else {
                    isOverLimit = true;
                  }
                }
              }
            } catch { /* 上限チェック失敗は無視 */ }

            if (isOverLimit) {
              skipOverflowAlertRef.current = true;
              setOverflowMode(true);
              overflowModeRef.current = true;
              setTimeout(() => {
                Alert.alert(
                  t('alert_album_full_title'),
                  t('alert_album_full_body1', { limit: PHOTO_LIMIT }),
                  [{ text: t('btn_ok'), onPress: () => openGallery() }]
                );
              }, 150);
            }
          }},
        ]);
      } catch (e) {
        isTakingPictureRef.current = false;
        Alert.alert(t('alert_photo_error_title'), t('alert_save_error_body', { msg: e.message }));
        setCompositing(null);
      }
    };
    run();
  }, [compositing]);

  const openGallery = async () => {
    if (saveMode === 'none') {
      Alert.alert(t('alert_no_perm_title'));
      return;
    }
    try {
      let assets;
      if (saveMode === 'album') {
        // CreatureCameraアルバムの写真のみ表示
        const album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
        if (!album) {
          Alert.alert(t('alert_no_photos_title'), t('alert_no_photos_body'));
          return;
        }
        const result = await MediaLibrary.getAssetsAsync({
          album,
          sortBy: MediaLibrary.SortBy.creationTime,
          mediaType: MediaLibrary.MediaType.photo,
          first: overflowModeRef.current ? OVERFLOW_LIMIT : PHOTO_LIMIT,
        });
        assets = result.assets;
      } else {
        // defaultモード：カメラロール全体を表示
        const result = await MediaLibrary.getAssetsAsync({
          sortBy: MediaLibrary.SortBy.creationTime,
          mediaType: MediaLibrary.MediaType.photo,
          first: overflowModeRef.current ? OVERFLOW_LIMIT : PHOTO_LIMIT,
        });
        assets = result.assets;
      }

      // ph:// URIはImageで表示できないため localUri（file://）を取得する
      // localUriがnullの写真は除外する
      const assetsWithLocalUri = (await Promise.all(
        assets.map(async (asset) => {
          try {
            const info = await MediaLibrary.getAssetInfoAsync(asset);
            if (!info.localUri) return null;
            return { id: asset.id, uri: info.localUri };
          } catch {
            return null;
          }
        })
      )).filter(Boolean);

      if (assetsWithLocalUri.length === 0) {
        Alert.alert(t('alert_no_viewable_title'), t('alert_no_viewable_body'));
        return;
      }
      setGalleryAssets(assetsWithLocalUri);
      gallerySlideY.setValue(SCREEN_H);
      galleryOpacity.setValue(0);
      setGalleryVisible(true);
      // Modal が描画された後にアニメーション開始
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(gallerySlideY, { toValue: 0,   duration: 280, useNativeDriver: true }),
          Animated.timing(galleryOpacity, { toValue: 1,  duration: 200, useNativeDriver: true }),
        ]).start();
      }, 30);
    } catch (e) {
      Alert.alert(t('alert_gallery_error_title'), t('alert_gallery_error_body', { msg: e.message }));
    }
  };

  // ギャラリーを閉じるアニメーション（上スライド＋フェードアウト）
  const closeGallery = useCallback(() => {
    // 超過モード中（アルバムモードのみ）は、まだ上限超過していれば閉じない
    if (saveModeRef.current === 'album' && overflowModeRef.current && galleryCountRef.current > PHOTO_LIMIT) {
      Alert.alert(
        t('alert_album_full_title'),
        t('alert_album_full_body2', { limit: PHOTO_LIMIT, over: galleryCountRef.current - PHOTO_LIMIT }),
        [{ text: t('btn_ok') }]
      );
      return;
    }
    // 超過モードを解除してから閉じる
    if (overflowModeRef.current) {
      setOverflowMode(false);
      overflowModeRef.current = false;
    }
    Animated.parallel([
      Animated.timing(gallerySlideY,  { toValue: -SCREEN_H * 0.35, duration: 300, useNativeDriver: true }),
      Animated.timing(galleryOpacity, { toValue: 0,                 duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setGalleryVisible(false);
      setSelectedIndex(null);
      setPendingIndex(null);
      setViewerVisible(false);
      setSelectionMode(false);
      setSelectedPhotoIds({});
      selectedPhotoIdsRef.current = {};
    });
  }, []);

  // フォトビューワーを閉じるアニメーション（上スライド＋フェードアウト）
  const closeViewer = useCallback(() => {
    Animated.parallel([
      Animated.timing(viewerSlideY,  { toValue: -SCREEN_H * 0.35, duration: 300, useNativeDriver: true }),
      Animated.timing(viewerOpacity, { toValue: 0,                  duration: 300, useNativeDriver: true }),
    ]).start(() => {
      // アニメーション完了：ビューワーは opacity=0 で不可視のまま維持。
      // setValue によるリセットは openViewer 側でのみ行う。
      // ここで setValue(1) を呼ぶと React のアンマウントより先にネイティブ側が
      // 更新されてフラッシュするため、絶対に呼ばない。
      setTimeout(() => {
        setViewerVisible(false);
        setSelectedIndex(null);
        setPendingIndex(null);
      }, 15);
    });
  }, []);

  // SE再生（seEnabled=trueの時のみ）
  const playSE = useCallback(async (source) => {
    if (!seEnabledRef.current) return;
    try {
      const { sound } = await Audio.Sound.createAsync(source);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) sound.unloadAsync();
      });
    } catch {}
  }, []);

  // SE有効化時専用：seEnabledRefに関わらず再生（OFF→ON切替時のフィードバック用）
  const playRawSE = useCallback(async (source) => {
    try {
      const { sound } = await Audio.Sound.createAsync(source);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) sound.unloadAsync();
      });
    } catch {}
  }, []);

  // BGM管理：bgmEnabled またはテーマが変わるたびに差し替え
  useEffect(() => {
    let mounted = true;
    const setupBGM = async () => {
      // 既存BGMを意図的に停止
      bgmIntentionalStopRef.current = true;
      if (bgmSoundRef.current) {
        await bgmSoundRef.current.stopAsync().catch(() => {});
        await bgmSoundRef.current.unloadAsync().catch(() => {});
        bgmSoundRef.current = null;
      }
      const source = THEME_BGM[theme] ?? null;
      if (!bgmEnabled || !source) return;
      try {
        bgmIntentionalStopRef.current = false;
        const { sound } = await Audio.Sound.createAsync(source, { isLooping: true, shouldPlay: true });
        if (!mounted) { sound.unloadAsync(); return; }
        bgmSoundRef.current = sound;
        // カメラシャッターなどで予期せず停止した場合に自動再開
        sound.setOnPlaybackStatusUpdate((status) => {
          if (
            status.isLoaded &&
            !status.isPlaying &&
            !status.didJustFinish &&
            !bgmIntentionalStopRef.current &&
            bgmEnabledRef.current
          ) {
            sound.playAsync().catch(() => {});
          }
        });
      } catch {}
    };
    setupBGM();
    return () => {
      mounted = false;
      bgmIntentionalStopRef.current = true;
      if (bgmSoundRef.current) {
        bgmSoundRef.current.stopAsync().catch(() => {});
        bgmSoundRef.current.unloadAsync().catch(() => {});
        bgmSoundRef.current = null;
      }
    };
  }, [bgmEnabled, theme]);

  // refを常に最新値に同期
  selectedIndexRef.current    = selectedIndex;
  galleryCountRef.current     = galleryAssets.length;
  primarySlotRef.current      = primarySlot;
  frameCountsRef.current      = frameCounts;
  selectedPhotoIdsRef.current = selectedPhotoIds;
  savedPhotoIdsRef.current    = savedPhotoIds;
  overflowModeRef.current     = overflowMode;
  saveModeRef.current         = saveMode;
  harmonyActiveRef.current        = harmonyActive;
  scopeActiveRef.current          = scopeActive;
  autoDeleteRef.current           = autoDelete;
  autoDeleteTargetRef.current     = autoDeleteTarget;
  bgmEnabledRef.current           = bgmEnabled;
  seEnabledRef.current            = seEnabled;
  _langRef.current                = language; // レンダー毎に最新の言語を同期
  scheduleNextCreatureRef.current = scheduleNextCreature;
  takePictureRef.current = takePicture;
  playSERef.current      = playSE;

  // ギャラリーから写真を開く（スロットを初期化）
  const openViewer = (index) => {
    primarySlotRef.current = 0;
    setPrimarySlot(0);
    slotX[0].setValue(0);
    slotX[1].setValue(0);
    viewerSlideY.setValue(0);
    viewerOpacity.setValue(1);
    setSelectedIndex(index);
    setPendingIndex(null);
    setViewerVisible(true);
  };

  // グリッドのタップ処理（選択モードか通常かで分岐）
  const handlePhotoTap = (item, index) => {
    if (selectionMode) {
      setSelectedPhotoIds(prev => {
        const next = { ...prev };
        if (next[item.id]) delete next[item.id];
        else next[item.id] = true;
        return next;
      });
    } else {
      openViewer(index);
      // チュートリアル step5：写真タップ → step6 へ進む
      if (tutorialStepRef.current === 5) { tutorialStepRef.current = 6; setTutorialStep(6); }
    }
  };

  // アニメーション付き画像切り替え
  // direction: 1 = 右スワイプ（次）, -1 = 左スワイプ（前）
  triggerTransitionRef.current = (newIndex, direction) => {
    if (isViewerAnimatingRef.current) return;
    isViewerAnimatingRef.current = true;

    const primary   = primarySlotRef.current;
    const secondary = 1 - primary;
    const exitX     =  direction * SCREEN_W;  // primary が出て行く方向
    const enterX    = -direction * SCREEN_W;  // secondary が入ってくる位置

    // secondary スロットを画面外に配置してから次の画像をセット
    slotX[secondary].setValue(enterX);
    setPendingIndex(newIndex);

    // 2枚を同時にスライド
    Animated.parallel([
      Animated.timing(slotX[primary],   { toValue: exitX, duration: 300, useNativeDriver: true }),
      Animated.timing(slotX[secondary], { toValue: 0,     duration: 300, useNativeDriver: true }),
    ]).start(() => {
      // secondary が新しい primary になる（Animated.Value は移動済みのまま流用）
      primarySlotRef.current = secondary;
      setPrimarySlot(secondary);
      setSelectedIndex(newIndex);
      setPendingIndex(null);
      isViewerAnimatingRef.current = false;
    });
  };

  const photoViewerPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderTerminationRequest: () => false,
      // 指の追従なし（上スワイプと同じく離した後に判定）
      onPanResponderMove: () => {},
      onPanResponderRelease: (_, { dx, dy, vx, vy }) => {
        if (isViewerAnimatingRef.current) return;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        // 上スワイプ → 一覧に戻る
        if (absDy > absDx && (dy < -50 || vy < -0.5)) {
          closeViewer();
          return;
        }
        // 左スワイプ → 次（方向を逆転）
        if (dx < -50 || vx < -0.5) {
          const next = selectedIndexRef.current + 1;
          if (next < galleryCountRef.current) {
            triggerTransitionRef.current(next, -1);
            return;
          }
        }
        // 右スワイプ → 前（方向を逆転）
        if (dx > 50 || vx > 0.5) {
          const prev = selectedIndexRef.current - 1;
          if (prev >= 0) {
            triggerTransitionRef.current(prev, 1);
            return;
          }
        }
      },
    })
  ).current;

  // フォトビューワー：現在の1枚を削除
  const handleViewerDelete = () => {
    const item = galleryAssets[selectedIndexRef.current];
    if (!item) return;
    if (savedPhotoIdsRef.current[item.id]) {
      playSE(SE_NO_CREATURE);
      Alert.alert(t('alert_delete_protected_title'), t('alert_delete_protected_body'));
      return;
    }
    Alert.alert(t('alert_delete_confirm_title'), t('alert_delete_confirm_body'), [
      { text: t('btn_cancel'), style: 'cancel' },
      { text: t('btn_delete'), style: 'destructive', onPress: async () => {
        playSE(SE_DELETE);
        try { await MediaLibrary.deleteAssetsAsync([item.id]); } catch {}
        closeViewer();
        await reloadGallery();
      }},
    ]);
  };

  // フォトビューワー：現在の1枚を保護/保護解除
  const handleViewerProtectToggle = () => {
    const item = galleryAssets[selectedIndexRef.current];
    if (!item) return;
    const isProtected = savedPhotoIdsRef.current[item.id];
    if (isProtected) {
      Alert.alert(t('alert_unprotect_confirm_title'), t('alert_unprotect_confirm_body'), [
        { text: t('btn_cancel'), style: 'cancel' },
        { text: t('btn_yes'), onPress: async () => {
          playSE(SE_BUTTON01A);
          const newSaved = { ...savedPhotoIdsRef.current };
          delete newSaved[item.id];
          setSavedPhotoIds(newSaved);
          savedPhotoIdsRef.current = newSaved;
          await persistSavedPhotoIds(newSaved);
        }},
      ]);
    } else {
      const currentCount = Object.keys(savedPhotoIdsRef.current).length;
      if (currentCount >= PROTECT_LIMIT) {
        Alert.alert(t('alert_protect_limit_title'), t('alert_protect_limit_body', { limit: PROTECT_LIMIT }));
        return;
      }
      Alert.alert(t('alert_protect_confirm_title'), t('alert_protect_confirm_body'), [
        { text: t('btn_cancel'), style: 'cancel' },
        { text: t('btn_yes'), onPress: async () => {
          playSE(SE_BUTTON01A);
          const newSaved = { ...savedPhotoIdsRef.current, [item.id]: true };
          setSavedPhotoIds(newSaved);
          savedPhotoIdsRef.current = newSaved;
          await persistSavedPhotoIds(newSaved);
        }},
      ]);
    }
  };

  // テーマ変更（タイマー・生き物をリセットして設定を保存）
  const handleThemeChange = (id) => {
    clearTimeout(timerRef.current);
    capturableRef.current = false;
    setActiveCreature(null);
    setTheme(id);
    persistSettings(id, saveMode === 'album', frameEnabled, fullScreen, unlockedThemes, frameCounts, language);
  };

  // 言語変更
  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    _langRef.current = lang; // 即時同期（Alert等のstale closure対策）
    persistSettings(theme, saveMode === 'album', frameEnabled, fullScreen, unlockedThemes, frameCountsRef.current, lang);
  };

  // テーマ削除（取得フラグをOFF）
  const handleThemeDelete = (id) => {
    const label = t('theme_' + id);
    Alert.alert(
      t('alert_theme_delete_title'),
      t('alert_theme_delete_body', { label }),
      [
        { text: t('btn_cancel'), style: 'cancel' },
        { text: t('btn_delete'), style: 'destructive', onPress: () => {
          playSE(SE_DELETE);
          const newUnlocked = unlockedThemes.filter(tid => tid !== id);
          setUnlockedThemes(newUnlocked);
          // フレーム残り回数もクリア
          const newCounts = { ...frameCounts, [id]: 0 };
          setFrameCounts(newCounts);
          frameCountsRef.current = newCounts;
          const newTheme = theme === id ? 'default' : theme;
          if (theme === id) {
            clearTimeout(timerRef.current);
            capturableRef.current = false;
            setActiveCreature(null);
            setTheme('default');
          }
          persistSettings(newTheme, saveMode === 'album', frameEnabled, fullScreen, newUnlocked, newCounts, language);
        }},
      ]
    );
  };

  // フレームのトグル処理
  const handleFrameToggle = (value) => {
    playSE(value ? SE_SWITCH_ON : SE_SWITCH_OFF);
    if (value) {
      // OFF→ON：全テーマの残り回数がすべて0なら確認ダイアログ
      const allZero = Object.values(frameCounts).every(n => (n ?? 0) === 0);
      if (allZero) {
        Alert.alert(
          'フレームの残りがありません',
          'フレームを取得した場合に、自動でフレームを表示します\nよろしいですか？',
          [
            { text: 'キャンセル', style: 'cancel' },
            { text: 'OK', onPress: () => {
              setFrameEnabled(true);
              persistSettings(theme, saveMode === 'album', true, fullScreen, unlockedThemes, frameCounts, language);
            }},
          ]
        );
        return;
      }
    }
    setFrameEnabled(value);
    persistSettings(theme, saveMode === 'album', value, fullScreen, unlockedThemes, frameCounts, language);
  };

  // 全画面トグル処理
  const handleFullScreenToggle = (value) => {
    // カメラフレームON（=fullScreen OFF）→ SE_SWITCH_ON、カメラフレームOFF（=fullScreen ON）→ SE_SWITCH_OFF
    playSE(value ? SE_SWITCH_OFF : SE_SWITCH_ON);
    setFullScreen(value);
    persistSettings(theme, saveMode === 'album', frameEnabled, value, unlockedThemes, frameCounts, language);
  };


  // アルバムモードのトグル処理
  const handleAlbumModeToggle = async (value) => {
    playSE(value ? SE_SWITCH_ON : SE_SWITCH_OFF);
    if (!value) {
      // ON→OFF：確認なしで即切替・保存
      setSaveMode('default');
      persistSettings(theme, false, frameEnabled, fullScreen, unlockedThemes, frameCounts, language);
      return;
    }

    // OFF→ON：条件1・条件2を実際に試して確認
    // 条件1: アルバムが存在する
    // 条件2: アルバム内の写真が表示できる（APIが成功する）
    let canUseAlbum = false;
    try {
      const album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
      if (album) {
        await MediaLibrary.getAssetsAsync({
          album,
          first: 1,
          mediaType: MediaLibrary.MediaType.photo,
        });
        canUseAlbum = true;
      }
    } catch {
      canUseAlbum = false;
    }

    if (canUseAlbum) {
      setSaveMode('album');
      persistSettings(theme, true, frameEnabled, fullScreen, unlockedThemes, frameCounts, language);
    } else {
      Alert.alert(
        t('alert_perm_needed_title'),
        t('alert_perm_needed_body'),
        [{ text: t('btn_cancel'), style: 'cancel' }]
      );
    }
  };

  // 選択モードの開始・終了
  const enterSelectionMode = () => {
    playSE(SE_OPEN_CABINET);
    setSelectionMode(true);
    setSelectedPhotoIds({});
    selectedPhotoIdsRef.current = {};
  };
  const exitSelectionMode = () => {
    playSE(SE_CLOSE_CABINET);
    setSelectionMode(false);
    setSelectedPhotoIds({});
    selectedPhotoIdsRef.current = {};
  };

  // 削除アクション（保存済みチェック付き）
  const handleDeleteAction = () => {
    const selectedIds = Object.keys(selectedPhotoIdsRef.current);
    if (selectedIds.length === 0) return;
    const savedIds = savedPhotoIdsRef.current;
    const hasSaved = selectedIds.some(id => savedIds[id]);
    if (hasSaved) {
      playSE(SE_NO_CREATURE);
      Alert.alert(
        t('alert_delete_protected_title'),
        t('alert_delete_protected_multi'),
        [{ text: t('btn_ok') }]
      );
      return;
    }
    Alert.alert(
      t('alert_delete_confirm_title'),
      t('alert_delete_multi_body', { count: selectedIds.length }),
      [
        { text: t('btn_cancel'), style: 'cancel' },
        { text: t('btn_delete'), style: 'destructive', onPress: executeDelete },
      ]
    );
  };

  const executeDelete = async () => {
    const selectedIds = Object.keys(selectedPhotoIdsRef.current);
    try {
      await MediaLibrary.deleteAssetsAsync(selectedIds);
    } catch {}
    playSE(SE_DELETE);
    exitSelectionMode();
    // ギャラリーを再読み込み
    await reloadGallery();
  };

  // 保護アクション
  const handleProtectAction = () => {
    const selectedIds = Object.keys(selectedPhotoIdsRef.current);
    if (selectedIds.length === 0) return;
    playSE(SE_BUTTON01A);
    // 新たに保護される枚数（すでに保護済みは除く）
    const newlyProtected = selectedIds.filter(id => !savedPhotoIdsRef.current[id]);
    const currentCount   = Object.keys(savedPhotoIdsRef.current).length;
    if (currentCount + newlyProtected.length > PROTECT_LIMIT) {
      Alert.alert(
        t('alert_protect_limit_title'),
        t('alert_protect_limit_multi_body', { limit: PROTECT_LIMIT }),
        [
          { text: t('btn_cancel'), style: 'cancel' },
          { text: t('btn_yes'), onPress: exitSelectionMode },
        ]
      );
      return;
    }
    Alert.alert(
      t('alert_protect_confirm_title'),
      t('alert_protect_multi_body', { count: selectedIds.length }),
      [
        { text: t('btn_cancel'), style: 'cancel' },
        { text: t('btn_yes'), onPress: executeProtect },
      ]
    );
  };

  const executeProtect = async () => {
    const selectedIds = Object.keys(selectedPhotoIdsRef.current);
    const newSaved = { ...savedPhotoIdsRef.current };
    selectedIds.forEach(id => { newSaved[id] = true; });
    setSavedPhotoIds(newSaved);
    savedPhotoIdsRef.current = newSaved;
    await persistSavedPhotoIds(newSaved);
    exitSelectionMode();
  };

  // 保護解除アクション
  const handleUnprotectAction = () => {
    const selectedIds = Object.keys(selectedPhotoIdsRef.current);
    if (selectedIds.length === 0) return;
    const hasProtected = selectedIds.some(id => savedPhotoIdsRef.current[id]);
    if (!hasProtected) return;
    playSE(SE_BUTTON01A);
    Alert.alert(
      t('alert_unprotect_confirm_title'),
      t('alert_unprotect_multi_body'),
      [
        { text: t('btn_cancel'), style: 'cancel' },
        { text: t('btn_yes'), onPress: executeUnprotect },
      ]
    );
  };

  const executeUnprotect = async () => {
    const selectedIds = Object.keys(selectedPhotoIdsRef.current);
    const newSaved = { ...savedPhotoIdsRef.current };
    selectedIds.forEach(id => { delete newSaved[id]; });
    setSavedPhotoIds(newSaved);
    savedPhotoIdsRef.current = newSaved;
    await persistSavedPhotoIds(newSaved);
    exitSelectionMode();
  };

  // ギャラリー再読み込み（削除後に呼ぶ）
  const reloadGallery = async () => {
    try {
      let assets;
      const fetchLimit = overflowModeRef.current ? OVERFLOW_LIMIT : PHOTO_LIMIT;
      if (saveMode === 'album') {
        const album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
        if (!album) { setGalleryAssets([]); return; }
        const result = await MediaLibrary.getAssetsAsync({
          album,
          sortBy: MediaLibrary.SortBy.creationTime,
          mediaType: MediaLibrary.MediaType.photo,
          first: fetchLimit,
        });
        assets = result.assets;
      } else {
        const result = await MediaLibrary.getAssetsAsync({
          sortBy: MediaLibrary.SortBy.creationTime,
          mediaType: MediaLibrary.MediaType.photo,
          first: fetchLimit,
        });
        assets = result.assets;
      }
      const assetsWithLocalUri = (await Promise.all(
        assets.map(async (asset) => {
          try {
            const info = await MediaLibrary.getAssetInfoAsync(asset);
            if (!info.localUri) return null;
            return { id: asset.id, uri: info.localUri };
          } catch { return null; }
        })
      )).filter(Boolean);
      setGalleryAssets(assetsWithLocalUri);
    } catch {}
  };

  if (!cameraPermission) return <View style={styles.center} />;

  if (!cameraPermission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>{t('perm_text')}</Text>
        <TouchableOpacity style={styles.btn} onPress={requestCameraPermission}>
          <Text style={styles.btnText}>{t('perm_btn')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 共通のExitボタン押下ハンドラ
  const onExitPress = () =>
    Alert.alert(
      'アプリの終了方法',
      '画面下からスワイプアップして終了できます。\n\n設定ファイルをリセットしたい場合は「リセット」を押してください。次回起動時に初期設定から始まります。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'リセット', style: 'destructive', onPress: async () => {
          try {
            await AsyncStorage.removeItem(SETTINGS_KEY);
            Alert.alert('リセット完了', '設定ファイルを削除しました。');
          } catch {
            Alert.alert('エラー', '設定ファイルの削除に失敗しました。');
          }
        }},
      ]
    );

  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden />

      {/* ── カメラ映像 ── */}
      {fullScreen ? (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      ) : (
        // フレームモード：上80%のみ
        <View style={{ position: 'absolute', top: 0, left: 0, width: SCREEN_W, height: CAMERA_AREA_H }}>
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        </View>
      )}
      {/* カメラファインダーフレームオーバーレイ（生き物より前面・コンポジット中は非表示）
          常時マウントしてopacityで制御（全画面←→フレーム切替時のフラッシュ防止） */}
      <Image
        source={CAMERA_FINDER}
        style={{ position: 'absolute', top: 20, left: 10, width: SCREEN_W - 20, height: CAMERA_AREA_H - 20, zIndex: 20, opacity: (!fullScreen && !compositing) ? 1 : 0 }}
        resizeMode="stretch"
        pointerEvents="none"
      />

      {/* ── 生き物オーバーレイ ── */}
      {activeCreature && !compositing && !successPhoto && (
        <CreatureOverlay
          key={activeCreature.key}
          creature={activeCreature.creature}
          mode={activeCreature.mode}
          edge={activeCreature.edge}
          vp={activeCreature.vp}
          onDone={handleCreatureDone}
          posRef={creaturePosRef}
          onFinalPos={(pos) => { creatureFinalPosRef.current = pos; }}
          isSpecial={activeCreature.isSpecial}
          itemLabel={activeCreature.itemLabel}
          pauseAfterCapturable={activeCreature.pauseAfterCapturable}
          onCapturable={() => { capturableRef.current = true; setCreatureCapturable(true); }}
          onUncapturable={() => { capturableRef.current = false; setCreatureCapturable(false); }}
        />
      )}

      {/* ── スコープオーバーレイ ── */}
      {scopeActive && !compositing && !successPhoto && (
        <ScopeOverlay
          key={activeCreature ? `scope-${activeCreature.key}` : 'scope-idle'}
          posRef={creaturePosRef}
          creatureSize={activeCreature?.creature?.size ?? 0}
          finalPosRef={creatureFinalPosRef}
          creatureActive={!!activeCreature}
          capturable={creatureCapturable}
          onAnimComplete={() => {}}
          fullScreen={fullScreen}
        />
      )}

      {compositing && (
        <View ref={compositeRef} style={StyleSheet.absoluteFill} collapsable={false}>
          {(() => {
            // 非fullScreenモード：カメラプレビュー高さ(CAMERA_AREA_H)と合成高さ(SCREEN_H)のスケール差で
            // 生き物のY座標を補正する（写真は全画面表示のままにして白帯を防ぐ）
            const yScale = compositing.fullScreen ? 1 : SCREEN_H / CAMERA_AREA_H;
            const adjTop  = (top)  => top  * yScale;
            return compositing.frameSource ? (
            <>
              {/* 写真＋生き物をフルサイズで配置 */}
              <View style={StyleSheet.absoluteFill}>
                <Image source={{ uri: compositing.photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                {compositing.creatureSnapshot && (
                  <View style={[styles.creature, {
                    top:  adjTop(compositing.creatureSnapshot.pos.top),
                    left: compositing.creatureSnapshot.pos.left,
                    transform: compositing.creatureSnapshot.edge === 'left' ? [{ scaleX: -1 }] : [],
                  }]}>
                    <Text style={{ fontSize: compositing.creatureSnapshot.creature.size * 0.8 }}>
                      {compositing.creatureSnapshot.creature.emoji}
                    </Text>
                  </View>
                )}
                {compositing.harmonyEntries && compositing.harmonyEntries.map((entry, i) => (
                  <View key={`hf${i}`} style={[styles.creature, {
                    top:  adjTop(entry.pos.top),
                    left: entry.pos.left,
                  }]}>
                    <Text style={{ fontSize: entry.creature.size * 0.8 }}>{entry.creature.emoji}</Text>
                  </View>
                ))}
              </View>
              {/* フレームを最前面にフルサイズで配置 */}
              <Image
                source={compositing.frameSource}
                style={{ position: 'absolute', top: 0, left: 0, width: SCREEN_W, height: SCREEN_H }}
                resizeMode="stretch"
                onLoad={() => { frameLoadResolveRef.current?.(); }}
              />
            </>
          ) : (
            <>
              <Image source={{ uri: compositing.photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              {compositing.creatureSnapshot && (
                <View style={[styles.creature, {
                  top:  adjTop(compositing.creatureSnapshot.pos.top),
                  left: compositing.creatureSnapshot.pos.left,
                  transform: compositing.creatureSnapshot.edge === 'left' ? [{ scaleX: -1 }] : [],
                }]}>
                  <Text style={{ fontSize: compositing.creatureSnapshot.creature.size * 0.8 }}>
                    {compositing.creatureSnapshot.creature.emoji}
                  </Text>
                </View>
              )}
              {compositing.harmonyEntries && compositing.harmonyEntries.map((entry, i) => (
                <View key={`h${i}`} style={[styles.creature, { top: adjTop(entry.pos.top), left: entry.pos.left }]}>
                  <Text style={{ fontSize: entry.creature.size * 0.8 }}>{entry.creature.emoji}</Text>
                </View>
              ))}
            </>
          );
          })()}
        </View>
      )}

      {successPhoto && (
        <Image source={{ uri: successPhoto }} style={StyleSheet.absoluteFill} resizeMode="contain" />
      )}

      {!compositing && (
        fullScreen ? (
          // ── 全画面モードのUI（従来通り）──
          <>
            {/* <TouchableOpacity style={styles.exitBtn} onPress={onExitPress}>
              <Text style={styles.exitText}>✕</Text>
            </TouchableOpacity> */}
            <View style={styles.shutterArea}>
              <TouchableOpacity
                style={[styles.shutterBtn, tutorialStep > 0 && tutorialStep !== 3 && tutorialStep !== 12 && { opacity: 0.3 }]}
                onPress={takePicture}
                disabled={tutorialStep > 0 && tutorialStep !== 3 && tutorialStep !== 12}
              >
                <View style={styles.shutterInner} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.galleryBtn, tutorialStep > 0 && tutorialStep !== 4 && { opacity: 0.3 }, tutorialStep === 4 && { borderColor: '#4CD964', borderWidth: 3 }]}
              onPress={tutorialStep === 4 ? advanceTutorial : openGallery}
              disabled={tutorialStep > 0 && tutorialStep !== 4}
            >
              <Text style={styles.galleryIcon}>🖼️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.settingsBtn, tutorialStep > 0 && tutorialStep !== 14 && { opacity: 0.3 }, tutorialStep === 14 && { borderColor: '#4CD964', borderWidth: 3 }]}
              onPress={tutorialStep === 14 ? advanceTutorial : () => setSettingsVisible(true)}
              disabled={tutorialStep > 0 && tutorialStep !== 14}
            >
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
          </>
        ) : (
          // ── フレームモードのUI（下部パネル）──
          <>
            {/* カメラエリア内の✕ボタン（本番用一時非表示） */}
            {/* <TouchableOpacity style={styles.exitBtn} onPress={onExitPress}>
              <Text style={styles.exitText}>✕</Text>
            </TouchableOpacity> */}
            {/* 下部コントロールパネル */}
            <View style={styles.controlPanel}>
              {/* ギャラリー（左） */}
              <TouchableOpacity
                style={[styles.panelIconBtn, tutorialStep > 0 && tutorialStep !== 4 && { opacity: 0.3 }, tutorialStep === 4 && { borderRadius: 8, borderWidth: 2, borderColor: '#4CD964' }]}
                onPress={tutorialStep === 4 ? advanceTutorial : openGallery}
                disabled={tutorialStep > 0 && tutorialStep !== 4}
              >
                <Text style={styles.panelIconText}>🖼️</Text>
                <Text style={styles.panelLabel}>{t('panel_gallery')}</Text>
              </TouchableOpacity>
              {/* シャッター（中央） */}
              <TouchableOpacity
                style={[styles.panelShutterBtn, tutorialStep > 0 && tutorialStep !== 3 && tutorialStep !== 12 && { opacity: 0.3 }]}
                onPress={takePicture}
                disabled={tutorialStep > 0 && tutorialStep !== 3 && tutorialStep !== 12}
              >
                <View style={styles.panelShutterInner} />
              </TouchableOpacity>
              {/* 設定（右） */}
              <TouchableOpacity
                style={[styles.panelIconBtn, tutorialStep > 0 && tutorialStep !== 14 && { opacity: 0.3 }, tutorialStep === 14 && { borderRadius: 8, borderWidth: 2, borderColor: '#4CD964' }]}
                onPress={tutorialStep === 14 ? advanceTutorial : () => setSettingsVisible(true)}
                disabled={tutorialStep > 0 && tutorialStep !== 14}
              >
                <Text style={styles.panelIconText}>⚙️</Text>
                <Text style={styles.panelLabel}>{t('panel_settings')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )
      )}

      {/* 設定オーバーレイ（Modal→絶対配置Viewに変更：fullScreen切替時の再アニメーション防止） */}
      {settingsVisible && (
        <View style={[styles.settingsContainer, styles.settingsOverlay]}>
          {/* ヘッダー（チュートリアル step15 中はCloseも無効） */}
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsTitle}>{t('settings_title')}</Text>
            <TouchableOpacity
              onPress={tutorialStep === 17 ? advanceTutorial : () => setSettingsVisible(false)}
              disabled={tutorialStep === 15}
            >
              <Text style={[
                styles.settingsClose,
                tutorialStep === 15 && { opacity: 0.3 },
                tutorialStep === 17 && { color: '#4CD964' },
              ]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* テーマ（2行構成：1行目ラベル、2行目ドロップダウン） */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionLabel}>{t('settings_theme')}</Text>
            {/* 2行目：現在のテーマ表示＋ドロップダウントグル（折りたたみ時は削除アイコンなし） */}
            <TouchableOpacity onPress={() => {
              const next = !themeDropdownOpen;
              playSE(next ? SE_OPEN_CABINET : SE_CLOSE_CABINET);
              setThemeDropdownOpen(next);
            }}>
              <View style={[styles.settingsRow, { marginTop: 6 }]}>
                <Text style={[styles.settingsRowLabel, { flex: 1 }]}>
                  {t('theme_' + theme)}
                  {'  '}<Text style={{ fontSize: 12, color: '#aaa' }}>{themeDropdownOpen ? '▲' : '▼'}</Text>
                </Text>
              </View>
            </TouchableOpacity>
            {/* 展開時：アンロック済みテーマを固定順で表示（デフォルト以外に削除アイコン） */}
            {themeDropdownOpen && THEMES.filter(th => unlockedThemes.includes(th.id)).map(th => {
              const remaining = frameCounts[th.id] ?? 0;
              const isSelected = th.id === theme;
              return (
                <View key={th.id} style={[styles.themeRow, { paddingLeft: 12 }]}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => { playSE(SE_BUTTON01A); handleThemeChange(th.id); setThemeDropdownOpen(false); }}>
                    <Text style={styles.themeLabel}>{t('theme_' + th.id)}</Text>
                    <Text style={styles.themeFrameCount}>{t('settings_frame_remain', { remaining })}</Text>
                  </TouchableOpacity>
                  {isSelected && <Text style={styles.themeCheck}>✓</Text>}
                  {th.id !== 'default' && (
                    <TouchableOpacity style={styles.themeDeleteBtn} onPress={() => handleThemeDelete(th.id)}>
                      <Text style={styles.themeDeleteText}>🗑</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          <View style={styles.settingsDivider} />

          {/* チュートリアル step15/17 中はテーマ以外を無効化 */}
          <View pointerEvents={[15, 17].includes(tutorialStep) ? 'none' : 'auto'}
                style={[15, 17].includes(tutorialStep) ? { opacity: 0.3 } : null}>

          {/* フレーム */}
          <View style={styles.settingsSection}>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsSectionLabel}>{t('settings_frame')}</Text>
              <Text style={[styles.settingsRowLabel, { flex: 1 }]}>
                {frameEnabled ? t('settings_frame_on') : t('settings_frame_off')}
              </Text>
              <Switch
                value={frameEnabled}
                onValueChange={handleFrameToggle}
                trackColor={{ false: '#555', true: '#4CD964' }}
                thumbColor="#fff"
              />
            </View>
          </View>

          <View style={styles.settingsDivider} />

          {/* アルバムモード */}
          <View style={styles.settingsSection}>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsSectionLabel}>{t('settings_album_mode')}</Text>
              <Text style={[styles.settingsRowLabel, { flex: 1 }]}>
                {saveMode === 'album' ? t('settings_album_on') : t('settings_album_off')}
              </Text>
              <Switch
                value={saveMode === 'album'}
                onValueChange={handleAlbumModeToggle}
                disabled={saveMode === 'none'}
                trackColor={{ false: '#555', true: '#4CD964' }}
                thumbColor="#fff"
              />
            </View>
            {saveMode === 'none' && (
              <Text style={styles.settingsNote}>{t('settings_album_no_perm')}</Text>
            )}
          </View>

          {/* 自動削除（アルバムモードON時のみ） */}
          {saveMode === 'album' && (
            <>
              <View style={styles.settingsDivider} />
              <View style={styles.settingsSection}>
                <View style={styles.settingsRow}>
                  <Text style={styles.settingsSectionLabel}>{t('settings_auto_delete')}</Text>
                  <Text style={[styles.settingsRowLabel, { flex: 1 }]}>
                    {autoDelete ? t('settings_auto_delete_on') : t('settings_auto_delete_off')}
                  </Text>
                  <Switch
                    value={autoDelete}
                    onValueChange={(v) => {
                      playSE(v ? SE_SWITCH_ON : SE_SWITCH_OFF);
                      setAutoDelete(v);
                      persistAutoDelete(v, autoDeleteTarget);
                    }}
                    trackColor={{ false: '#555', true: '#4CD964' }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
              {autoDelete && (
                <>
                  <View style={styles.settingsDivider} />
                  <View style={styles.settingsSection}>
                    <Text style={styles.settingsSectionLabel}>{t('settings_delete_target')}</Text>
                    <View style={[styles.settingsRow, { marginTop: 10, gap: 10 }]}>
                      <TouchableOpacity
                        style={[styles.autoDeleteBtn, autoDeleteTarget === 'newest' && styles.autoDeleteBtnActive]}
                        onPress={() => { playSE(SE_BUTTON01A); setAutoDeleteTarget('newest'); persistAutoDelete(autoDelete, 'newest'); }}
                      >
                        <Text style={[styles.autoDeleteBtnText, autoDeleteTarget === 'newest' && styles.autoDeleteBtnTextActive]}>{t('settings_delete_newest')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.autoDeleteBtn, autoDeleteTarget === 'oldest' && styles.autoDeleteBtnActive]}
                        onPress={() => { playSE(SE_BUTTON01A); setAutoDeleteTarget('oldest'); persistAutoDelete(autoDelete, 'oldest'); }}
                      >
                        <Text style={[styles.autoDeleteBtnText, autoDeleteTarget === 'oldest' && styles.autoDeleteBtnTextActive]}>{t('settings_delete_oldest')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}
            </>
          )}

          <View style={styles.settingsDivider} />

          {/* カメラフレーム（ON=フレームあり=!fullScreen） */}
          <View style={styles.settingsSection}>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsSectionLabel}>{t('settings_camera_frame')}</Text>
              <Text style={[styles.settingsRowLabel, { flex: 1 }]}>
                {fullScreen ? t('settings_camera_frame_off') : t('settings_camera_frame_on')}
              </Text>
              <Switch
                value={!fullScreen}
                onValueChange={(v) => handleFullScreenToggle(!v)}
                trackColor={{ false: '#555', true: '#4CD964' }}
                thumbColor="#fff"
              />
            </View>
          </View>

          <View style={styles.settingsDivider} />

          {/* BGM */}
          <View style={styles.settingsSection}>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsSectionLabel}>{t('settings_bgm')}</Text>
              <Text style={[styles.settingsRowLabel, { flex: 1 }]}>
                {bgmEnabled ? t('settings_bgm_on') : t('settings_bgm_off')}
              </Text>
              <Switch
                value={bgmEnabled}
                onValueChange={(v) => {
                  playSE(v ? SE_SWITCH_ON : SE_SWITCH_OFF);
                  setBgmEnabled(v);
                  persistAudioSettings(v, seEnabled);
                }}
                trackColor={{ false: '#555', true: '#4CD964' }}
                thumbColor="#fff"
              />
            </View>
          </View>

          <View style={styles.settingsDivider} />

          {/* SE */}
          <View style={styles.settingsSection}>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsSectionLabel}>{t('settings_se')}</Text>
              <Text style={[styles.settingsRowLabel, { flex: 1 }]}>
                {seEnabled ? t('settings_se_on') : t('settings_se_off')}
              </Text>
              <Switch
                value={seEnabled}
                onValueChange={(v) => {
                  if (v) {
                    // OFF→ON：seEnabledRefがまだfalseなのでplayRawSEで直接再生
                    playRawSE(SE_SWITCH_ON);
                  } else {
                    playSE(SE_SWITCH_OFF);
                  }
                  setSeEnabled(v);
                  seEnabledRef.current = v;
                  persistAudioSettings(bgmEnabled, v);
                }}
                trackColor={{ false: '#555', true: '#4CD964' }}
                thumbColor="#fff"
              />
            </View>
          </View>

          <View style={styles.settingsDivider} />

          {/* 言語（最下部配置：誤操作で言語変更して操作不能になることを防ぐ） */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionLabel}>{t('settings_language')}</Text>
            <TouchableOpacity onPress={() => {
              const next = !langDropdownOpen;
              playSE(next ? SE_OPEN_CABINET : SE_CLOSE_CABINET);
              setLangDropdownOpen(next);
            }}>
              <View style={[styles.settingsRow, { marginTop: 6 }]}>
                <Text style={[styles.settingsRowLabel, { flex: 1 }]}>
                  {SUPPORTED_LANGUAGES.find(l => l.id === language)?.label}
                  {'  '}<Text style={{ fontSize: 12, color: '#aaa' }}>{langDropdownOpen ? '▲' : '▼'}</Text>
                </Text>
              </View>
            </TouchableOpacity>
            {langDropdownOpen && SUPPORTED_LANGUAGES.filter(l => l.id !== language).map(l => (
              <View key={l.id} style={[styles.themeRow, { paddingLeft: 12 }]}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => {
                  playSE(SE_BUTTON01A);
                  handleLanguageChange(l.id);
                  setLangDropdownOpen(false);
                }}>
                  <Text style={styles.themeLabel}>{l.label}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          </View>{/* チュートリアル step15 無効化ラッパーここまで */}
        </View>
      )}

      {/* CreatureCameraアルバム一覧 */}
      <Modal visible={galleryVisible} animationType="none" transparent onRequestClose={closeGallery}>
        <Animated.View style={[styles.galleryModal, {
          transform: [{ translateY: gallerySlideY }],
          opacity: galleryOpacity,
        }]}>
          {/* ヘッダー（チュートリアルstep5〜10中は操作無効） */}
          <View
            pointerEvents={[5,6,7,8,9,10].includes(tutorialStep) ? 'none' : 'auto'}
            style={[styles.galleryHeader, selectionMode && styles.galleryHeaderSelection]}>
            {selectionMode ? (
              // 選択モード中ヘッダー
              <>
                <TouchableOpacity onPress={exitSelectionMode}>
                  <Text style={styles.gallerySelectionExit}>{t('gallery_deselect')}</Text>
                </TouchableOpacity>
                <View style={styles.gallerySelectionActions}>
                  <TouchableOpacity style={styles.galleryActionBtn} onPress={handleDeleteAction}>
                    <Text style={styles.galleryActionText}>🗑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.galleryActionBtn} onPress={handleUnprotectAction}>
                    <Text style={[styles.galleryActionText, { color: '#f5a623' }]}>☆</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.galleryActionBtn} onPress={handleProtectAction}>
                    <Text style={styles.galleryActionText}>⭐</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              // 通常ヘッダー
              <>
                <Text style={styles.galleryTitle}>
                  {saveMode === 'album' ? t('gallery_title_album') : t('gallery_title_default')}
                  {'  '}
                  <Text style={[
                    styles.galleryCount,
                    overflowMode && galleryAssets.length > PHOTO_LIMIT && styles.galleryCountOverflow,
                  ]}>
                    {galleryAssets.filter(a => savedPhotoIds[a.id]).length}/{galleryAssets.length}
                  </Text>
                </Text>
                <View style={styles.galleryHeaderRight}>
                  <TouchableOpacity style={styles.galleryActionBtn} onPress={enterSelectionMode}>
                    <Text style={styles.galleryActionText}>☑️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={closeGallery}>
                    <Text style={styles.galleryClose}>✕</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* グリッド（step5はサムネイルタップのみ許可、step6〜10は完全無効） */}
          <FlatList
            pointerEvents={[6,7,8,9,10].includes(tutorialStep) ? 'none' : 'auto'}
            data={galleryAssets}
            keyExtractor={item => item.id}
            numColumns={3}
            renderItem={({ item, index }) => {
              const isSelected = !!selectedPhotoIds[item.id];
              const isSaved    = !!savedPhotoIds[item.id];
              return (
                <TouchableOpacity onPress={() => handlePhotoTap(item, index)}>
                  <View>
                    <Image source={{ uri: item.uri }} style={styles.gridThumb} />
                    {isSaved && (
                      <View style={styles.gridProtectedBadge}>
                        <Text style={styles.gridProtectedBadgeText}>★</Text>
                      </View>
                    )}
                    {selectionMode && isSelected && (
                      <View style={styles.gridSelectBadge}>
                        <Text style={styles.gridSelectBadgeText}>✓</Text>
                      </View>
                    )}
                    {selectionMode && !isSelected && (
                      <View style={styles.gridSelectCircle} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
          />

          {/* フォトビューワー（アニメーション付きclose） */}
          {viewerVisible && selectedIndex !== null && (
            <Animated.View style={[styles.photoViewer, {
              transform: [{ translateY: viewerSlideY }],
              opacity: viewerOpacity,
            }]}>
              {/* スロット0 */}
              {(primarySlot === 0 ? selectedIndex : pendingIndex) !== null && galleryAssets[(primarySlot === 0 ? selectedIndex : pendingIndex)] && (
                <Animated.View
                  style={[StyleSheet.absoluteFill, { transform: [{ translateX: slotX[0] }] }]}
                  {...(primarySlot === 0 ? photoViewerPan.panHandlers : {})}
                >
                  <Image
                    source={{ uri: galleryAssets[primarySlot === 0 ? selectedIndex : pendingIndex].uri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="contain"
                  />
                </Animated.View>
              )}
              {/* スロット1 */}
              {(primarySlot === 1 ? selectedIndex : pendingIndex) !== null && galleryAssets[(primarySlot === 1 ? selectedIndex : pendingIndex)] && (
                <Animated.View
                  style={[StyleSheet.absoluteFill, { transform: [{ translateX: slotX[1] }] }]}
                  {...(primarySlot === 1 ? photoViewerPan.panHandlers : {})}
                >
                  <Image
                    source={{ uri: galleryAssets[primarySlot === 1 ? selectedIndex : pendingIndex].uri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="contain"
                  />
                </Animated.View>
              )}
              {/* ✕ボタン・カウンター・削除・保護：アニメーション中は非表示 */}
              {pendingIndex === null && (
                <View style={StyleSheet.absoluteFill} pointerEvents={[6,7,8].includes(tutorialStep) ? 'none' : 'auto'}>
                  <TouchableOpacity style={styles.viewerClose} onPress={closeViewer}>
                    <Text style={styles.viewerCloseText}>✕</Text>
                  </TouchableOpacity>
                  <Text style={styles.viewerCounter}>
                    {selectedIndex + 1} / {galleryAssets.length}
                  </Text>
                  {/* 左下：保護/保護解除 */}
                  <TouchableOpacity style={styles.viewerProtectBtn} onPress={handleViewerProtectToggle}>
                    <Text style={styles.viewerActionText}>
                      {savedPhotoIds[galleryAssets[selectedIndex]?.id] ? '⭐' : '☆'}
                    </Text>
                  </TouchableOpacity>
                  {/* 右下：削除 */}
                  <TouchableOpacity style={styles.viewerDeleteBtn} onPress={handleViewerDelete}>
                    <Text style={styles.viewerActionText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>
          )}

          {/* ── ギャラリー内チュートリアルオーバーレイ（step5〜10） ── */}
          {[5,6,7,8,9,10].includes(tutorialStep) && renderTutorialOverlay()}

        </Animated.View>
      </Modal>

      {/* ── メイン画面チュートリアルオーバーレイ（step1〜4, 11〜18） ── */}
      {tutorialStep > 0 && !([5,6,7,8,9,10].includes(tutorialStep)) && renderTutorialOverlay()}

    </View>
  );

  // ── チュートリアルオーバーレイ共通レンダー関数 ──
  function renderTutorialOverlay() {
    // シャッター処理中（step3/12）はバブルを非表示（誤スキップ防止）
    if (tutorialCapturing) return null;

    // ── STEP_DATA ──
    // arrow: 絵文字。上向き系（↗️ ⬆️）はバブルの上に表示、下向き系はバブルの下に表示
    // bubbleY: バブルの top 位置（画面座標）
    // spotlight: 特定ボタン強調用リング（tutorialOverlay 内に絶対座標で描画）
    const STEP_DATA = {
      1:  {
        // Step 1：言語未設定なのでバイリンガルハードコード（t()は使わない）
        msg: 'このアプリは、ランダムに出現する生き物を撮影するアプリです。\nThis app lets you photograph creatures that randomly appear!\n\n言語を選んでね / Select your language',
        arrow: null, bubbleY: SCREEN_H * 0.25, showNext: false,
      },
      2:  {
        msg: t('tutorial_step2_msg'),
        arrow: '⬇️', bubbleY: SCREEN_H * 0.42, showNext: true,
      },
      3:  {
        msg: t('tutorial_step3_msg'),
        arrow: null, bubbleY: SCREEN_H * 0.52, showNext: false,
      },
      4:  {
        msg: t('tutorial_step4_msg'),
        arrow: '↙️', bubbleY: SCREEN_H * 0.42, showNext: true,
      },
      5:  {
        msg: t('tutorial_step5_msg'),
        arrow: '⬆️', bubbleY: SCREEN_H * 0.68, showNext: false,
      },
      6:  {
        msg: t('tutorial_step6_msg'),
        arrow: '↘️', bubbleY: SCREEN_H * 0.32, showNext: true,
        spotlight: { bottom: 40, right: 24, width: 52, height: 52, emoji: '🗑', radius: 26, tappable: true },
      },
      7:  {
        msg: t('tutorial_step7_msg'),
        arrow: '↙️', bubbleY: SCREEN_H * 0.32, showNext: true,
        spotlight: { bottom: 40, left: 24, width: 52, height: 52, emoji: '☆', radius: 26, tappable: true },
      },
      8:  {
        msg: t('tutorial_step8_msg'),
        arrow: '↗️', bubbleY: SCREEN_H * 0.55, showNext: true,
        spotlight: { top: 55, right: 20, width: 44, height: 44, emoji: '✕', radius: 22, emojiColor: '#fff', emojiBold: true, tappable: true },
      },
      9:  {
        msg: t('tutorial_step9_msg'),
        arrow: '↗️', bubbleY: SCREEN_H * 0.45, showNext: true,
        spotlight: { top: 55, right: 58, width: 40, height: 40, emoji: '☑️', radius: 20, tappable: true },
      },
      10: {
        msg: t('tutorial_step10_msg'),
        arrow: '↗️', bubbleY: SCREEN_H * 0.45, showNext: true,
        spotlight: { top: 55, right: 20, width: 36, height: 36, emoji: '✕', radius: 18, emojiColor: '#fff', emojiBold: true, tappable: true },
      },
      11: {
        msg: t('tutorial_step11_msg'),
        arrow: null, bubbleY: SCREEN_H * 0.32, showNext: true,
      },
      12: {
        msg: t('tutorial_step12_msg'),
        arrow: '⬇️', bubbleY: SCREEN_H * 0.42, showNext: false,
      },
      14: {
        msg: t('tutorial_step14_msg'),
        arrow: '↘️', bubbleY: SCREEN_H * 0.42, showNext: true,
      },
      15: {
        msg: t('tutorial_step15_msg'),
        arrow: '⬆️', bubbleY: SCREEN_H * 0.62, showNext: true,
        // spotlight は動的計算のため下記参照
      },
      17: {
        msg: t('tutorial_step17_msg'),
        arrow: '↗️', bubbleY: SCREEN_H * 0.52, showNext: true,
        spotlight: { top: 55, right: 20, width: 44, height: 44, emoji: '✕', radius: 22, emojiColor: '#fff', emojiBold: true, tappable: true },
      },
      18: {
        msg: t('tutorial_step18_msg'),
        arrow: null, bubbleY: SCREEN_H * 0.32, showNext: true,
      },
    };

    const data = STEP_DATA[tutorialStep];
    if (!data) return null;
    const { msg, arrow, bubbleY, showNext, spotlight } = data;
    const arrowAbove = arrow && ['↗️', '⬆️'].includes(arrow);

    // step 15：テーマボタンとドロップダウン行を themeDropdownOpen に応じて動的ハイライト
    // 設定画面のレイアウト基準値（ヘッダー高さ等）
    const SETTINGS_HEADER_H  = 96;  // paddingTop:55 + テキスト + paddingBottom:16 + border:1
    const THEME_SECTION_PAD  = 16;  // settingsSection paddingTop
    const THEME_LABEL_H      = 28;  // "テーマ：" ラベル（fontSize:13 + marginBottom:10）
    const THEME_BTN_OFFSET   = 6;   // theme button marginTop
    const THEME_BTN_H        = 36;  // テーマボタン行の高さ
    const THEME_ROW_H        = 64;  // 展開時の各テーマ行の高さ（paddingVertical:14 + ラベル + フレーム数）
    const themeSpotlightTop  = SETTINGS_HEADER_H + THEME_SECTION_PAD + THEME_LABEL_H + THEME_BTN_OFFSET;
    const themeCount         = unlockedThemes.length; // チュートリアル中は必ず2以上
    const effectiveSpotlight = tutorialStep === 15
      ? {
          top: themeSpotlightTop,
          left: 20, right: 20,
          height: themeDropdownOpen ? THEME_BTN_H + THEME_ROW_H * themeCount : THEME_BTN_H,
          radius: 8,
          tappable: false, // 実際のテーマボタンが操作可能なのでスポットは装飾のみ
        }
      : spotlight;

    return (
      <View style={styles.tutorialOverlay} pointerEvents="box-none">
        <View style={styles.tutorialBg} pointerEvents="none" />

        {/* スポットライト：特定ボタンを強調するリング（tappable なら次へ扱い） */}
        {effectiveSpotlight && (() => {
          const sp = effectiveSpotlight;
          const spotStyle = [{
            position: 'absolute',
            borderRadius: sp.radius,
            borderWidth: 2.5,
            borderColor: '#4CD964',
            backgroundColor: 'rgba(76,217,100,0.15)',
            alignItems: 'center', justifyContent: 'center',
          },
            sp.top    !== undefined && { top: sp.top },
            sp.bottom !== undefined && { bottom: sp.bottom },
            sp.left   !== undefined && { left: sp.left },
            sp.right  !== undefined && { right: sp.right },
            sp.width  !== undefined && { width: sp.width },
            sp.height !== undefined && { height: sp.height },
          ];
          const inner = sp.emoji ? (
            <Text style={{ fontSize: 22, color: sp.emojiColor, fontWeight: sp.emojiBold ? 'bold' : 'normal' }}>
              {sp.emoji}
            </Text>
          ) : null;
          return sp.tappable ? (
            <TouchableOpacity onPress={advanceTutorial} style={spotStyle}>
              {inner}
            </TouchableOpacity>
          ) : (
            <View pointerEvents="none" style={spotStyle}>{inner}</View>
          );
        })()}

        {/* メッセージバブル */}
        <View style={[styles.tutorialBubbleWrapper, { top: bubbleY }]}>
          {arrow && arrowAbove && <Text style={styles.tutorialArrow}>{arrow}</Text>}
          <View style={styles.tutorialBubble}>
            <Text style={styles.tutorialMsg}>{msg}</Text>
            {tutorialStep === 1 ? (
              // Step 1：言語選択ボタン（バイリンガル固定文字）
              <View style={styles.tutorialBtnRow}>
                <TouchableOpacity style={styles.tutorialBtnPrimary} onPress={() => { handleLanguageChange('ja'); advanceTutorial(); }}>
                  <Text style={styles.tutorialBtnText}>日本語</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tutorialBtnSecondary} onPress={() => { handleLanguageChange('en'); advanceTutorial(); }}>
                  <Text style={styles.tutorialBtnText}>English</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.tutorialBtnRow}>
                {showNext && (
                  <TouchableOpacity style={styles.tutorialBtnPrimary} onPress={advanceTutorial}>
                    <Text style={styles.tutorialBtnText}>{t('tutorial_btn_next')}</Text>
                  </TouchableOpacity>
                )}
                {/* step3（宇宙人撮影待ち）・step12（アイテム撮影待ち）はスキップボタン非表示 */}
                {tutorialStep !== 3 && tutorialStep !== 12 && (
                  <TouchableOpacity style={styles.tutorialBtnSkip} onPress={skipTutorial}>
                    <Text style={styles.tutorialBtnSkipText}>{t('tutorial_btn_skip')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
          {arrow && !arrowAbove && <Text style={styles.tutorialArrow}>{arrow}</Text>}
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#000' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  permText:    { color: '#fff', fontSize: 16, marginBottom: 20 },
  btn:         { backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  btnText:     { fontSize: 16, fontWeight: 'bold' },
  creature:    { position: 'absolute', zIndex: 10 },
  exitBtn: {
    position: 'absolute', top: 50, right: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', zIndex: 20,
  },
  exitText:    { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  shutterArea: { position: 'absolute', bottom: 50, width: '100%', alignItems: 'center' },
  shutterBtn: {
    width: 75, height: 75, borderRadius: 37.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff' },
  galleryBtn: {
    position: 'absolute', bottom: 58, left: 30,
    width: 58, height: 58, borderRadius: 8,
    borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  galleryIcon: { fontSize: 28 },
  settingsBtn: {
    position: 'absolute', bottom: 58, right: 30,
    width: 58, height: 58, borderRadius: 8,
    borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  settingsIcon: { fontSize: 28 },
  settingsContainer: { flex: 1, backgroundColor: '#1c1c1e' },
  settingsOverlay:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200 },
  settingsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 55, paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#333',
  },
  settingsTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  settingsClose: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  settingsSection: { paddingHorizontal: 20, paddingVertical: 16 },
  settingsSectionLabel: { color: '#aaa', fontSize: 13, marginBottom: 10, textTransform: 'uppercase' },
  settingsDivider: { height: 1, backgroundColor: '#333', marginHorizontal: 0 },
  themeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2c2c2e',
  },
  themeLabel: { color: '#fff', fontSize: 16 },
  themeFrameCount: { color: '#aaa', fontSize: 11, marginTop: 2 },
  themeCheck: { color: '#4CD964', fontSize: 18, fontWeight: 'bold', marginRight: 8 },
  themeDeleteBtn: {
    paddingHorizontal: 8, paddingVertical: 4,
    marginLeft: 4,
  },
  themeDeleteText: { fontSize: 18 },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingsRowLabel: { color: '#fff', fontSize: 15, flex: 1, marginRight: 12 },
  settingsNote: { color: '#ff453a', fontSize: 12, marginTop: 8 },
  autoDeleteBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#555', alignItems: 'center' },
  autoDeleteBtnActive: { borderColor: '#4CD964', backgroundColor: 'rgba(76,217,100,0.15)' },
  autoDeleteBtnText: { color: '#aaa', fontSize: 14 },
  autoDeleteBtnTextActive: { color: '#4CD964', fontWeight: 'bold' },
  galleryModal: { flex: 1, backgroundColor: '#000' },
  galleryHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 55, paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#333',
  },
  galleryHeaderSelection: {
    backgroundColor: '#2c2c2e',
  },
  galleryTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  galleryCount: { color: '#aaa', fontSize: 14, fontWeight: 'normal' },
  galleryCountOverflow: { color: '#ff3b30', fontWeight: 'bold' },
  galleryClose: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginLeft: 16 },
  galleryHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  gallerySelectionExit: { color: '#4CD964', fontSize: 15, fontWeight: '600' },
  gallerySelectionActions: { flexDirection: 'row', gap: 8 },
  galleryActionBtn: { padding: 6 },
  galleryActionText: { fontSize: 24 },
  gridThumb:    { width: THUMB_SIZE, height: THUMB_SIZE, margin: 1 },
  gridSelectBadge: {
    position: 'absolute', top: 4, right: 4,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  gridSelectBadgeText: { color: '#000', fontSize: 14, fontWeight: 'bold' },
  gridSelectCircle: {
    position: 'absolute', top: 4, right: 4,
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  gridProtectedBadge: {
    position: 'absolute', bottom: 4, left: 4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#f5a623',
    alignItems: 'center', justifyContent: 'center',
  },
  gridProtectedBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold', lineHeight: 14 },
  photoViewer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  viewerClose: {
    position: 'absolute', top: 55, right: 20,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  viewerCloseText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  viewerProtectBtn: {
    position: 'absolute', bottom: 40, left: 24,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  viewerDeleteBtn: {
    position: 'absolute', bottom: 40, right: 24,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  viewerActionText: { fontSize: 26 },
  viewerCounter: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    color: '#fff', fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
  },
  // ── フレームモード：下部コントロールパネル ──
  controlPanel: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: PANEL_H,
    zIndex: 30,
    backgroundColor: '#0d0d0d',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    // デジカメLCDらしい細い緑ラインをトップに
    borderTopColor: '#1a3a1a',
  },
  panelIconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
  },
  panelIconText: { fontSize: 28 },
  panelLabel: {
    color: '#7aff7a',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  panelShutterBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#222',
    borderWidth: 3, borderColor: '#888',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 6,
  },
  panelShutterInner: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#ccc',
    borderWidth: 1, borderColor: '#aaa',
  },
  // ── チュートリアルUI ──
  tutorialOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 300, // 設定オーバーレイ(200)より上
  },
  tutorialBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  tutorialBubbleWrapper: {
    position: 'absolute',
    left: 20, right: 20,
    alignItems: 'center',
  },
  tutorialBubble: {
    width: '100%',
    backgroundColor: 'rgba(20,20,40,0.93)',
    borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 20, paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 10,
  },
  tutorialMsg: {
    color: '#fff', fontSize: 15, lineHeight: 22,
    textAlign: 'center', marginBottom: 8,
  },
  tutorialArrow: {
    fontSize: 48, // ラージサイズ
    marginVertical: 4,
  },
  tutorialBtnRow: {
    flexDirection: 'row', gap: 12, marginTop: 8,
  },
  tutorialBtnPrimary: {
    backgroundColor: '#4CD964',
    paddingHorizontal: 28, paddingVertical: 10, borderRadius: 8,
  },
  tutorialBtnSecondary: {
    backgroundColor: '#555',
    paddingHorizontal: 28, paddingVertical: 10, borderRadius: 8,
  },
  tutorialBtnText: {
    color: '#fff', fontSize: 15, fontWeight: 'bold',
  },
  tutorialBtnSkip: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  tutorialBtnSkipText: {
    color: 'rgba(255,255,255,0.6)', fontSize: 13,
  },
  // ── 削除確認UI ──
});

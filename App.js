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
const SPECIAL_ITEM_CHANCE = 0.05; // 特殊アイテム出現確率（5%）
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

async function persistSettings(theme, albumMode, frameEnabled, fullScreen, unlockedThemes, frameCounts) {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme, albumMode, frameEnabled, fullScreen, unlockedThemes, frameCounts }));
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
    { id: 'octopus', emoji: '🐙', size: 80 },
    { id: 'alien',   emoji: '👽', size: 70 },
    { id: 'spider',  emoji: '🕷️', size: 60 },
    { id: 'ghost',   emoji: '👻', size: 75 },
    { id: 'eye',     emoji: '👁️', size: 65 },
    { id: 'bug',     emoji: '🐛', size: 55 },
  ],
  flower: [
    { id: 'rose',      emoji: '🌹', size: 70 },
    { id: 'tulip',     emoji: '🌷', size: 65 },
    { id: 'cherry',    emoji: '🌸', size: 75 },
    { id: 'sunflower', emoji: '🌻', size: 80 },
    { id: 'bouquet',   emoji: '💐', size: 85 },
  ],
  stylish: [
    { id: 'diamond', emoji: '💎', size: 65 },
    { id: 'sparkle', emoji: '✨', size: 70 },
    { id: 'ring',    emoji: '💍', size: 60 },
    { id: 'sheart',  emoji: '💖', size: 75 },
    { id: 'ribbon',  emoji: '🎀', size: 65 },
  ],
  ocean: [
    { id: 'jellyfish', emoji: '🪼', size: 70 },
    { id: 'fish',      emoji: '🐟', size: 60 },
    { id: 'whale',     emoji: '🐳', size: 90 },
    { id: 'octopus2',  emoji: '🐙', size: 80 },
    { id: 'dolphin',   emoji: '🐬', size: 85 },
  ],
  forest: [
    { id: 'squirrel', emoji: '🐿️', size: 60 },
    { id: 'monkey',   emoji: '🐒',  size: 70 },
    { id: 'bear',     emoji: '🐻',  size: 85 },
    { id: 'raccoon',  emoji: '🦝',  size: 70 },
    { id: 'owl',      emoji: '🦉',  size: 65 },
  ],
  savanna: [
    { id: 'lion',     emoji: '🦁', size: 85 },
    { id: 'giraffe',  emoji: '🦒', size: 90 },
    { id: 'elephant', emoji: '🐘', size: 95 },
    { id: 'zebra',    emoji: '🦓', size: 80 },
    { id: 'flamingo', emoji: '🦩', size: 75 },
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
};
function getAnimMode(id) { return CREATURE_ANIM[id] || 'edge'; }


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

function CreatureOverlay({ creature, mode, edge, onDone, posRef, onFinalPos, onCapturable, onUncapturable, vp, isSpecial, itemLabel }) {
  const viewport = vp ?? FULL_VP;
  const isFade   = mode === 'fadein';
  const edgeSetup = isFade ? null : getEdgeSetup(edge, creature.size, viewport);
  // fadein も安全フレーム内にランダム配置
  const sf = getSafeFrame(viewport);
  const initTop  = isFade ? sf.top  + Math.random() * Math.max(0, sf.bottom - sf.top  - creature.size) : edgeSetup.initTop;
  const initLeft = isFade ? sf.left + Math.random() * Math.max(0, sf.right  - sf.left - creature.size) : edgeSetup.initLeft;
  const enterTo  = isFade ? null : edgeSetup.enterTo;

  const topAnim     = useRef(new Animated.Value(initTop)).current;
  const leftAnim    = useRef(new Animated.Value(initLeft)).current;
  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(isFade ? 0 : 1)).current;

  useEffect(() => {
    posRef.current = { top: initTop, left: initLeft };
    const tl = topAnim.addListener(({ value })  => { posRef.current.top  = value; });
    const ll = leftAnim.addListener(({ value }) => { posRef.current.left = value; });
    // 生き物の最終停止座標をスコープへ通知
    const finalTop  = isFade ? initTop  : (enterTo?.top  !== undefined ? enterTo.top  : initTop);
    const finalLeft = isFade ? initLeft : (enterTo?.left !== undefined ? enterTo.left : initLeft);
    onFinalPos?.({ top: finalTop, left: finalLeft });
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
      topAnim.removeListener(tl);
      leftAnim.removeListener(ll);
    };
  }, []);

  return (
    <Animated.View style={[styles.creature, {
      top: topAnim, left: leftAnim,
      opacity: opacityAnim,
      transform: [{ scale: scaleAnim }, ...(edge === 'left' ? [{ scaleX: -1 }] : [])],
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
function ScopeOverlay({ posRef, creatureSize, finalPosRef, creatureActive, capturable, onAnimComplete }) {
  const SIZE = 72;
  const leftAnim    = useRef(new Animated.Value(SCREEN_W / 2 - SIZE / 2)).current;
  const topAnim     = useRef(new Animated.Value(SCREEN_H / 2 - SIZE / 2)).current;
  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.75)).current;
  const phaseRef    = useRef('float'); // 'float' | 'track' | 'zoom' | 'done'

  // 漂うアニメーション（creature が現れるまで）
  useEffect(() => {
    let alive = true;
    const drift = () => {
      if (!alive || phaseRef.current !== 'float') return;
      // 漂い範囲：画面中央50%面積に限定（各辺 sqrt(0.5) ≈ 70.7%）
      const SW = SCREEN_W * Math.SQRT1_2;
      const SH = SCREEN_H * Math.SQRT1_2;
      const mx = (SCREEN_W - SW) / 2;
      const my = (SCREEN_H - SH) / 2;
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
    // 浮遊アニメーションを止めてから追跡開始
    leftAnim.stopAnimation();
    topAnim.stopAnimation();
    // 生き物の最終停止座標の中心を照準
    const targetLeft = (finalPosRef?.current?.left ?? 0) + (creatureSize ?? 0) / 2 - SIZE / 2;
    const targetTop  = (finalPosRef?.current?.top  ?? 0) + (creatureSize ?? 0) / 2 - SIZE / 2;
    // 距離に比例したduration（一定速度 TRACK_SPEED px/s）
    const TRACK_SPEED = 380;
    const dx = targetLeft - leftAnim._value;
    const dy = targetTop  - topAnim._value;
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
  const [debugMode, setDebugMode]             = useState(false);        // デバッグ表示
  const harmonyActiveRef   = useRef(false);
  const scopeActiveRef     = useRef(false);
  const autoDeleteRef      = useRef(false);
  const autoDeleteTargetRef = useRef('oldest');
  const bgmEnabledRef         = useRef(true);
  const seEnabledRef          = useRef(true);
  const bgmSoundRef           = useRef(null);
  const bgmIntentionalStopRef = useRef(false); // 意図的な停止フラグ（自動再開と区別）
  const scopeCountRef      = useRef(0);  // スコープ残り使用回数

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

    if (saved !== null) {
      // 設定あり → そのまま反映
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
      return;
    }

    // 設定なし → デフォルトテーマのみ所持・フレーム5回で初期化
    const DEBUG_UNLOCKED = ['default'];
    const DEBUG_FRAME_COUNTS = Object.fromEntries(ALL_THEME_IDS.map(id => [id, id === 'default' ? 5 : 0]));
    setUnlockedThemes(DEBUG_UNLOCKED);
    setFrameCounts(DEBUG_FRAME_COUNTS);
    frameCountsRef.current = DEBUG_FRAME_COUNTS;

    // 設定なし → アルバムの有無で判定
    const existingAlbum = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
    if (existingAlbum) {
      // アルバムあり → アルバムモードで開始（設定として保存）
      setSaveMode('album');
      persistSettings('default', true, true, false, DEBUG_UNLOCKED, DEBUG_FRAME_COUNTS);
      const isOverflow = await checkAlbumLimitAtStartup('album');
      if (isOverflow) setOverflowMode(true);
      return;
    }

    // 設定なし・アルバムなし → 同意を求める
    Alert.alert(
      '📂 アルバムの作成',
      '撮影した写真を「CreatureCamera」アルバムにまとめますか？\n「いいえ」を選ぶと通常のカメラロールに保存されます。',
      [
        { text: 'いいえ', style: 'cancel', onPress: () => {
          setSaveMode('default');
          persistSettings('default', false, true, false, DEBUG_UNLOCKED, DEBUG_FRAME_COUNTS);
        }},
        { text: 'はい', onPress: () => {
          setSaveMode('album');
          persistSettings('default', true, true, false, DEBUG_UNLOCKED, DEBUG_FRAME_COUNTS);
        }},
      ]
    );
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
    const delay = 2000 + Math.random() * 6000;
    timerRef.current = setTimeout(() => {
      const vp = fullScreen
        ? { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, fullScreen: true }
        : { x: 10, y: 20, w: SCREEN_W - 20, h: CAMERA_AREA_H - 20, clampBottom: true, fullScreen: false };
      // 1段階目：特殊アイテム抽選（和気あいあい発動中はスキップ）
      if (!harmonyActiveRef.current && Math.random() < SPECIAL_ITEM_CHANCE) {
        // スコープ残り2回以上の場合はスコープを除外して再抽選
        const item = pickSpecialItem(scopeCountRef.current >= 2 ? ['scope'] : []);
        setActiveCreature({ creature: { id: item.type, emoji: item.emoji, size: 80 }, mode: 'fadein', edge: null, key: Date.now(), vp, isSpecial: true, itemType: item.type, itemLabel: item.label });
        return;
      }
      // 2段階目：通常生き物抽選（直前と同じ生き物は1回リトライ）
      let creature = pickCreature(theme);
      if (creature.id === lastCreatureIdRef.current) {
        const alt = pickCreature(theme);
        if (alt.id !== creature.id) creature = alt;
      }
      lastCreatureIdRef.current = creature.id;
      const mode     = getAnimMode(creature.id);
      const edge     = mode === 'fadein' ? null
                     : mode === 'top'    ? 'top'
                     : mode === 'edge3'  ? EDGE3_POOL[Math.floor(Math.random() * EDGE3_POOL.length)]
                     : EDGE_POOL[Math.floor(Math.random() * EDGE_POOL.length)];
      setActiveCreature({ creature, mode, edge, key: Date.now(), vp });
    }, delay);
  }, [theme, fullScreen]);

  useEffect(() => {
    scheduleNextCreature();
    return () => clearTimeout(timerRef.current);
  }, [scheduleNextCreature]);

  // 超過モード検知時：ダイアログを表示してからギャラリーを開く（起動時のみ）
  useEffect(() => {
    if (overflowMode && saveMode !== null) {
      if (skipOverflowAlertRef.current) { skipOverflowAlertRef.current = false; return; }
      Alert.alert(
        '📷 写真が上限を超えています',
        `写真が${PHOTO_LIMIT}枚を超えています。\nギャラリーから写真を削除してください。`,
        [{ text: 'OK', onPress: () => openGallery() }]
      );
    }
  }, [overflowMode, saveMode]);

  const handleCreatureDone = useCallback(() => {
    capturableRef.current = false;
    setCreatureCapturable(false);
    setActiveCreature(null);
    scheduleNextCreature();
  }, [scheduleNextCreature]);

  const takePicture = async () => {
    if (isTakingPictureRef.current || !cameraRef.current || compositing || saveMode === null) return;

    const isSpecialCapture = !!(activeCreature?.isSpecial && capturableRef.current);
    const hasHarmony = harmonyActiveRef.current && !isSpecialCapture;

    // 和気あいあい発動中は生き物なしでも撮影可能。それ以外は撮影可能状態が必要。
    if (!capturableRef.current && !hasHarmony) {
      playSE(SE_NO_CREATURE);
      Alert.alert('生き物がいません！', '生き物が現れたら撮影してね 👀');
      return;
    }

    // 特殊アイテム撮影：写真保存なし・生き物を消去して直接効果を適用
    if (isSpecialCapture) {
      // スコープ発動中かつスコープのパワーアップ以外の場合は使用回数を消費
      if (scopeActiveRef.current && activeCreature.itemType !== 'scope') {
        scopeCountRef.current = Math.max(0, scopeCountRef.current - 1);
        if (scopeCountRef.current === 0) {
          setScopeActive(false);
          scopeActiveRef.current = false;
        }
      }
      capturableRef.current = false;
      setCreatureCapturable(false);
      setActiveCreature(null);
      scheduleNextCreature();
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
          persistSettings(theme, saveMode === 'album', frameEnabled, fullScreen, newUnlocked, newCounts);
          const label = THEMES.find(t => t.id === newId)?.label ?? newId;
          playSE(SE_ITEM_THEME);
          Alert.alert('🎁 新しいテーマ！', `「${label}」を取得しました！`);
        } else {
          Alert.alert('🎁 テーマ', 'すでにすべてのテーマを取得済みです！');
        }
      } else if (itype === 'frame') {
        const newCount = Math.min(FRAME_MAX, (frameCountsRef.current[theme] ?? 0) + 5);
        const newCounts = { ...frameCountsRef.current, [theme]: newCount };
        setFrameCounts(newCounts);
        frameCountsRef.current = newCounts;
        persistSettings(theme, saveMode === 'album', frameEnabled, fullScreen, unlockedThemes, newCounts);
        playSE(SE_ITEM_FRAME);
        Alert.alert('🌟 フレーム回数+5！', `フレームの残り回数が${newCount}回になりました！`);
      } else if (itype === 'harmony') {
        setHarmonyActive(true);
        harmonyActiveRef.current = true;
        playSE(SE_ITEM_HARMONY);
        Alert.alert('🎊 和気あいあい！', '次の撮影で生き物たちが集まります！');
      } else if (itype === 'scope') {
        if (scopeActiveRef.current) {
          // パワーアップ：使用回数を5回にリセット
          scopeCountRef.current = 5;
          playSE(SE_ITEM_SCOPE);
          Alert.alert('🔭 スコープ、パワーアップ！', 'スコープが連続5回使えます。');
        } else {
          setScopeActive(true);
          scopeActiveRef.current = true;
          scopeCountRef.current = 1;
          playSE(SE_ITEM_SCOPE);
          Alert.alert('🔭 スコープ！', '生き物の登場場所がわかるようになりました！');
        }
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
      setCompositing({ photoUri: photo.uri, creatureSnapshot, frameSource, usedFrameTheme: frameSource ? theme : null, harmonyEntries, wasScope });
    } catch (e) {
      isTakingPictureRef.current = false;
      Alert.alert('エラー', '撮影に失敗しました');
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
          persistSettings(theme, saveMode === 'album', frameEnabled, fullScreen, unlockedThemes, newCounts);
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
        Alert.alert('📸 保存しました！', '生き物と一緒に写真フォルダに保存されたよ！', [
          { text: 'OK', onPress: async () => {
            isTakingPictureRef.current = false;
            setSuccessPhoto(null);
            setCompositing(null);
            // 撮影後：現在の生き物を即クリアしてシャッフル（連続同生き物防止）
            clearTimeout(timerRef.current);
            capturableRef.current = false;
            setCreatureCapturable(false);
            setActiveCreature(null);
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
                  '📂 アルバムがいっぱいです',
                  `写真を削除して${PHOTO_LIMIT}枚以下にしてください。`,
                  [{ text: 'OK', onPress: () => openGallery() }]
                );
              }, 150);
            }
          }},
        ]);
      } catch (e) {
        isTakingPictureRef.current = false;
        Alert.alert('エラー', '保存に失敗しました: ' + e.message);
        setCompositing(null);
      }
    };
    run();
  }, [compositing]);

  const openGallery = async () => {
    if (saveMode === 'none') {
      Alert.alert('写真へのアクセス許可がありません');
      return;
    }
    try {
      let assets;
      if (saveMode === 'album') {
        // CreatureCameraアルバムの写真のみ表示
        const album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
        if (!album) {
          Alert.alert('まだ写真がありません', '撮影するとここに表示されます。');
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
        Alert.alert('表示できる写真がありません', '写真へのアクセス権限を確認してください。');
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
      Alert.alert('エラー', 'ギャラリーを開けませんでした: ' + e.message);
    }
  };

  // ギャラリーを閉じるアニメーション（上スライド＋フェードアウト）
  const closeGallery = useCallback(() => {
    // 超過モード中（アルバムモードのみ）は、まだ上限超過していれば閉じない
    if (saveModeRef.current === 'album' && overflowModeRef.current && galleryCountRef.current > PHOTO_LIMIT) {
      Alert.alert(
        '📂 アルバムがいっぱいです',
        `写真が${PHOTO_LIMIT}枚を超えています。\n${galleryCountRef.current - PHOTO_LIMIT}枚以上削除してから戻ってください。`,
        [{ text: 'OK' }]
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
  scheduleNextCreatureRef.current = scheduleNextCreature;

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
      Alert.alert('削除できません', '保護済みの写真は削除できません。\n先に保護を解除してください。');
      return;
    }
    Alert.alert('写真を削除', 'この写真を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: async () => {
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
      Alert.alert('保護を解除', 'この写真の保護を解除しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'はい', onPress: async () => {
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
        Alert.alert('保護できません', `保護できる写真は${PROTECT_LIMIT}枚までです。`);
        return;
      }
      Alert.alert('写真を保護', 'この写真を保護しますか？\n保護された写真は削除できなくなります。', [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'はい', onPress: async () => {
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
    persistSettings(id, saveMode === 'album', frameEnabled, fullScreen, unlockedThemes, frameCounts);
  };

  // テーマ削除（取得フラグをOFF）
  const handleThemeDelete = (id) => {
    const label = THEMES.find(t => t.id === id)?.label ?? id;
    Alert.alert(
      'テーマを削除',
      `「${label}」を削除しますか？\n再取得するまで使えなくなります。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: () => {
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
          persistSettings(newTheme, saveMode === 'album', frameEnabled, fullScreen, newUnlocked, newCounts);
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
              persistSettings(theme, saveMode === 'album', true, fullScreen, unlockedThemes, frameCounts);
            }},
          ]
        );
        return;
      }
    }
    setFrameEnabled(value);
    persistSettings(theme, saveMode === 'album', value, fullScreen, unlockedThemes, frameCounts);
  };

  // 全画面トグル処理
  const handleFullScreenToggle = (value) => {
    // カメラフレームON（=fullScreen OFF）→ SE_SWITCH_ON、カメラフレームOFF（=fullScreen ON）→ SE_SWITCH_OFF
    playSE(value ? SE_SWITCH_OFF : SE_SWITCH_ON);
    setFullScreen(value);
    persistSettings(theme, saveMode === 'album', frameEnabled, value, unlockedThemes, frameCounts);
  };


  // アルバムモードのトグル処理
  const handleAlbumModeToggle = async (value) => {
    playSE(value ? SE_SWITCH_ON : SE_SWITCH_OFF);
    if (!value) {
      // ON→OFF：確認なしで即切替・保存
      setSaveMode('default');
      persistSettings(theme, false, frameEnabled, fullScreen, unlockedThemes, frameCounts);
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
      persistSettings(theme, true, frameEnabled, fullScreen, unlockedThemes, frameCounts);
    } else {
      Alert.alert(
        '権限の設定が必要です',
        'アルバムモードを使用するには、写真へのフルアクセスを許可してください。\n\n設定 → アプリ → Expo Go → 写真 → フルアクセス',
        [{ text: 'キャンセル', style: 'cancel' }]
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
      Alert.alert(
        '削除できません',
        '保護済みの写真が含まれています。\n保護済みの写真を削除するには、先に保護を解除してください。',
        [{ text: 'OK' }]
      );
      return;
    }
    Alert.alert(
      '写真を削除',
      `選択した${selectedIds.length}枚の写真を削除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: executeDelete },
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
        '保護できません',
        `保護できる写真は${PROTECT_LIMIT}枚までです。選択しなおしてください。`,
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: 'はい', onPress: exitSelectionMode },
        ]
      );
      return;
    }
    Alert.alert(
      '写真を保護',
      `選択した${selectedIds.length}枚の写真を保護しますか？\n保護された写真は削除できなくなります。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'はい', onPress: executeProtect },
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
      '保護を解除',
      '選択された写真の保護を解除し、削除可能となります。\nよろしいですか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'はい', onPress: executeUnprotect },
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
        <Text style={styles.permText}>カメラの許可が必要です</Text>
        <TouchableOpacity style={styles.btn} onPress={requestCameraPermission}>
          <Text style={styles.btnText}>許可する</Text>
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
        />
      )}

      {compositing && (
        <View ref={compositeRef} style={StyleSheet.absoluteFill} collapsable={false}>
          {compositing.frameSource ? (
            <>
              {/* 写真＋生き物を80%エリアに縮小して中央配置 */}
              <View style={{
                position: 'absolute',
                top:    SCREEN_H * 0.05,
                left:   SCREEN_W * 0.05,
                width:  SCREEN_W * 0.9,
                height: SCREEN_H * 0.9,
                overflow: 'hidden',
              }}>
                <Image source={{ uri: compositing.photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                {compositing.creatureSnapshot && (
                  <View style={[styles.creature, {
                    top:  compositing.creatureSnapshot.pos.top  - SCREEN_H * 0.05,
                    left: compositing.creatureSnapshot.pos.left - SCREEN_W * 0.05,
                    transform: compositing.creatureSnapshot.edge === 'left' ? [{ scaleX: -1 }] : [],
                  }]}>
                    <Text style={{ fontSize: compositing.creatureSnapshot.creature.size * 0.8 }}>
                      {compositing.creatureSnapshot.creature.emoji}
                    </Text>
                  </View>
                )}
                {compositing.harmonyEntries && compositing.harmonyEntries.map((entry, i) => (
                  <View key={`hf${i}`} style={[styles.creature, {
                    top:  entry.pos.top  - SCREEN_H * 0.05,
                    left: entry.pos.left - SCREEN_W * 0.05,
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
                  top:  compositing.creatureSnapshot.pos.top,
                  left: compositing.creatureSnapshot.pos.left,
                  transform: compositing.creatureSnapshot.edge === 'left' ? [{ scaleX: -1 }] : [],
                }]}>
                  <Text style={{ fontSize: compositing.creatureSnapshot.creature.size * 0.8 }}>
                    {compositing.creatureSnapshot.creature.emoji}
                  </Text>
                </View>
              )}
              {compositing.harmonyEntries && compositing.harmonyEntries.map((entry, i) => (
                <View key={`h${i}`} style={[styles.creature, { top: entry.pos.top, left: entry.pos.left }]}>
                  <Text style={{ fontSize: entry.creature.size * 0.8 }}>{entry.creature.emoji}</Text>
                </View>
              ))}
            </>
          )}
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
              <TouchableOpacity style={styles.shutterBtn} onPress={takePicture}>
                <View style={styles.shutterInner} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.galleryBtn} onPress={openGallery}>
              <Text style={styles.galleryIcon}>🖼️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => setSettingsVisible(true)}>
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
              <TouchableOpacity style={styles.panelIconBtn} onPress={openGallery}>
                <Text style={styles.panelIconText}>🖼️</Text>
                <Text style={styles.panelLabel}>ギャラリー</Text>
              </TouchableOpacity>
              {/* シャッター（中央） */}
              <TouchableOpacity style={styles.panelShutterBtn} onPress={takePicture}>
                <View style={styles.panelShutterInner} />
              </TouchableOpacity>
              {/* 設定（右） */}
              <TouchableOpacity style={styles.panelIconBtn} onPress={() => setSettingsVisible(true)}>
                <Text style={styles.panelIconText}>⚙️</Text>
                <Text style={styles.panelLabel}>設定</Text>
              </TouchableOpacity>
            </View>
          </>
        )
      )}

      {/* デバッグオーバーレイ */}
      {debugMode && !compositing && (
        (() => {
          const debugVpW = fullScreen ? SCREEN_W : SCREEN_W - 20;
          const debugVpH = fullScreen ? SCREEN_H : CAMERA_AREA_H - 20;
          const finalPos = creatureFinalPosRef.current;
          const scale = activeCreature?.creature?.scale ?? null;
          const objSize = scale == null ? '-' : scale >= 1.5 ? 'Large' : scale >= 1.2 ? 'Midd' : 'Small';
          return (
            <View pointerEvents="none" style={{
              position: 'absolute', zIndex: 100,
              top: SCREEN_H / 2 - 50, left: 0, right: 0,
              alignItems: 'center',
            }}>
              <View style={{
                backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8,
                paddingHorizontal: 16, paddingVertical: 10, gap: 4,
              }}>
                <Text style={{ color: '#0f0', fontFamily: 'monospace', fontSize: 13 }}>
                  Scr-Size: {Math.round(debugVpW)} x {Math.round(debugVpH)}
                </Text>
                <Text style={{ color: '#0f0', fontFamily: 'monospace', fontSize: 13 }}>
                  Anm-POS: {Math.round(finalPos.left)} x {Math.round(finalPos.top)}
                </Text>
                <Text style={{ color: '#0f0', fontFamily: 'monospace', fontSize: 13 }}>
                  Obj-Size: {objSize}
                </Text>
              </View>
            </View>
          );
        })()
      )}

      {/* 設定オーバーレイ（Modal→絶対配置Viewに変更：fullScreen切替時の再アニメーション防止） */}
      {settingsVisible && (
        <View style={[styles.settingsContainer, styles.settingsOverlay]}>
          {/* ヘッダー */}
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsTitle}>設定</Text>
            <TouchableOpacity onPress={() => setSettingsVisible(false)}>
              <Text style={styles.settingsClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* テーマ（2行構成：1行目ラベル、2行目ドロップダウン） */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionLabel}>テーマ：</Text>
            {/* 2行目：現在のテーマ表示＋ドロップダウントグル（折りたたみ時は削除アイコンなし） */}
            <TouchableOpacity onPress={() => {
              const next = !themeDropdownOpen;
              playSE(next ? SE_OPEN_CABINET : SE_CLOSE_CABINET);
              setThemeDropdownOpen(next);
            }}>
              <View style={[styles.settingsRow, { marginTop: 6 }]}>
                <Text style={[styles.settingsRowLabel, { flex: 1 }]}>
                  {THEMES.find(t => t.id === theme)?.label}
                  {'  '}<Text style={{ fontSize: 12, color: '#aaa' }}>{themeDropdownOpen ? '▲' : '▼'}</Text>
                </Text>
              </View>
            </TouchableOpacity>
            {/* 展開時：アンロック済みテーマを固定順で表示（デフォルト以外に削除アイコン） */}
            {themeDropdownOpen && THEMES.filter(t => unlockedThemes.includes(t.id)).map(t => {
              const remaining = frameCounts[t.id] ?? 0;
              const isSelected = t.id === theme;
              return (
                <View key={t.id} style={[styles.themeRow, { paddingLeft: 12 }]}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => { playSE(SE_BUTTON01A); handleThemeChange(t.id); setThemeDropdownOpen(false); }}>
                    <Text style={styles.themeLabel}>{t.label}</Text>
                    <Text style={styles.themeFrameCount}>フレーム残り：{remaining}回</Text>
                  </TouchableOpacity>
                  {isSelected && <Text style={styles.themeCheck}>✓</Text>}
                  {t.id !== 'default' && (
                    <TouchableOpacity style={styles.themeDeleteBtn} onPress={() => handleThemeDelete(t.id)}>
                      <Text style={styles.themeDeleteText}>🗑</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          <View style={styles.settingsDivider} />

          {/* フレーム */}
          <View style={styles.settingsSection}>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsSectionLabel}>フレーム：</Text>
              <Text style={[styles.settingsRowLabel, { flex: 1 }]}>
                {frameEnabled ? 'あり' : 'なし'}
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
              <Text style={styles.settingsSectionLabel}>アルバムモード：</Text>
              <Text style={[styles.settingsRowLabel, { flex: 1 }]}>
                {saveMode === 'album' ? 'On（撮影上限あり）' : 'Off（撮影上限なし）'}
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
              <Text style={styles.settingsNote}>※ 写真へのアクセス許可がないため使用できません</Text>
            )}
          </View>

          {/* 自動削除（アルバムモードON時のみ） */}
          {saveMode === 'album' && (
            <>
              <View style={styles.settingsDivider} />
              <View style={styles.settingsSection}>
                <View style={styles.settingsRow}>
                  <Text style={styles.settingsSectionLabel}>自動削除：</Text>
                  <Text style={[styles.settingsRowLabel, { flex: 1 }]}>
                    {autoDelete ? '有効' : '無効'}
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
                    <Text style={styles.settingsSectionLabel}>自動で削除される写真：</Text>
                    <View style={[styles.settingsRow, { marginTop: 10, gap: 10 }]}>
                      <TouchableOpacity
                        style={[styles.autoDeleteBtn, autoDeleteTarget === 'newest' && styles.autoDeleteBtnActive]}
                        onPress={() => { playSE(SE_BUTTON01A); setAutoDeleteTarget('newest'); persistAutoDelete(autoDelete, 'newest'); }}
                      >
                        <Text style={[styles.autoDeleteBtnText, autoDeleteTarget === 'newest' && styles.autoDeleteBtnTextActive]}>最新の写真</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.autoDeleteBtn, autoDeleteTarget === 'oldest' && styles.autoDeleteBtnActive]}
                        onPress={() => { playSE(SE_BUTTON01A); setAutoDeleteTarget('oldest'); persistAutoDelete(autoDelete, 'oldest'); }}
                      >
                        <Text style={[styles.autoDeleteBtnText, autoDeleteTarget === 'oldest' && styles.autoDeleteBtnTextActive]}>最後の写真</Text>
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
              <Text style={styles.settingsSectionLabel}>カメラフレーム：</Text>
              <Text style={[styles.settingsRowLabel, { flex: 1 }]}>
                {fullScreen ? 'なし（全画面）' : 'あり'}
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
              <Text style={styles.settingsSectionLabel}>BGM：</Text>
              <Text style={[styles.settingsRowLabel, { flex: 1 }]}>
                {bgmEnabled ? 'あり' : 'なし'}
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
              <Text style={styles.settingsSectionLabel}>SE：</Text>
              <Text style={[styles.settingsRowLabel, { flex: 1 }]}>
                {seEnabled ? 'あり' : 'なし'}
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

          {/* 本番用一時非表示：デバッグ設定
          <View style={styles.settingsDivider} />
          <View style={styles.settingsSection}>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsSectionLabel}>デバッグ：</Text>
              <Text style={[styles.settingsRowLabel, { flex: 1 }]}>
                {debugMode ? 'On' : 'Off'}
              </Text>
              <Switch
                value={debugMode}
                onValueChange={(v) => setDebugMode(v)}
                trackColor={{ false: '#555', true: '#4CD964' }}
                thumbColor="#fff"
              />
            </View>
          </View>
          */}
        </View>
      )}

      {/* CreatureCameraアルバム一覧 */}
      <Modal visible={galleryVisible} animationType="none" transparent onRequestClose={closeGallery}>
        <Animated.View style={[styles.galleryModal, {
          transform: [{ translateY: gallerySlideY }],
          opacity: galleryOpacity,
        }]}>
          {/* ヘッダー */}
          <View style={[styles.galleryHeader, selectionMode && styles.galleryHeaderSelection]}>
            {selectionMode ? (
              // 選択モード中ヘッダー
              <>
                <TouchableOpacity onPress={exitSelectionMode}>
                  <Text style={styles.gallerySelectionExit}>選択解除</Text>
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
                  {saveMode === 'album' ? 'CreatureCamera' : 'カメラロール'}
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

          {/* グリッド */}
          <FlatList
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
                <>
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
                </>
              )}
            </Animated.View>
          )}
        </Animated.View>
      </Modal>

    </View>
  );
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
  // ── 削除確認UI ──
});

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npx expo start          # Start Expo dev server (scan QR with Expo Go)
npx expo start --ios    # iOS simulator
npx expo start --android # Android emulator
```

**Runtime constraint**: This app is tested exclusively via **Expo Go App Store version 54.0.2**, which locks the SDK to **Expo SDK 54**. Do not upgrade Expo SDK or use SDK 55+ APIs.

## Architecture

Single-file app: all logic lives in `App.js` (~939 lines). No navigation library, no state management library.

### Core feature flow

1. **Camera** (`CameraView` from expo-camera) fills the screen
2. A timer schedules random **creature appearances** every 2–8 seconds
3. A creature animates in → pauses → animates out; during the pause window, `capturableRef.current = true`
4. Tapping shutter: only allowed when `capturableRef.current` is true → takes photo → creates compositing view → `captureRef` (react-native-view-shot) → saves to MediaLibrary
5. Saved photos viewable in the built-in gallery modal

### Creature animation system

- `CREATURE_ANIM` map: each creature id → animation mode (`edge` | `edge3` | `top` | `fadein`)
- `CreatureOverlay` component handles all animation; uses `alive` flag + `stopAnimation()` in cleanup to prevent stale animation after theme switch
- `onCapturable` / `onUncapturable` callbacks control the capture window (timing-based, not area-based)
- `posRef` tracks live creature position for compositing

### Photo compositing (frame mode)

When `frameEnabled`, the compositing view layers:
1. Photo + creature at 90%x90% centered (offset by `SCREEN_W/H * 0.05`)
2. Frame image (`THEME_FRAMES[theme]`) at full `SCREEN_W x SCREEN_H` on top

The frame `Image` fires `onLoad` -> resolves `frameLoadResolveRef` -> then `captureRef` runs. Without waiting for `onLoad`, the frame renders black.

`setCompositing(null)` must be in the Alert OK handler (not `finally`) — otherwise the compositing view unmounts before the next photo can be composited.

### Gallery viewer (two-slot system)

- `slotX[0]` and `slotX[1]` are two persistent `Animated.Value`s for horizontal position
- `primarySlot` (state) and `primarySlotRef` (ref, synced every render) track which slot holds the current image
- On swipe transition: secondary slot gets new image + positioned off-screen, both slide simultaneously, then `primarySlot` swaps — no value reset needed, preventing the flash artifact
- `triggerTransitionRef.current` is reassigned every render to capture latest state (stale closure fix for PanResponder)

### iOS MediaLibrary caveat

`MediaLibrary.getAssetsAsync` returns `ph://` URIs on iOS, which `Image` cannot render. Must call `getAssetInfoAsync(asset)` to get `localUri` (`file://`). Assets without `localUri` are filtered out.

### Settings persistence

`AsyncStorage` key: `creature_camera_settings` -> `{ theme, albumMode, frameEnabled }`

Loaded on first media permission grant. If no saved settings and no existing album, asks user to create a "CreatureCamera" album.

## Key constants

| Constant | Value | Purpose |
|---|---|---|
| `ALBUM_NAME` | `'CreatureCamera'` | MediaLibrary album name |
| `SIZE_VARIANTS` | 5x1.0, 3x1.2, 2x1.5 | Creature size distribution |
| `EDGE_POOL` | top x1, bottom x3, left x3, right x3 | Edge appearance probability |
| Creature delay | 2000-8000 ms | Random interval between appearances |

## Assets

- `assets/frame-default.png` — creature frame (default theme)
- `assets/frame-flower.png` — floral frame (flower theme)
- `assets/frame-stylish.png` — fantasy frame (stylish theme)
- `assets/splash-icon.png` — splash screen (resizeMode: "cover", backgroundColor: "#1a0a00")

Note: Splash screen does not display in Expo Go — only in standalone builds.

## Hand over

- read most recently file in './claude/handsover' directory to hands over. 
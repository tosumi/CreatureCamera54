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

Single-file app: all logic lives in `App.js` (~1900 lines). No navigation library, no state management library.

### Core feature flow

1. **Camera** (`CameraView` from expo-camera) fills the screen
2. A timer schedules random **creature appearances** every 2–8 seconds (2-stage lottery: 5% special item, 95% normal creature)
3. A creature animates in → pauses → animates out; during the pause window, `capturableRef.current = true`
4. Tapping shutter: `isTakingPictureRef` guards against rapid taps; only proceeds when capturable (or harmony active) → takes photo → compositing view → `captureRef` (react-native-view-shot) → saves to MediaLibrary
5. Saved photos viewable in the built-in gallery modal

### Creature animation system

- `CREATURE_ANIM` map: each creature id → animation mode (`edge` | `edge3` | `top` | `fadein`)
- `CreatureOverlay` component handles all animation; uses `alive` flag + `stopAnimation()` in cleanup to prevent stale animation after theme switch
- `onCapturable` / `onUncapturable` callbacks set both `capturableRef` and `creatureCapturable` state (the latter drives ScopeOverlay)
- `posRef` tracks live creature position for compositing and scope tracking
- Left-edge creatures get `scaleX: -1` transform (both live and in compositing)
- Framed mode uses `clampBottom: true` viewport so bottom-entry creatures start at panel top edge

### Special items system

Two-stage lottery in `scheduleNextCreature`:
- 5% → special item (`isSpecial: true, itemType, itemLabel` on `activeCreature`)
- 95% → normal creature

4 item types (weighted: 10/40/20/30%):

| Item | Effect |
|---|---|
| 🎁 新テーマ (`theme`) | Unlock random locked theme; if frame count < 5, reset to 5 |
| 🌟 フレーム+5 (`frame`) | Current theme frame count +5 (max `FRAME_MAX=20`) |
| 🎊 和気あいあい (`harmony`) | Activates `harmonyActive`; next shutter press adds 4 extra creatures to photo at 90° rotated positions |
| 🔭 スコープ (`scope`) | Activates `scopeActive`; shows `ScopeOverlay` that floats → tracks creature → double-pulse zoom on capturable |

Harmony rules:
- Invalid (not consumed) when special item is captured
- Count decrements on any shutter press, even without a capturable creature
- 4 extra creature positions: 90°/180°/270°/360° rotation of main creature pos relative to screen center; out-of-bounds positions randomized
- `harmonyEntries: [{ creature, pos }]` stored in compositing state

Scope rules:
- `ScopeOverlay` mounts with `key={activeCreature.key}` (remounts per creature)
- Phase: `float` (drift) → `track` (follow creature at 150ms intervals) → `zoom` (1.9×pulse×2 then fade) → `done`
- Only consumed (`scopeActive=false`) when a normal creature is captured while scope is active (`wasScope` field in compositing state)

Effects applied in save Alert OK handler (after `setCompositing(null)`) via `setTimeout(..., 100)`.

### Photo compositing

When `frameEnabled` and frame count > 0, layers:
1. Photo + creature (+ harmony creatures) at 90%×90% centered (offset by `SCREEN_W/H * 0.05`)
2. Frame image (`THEME_FRAMES[theme]`) at full size on top

Frame `Image` fires `onLoad` → resolves `frameLoadResolveRef` → then `captureRef` runs (black frame if skipped).

`setCompositing(null)` must be in the Alert OK handler (not `finally`).

`isTakingPictureRef` set `true` at shutter press, reset `false` in save Alert OK handler and all error catch blocks.

### Album limit enforcement

After each save (album mode only):
- Fetch album count; if > `PHOTO_LIMIT`:
  - `skipOverflowAlertRef.current = true` to suppress startup-overflow useEffect
  - Set `overflowMode = true` (enables OVERFLOW_LIMIT fetch + blocks gallery close)
  - Show "アルバムがいっぱいです" alert → OK → `openGallery()`

Startup overflow check (album mode only): `checkAlbumLimitAtStartup` → `setOverflowMode(true)` → useEffect shows alert → `openGallery()`.

`closeGallery` blocks close while `overflowModeRef.current && galleryCount > PHOTO_LIMIT` (album mode only).

### Gallery viewer (two-slot system)

- `slotX[0]` and `slotX[1]` are two persistent `Animated.Value`s for horizontal position
- `primarySlot` (state) and `primarySlotRef` (ref, synced every render) track which slot holds the current image
- On swipe: secondary slot positioned off-screen, both slide simultaneously, then `primarySlot` swaps — prevents flash artifact
- `triggerTransitionRef.current` reassigned every render (stale closure fix for PanResponder)
- Viewer close: do NOT call `setValue` in `closeViewer` callback — causes native flash before React unmount; only reset in `openViewer`

### Photo protection

- `savedPhotoIds` (`AsyncStorage` key `@creature_camera_saved_photos`): `{ [assetId]: true }`
- Max `PROTECT_LIMIT=15` protected photos
- Grid badge: gold circle + white ★; selection header icons: ⭐ (protect) / ☆ (unprotect, gold color)
- Protected photos cannot be deleted

### iOS MediaLibrary caveat

`getAssetsAsync` returns `ph://` URIs; must call `getAssetInfoAsync(asset).localUri` for `file://`. Assets without `localUri` filtered out.

### Settings persistence

`AsyncStorage` key `creature_camera_settings` → `{ theme, albumMode, frameEnabled, fullScreen, unlockedThemes, frameCounts }`

Initial values (no saved settings): `unlockedThemes: ['default']`, `frameCounts: { default: 5, others: 0 }`, `fullScreen: false`.

## Key constants

| Constant | Value | Purpose |
|---|---|---|
| `PHOTO_LIMIT` | 20 | Album photo cap |
| `OVERFLOW_LIMIT` | 50 | Fetch limit in overflow mode |
| `PROTECT_LIMIT` | 15 | Max protected photos |
| `FRAME_MAX` | 20 | Max frame uses per theme |
| `SPECIAL_ITEM_CHANCE` | 0.05 | Special item appearance rate |
| `CAMERA_AREA_H` | `SCREEN_H * 0.8` | Framed mode camera height |
| `PANEL_H` | `SCREEN_H * 0.2` | Framed mode control panel height |

## Z-index order (framed mode)

`controlPanel` (30) > camera finder (20) > `ScopeOverlay` (15) > creatures (10) > camera (0)

## Themes and assets

6 themes: `default`, `flower`, `stylish`, `ocean`, `forest`, `savanna` — all defined in `THEMES` and `CREATURE_SETS`.

Frame images: `assets/frame-{theme}.png` for all 6 themes.
Camera finder overlay: `assets/camera-finder.png` (hidden during compositing).
Splash: `assets/splash-icon.png` (resizeMode: "cover", backgroundColor: "#1a0a00") — only in standalone builds.

## Stale closure patterns

- `useCallback([])` functions access current values via refs: `saveModeRef`, `overflowModeRef`, `galleryCountRef`, `selectedPhotoIdsRef`, `savedPhotoIdsRef`, `harmonyActiveRef`, `scopeActiveRef`
- All refs synced every render in the body of `App()`

## Hand over

- Read the most recent file in `./claude/` directory for session context.

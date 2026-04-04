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

- このアプリは、カメラで「ちょっと変わった」生き物を撮影するアプリです。
- 「ちょっと変わった生き物」は、時々カメラに映り込んだりします。
- 中には、撮影をちょっと楽しくしてくれる、アイテムが撮影できる場合があります。
- 変わった生き物たちと一緒に、テーマに合ったフレームで楽しい写真を撮影しましょう。

## Hand over

- Read the most recent file in `.\.claude` directory for session context.

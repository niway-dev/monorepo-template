---
name: verify
description: Run when the user or another agent says "verify" or names verify. Also use when a PR to the mobile app needs proof rows: screenshots or video of a criterion on the simulator.
---

# Verify (mobile app)

## When to use

- A PR touches `apps/mobile` (or `apps/mobile-convex`) and its `## Proof` table needs evidence.
- Someone says "verify" and wants to see the change working on the real app, not only tests.

## Overview

A `verify` skill is a feature map: each scenario is one command that drives the real app on the iOS
simulator and writes a screenshot and a video into a gitignored folder. The PR's proof table links
those files. Pipeline context:
[development-pipeline](https://github.com/csdev19/general-knowledge/blob/main/conventions/development-pipeline.md).
Driver today: `xcrun simctl` plus Expo Go. Maestro replaces it later (see "Next: Maestro").

## How to run a scenario

1. Run from the repo root: `apps/mobile/scripts/verify.sh <scenario>` (see the map below).
2. First run downloads Expo Go (about 100 MB, cached in `~/.cache/verify-expo-go`), boots
   `iPhone 17 Pro` and starts Metro. It needs network, Xcode and no credentials. It shuts down what
   it started.
3. Read the output files: `apps/mobile/.verify/<scenario>/screenshot.png` and `video.mov`. Open the
   screenshot and look at it. The command succeeding does not mean the screen is right.
4. Put the paths (or uploaded links) in the PR's `## Proof` row for that criterion.

Env knobs: `VERIFY_DEVICE`, `VERIFY_TARGET=dev-build` (installed build, opened by its `app.json`
scheme), `VERIFY_PORT`, `VERIFY_SETTLE` (seconds to wait per navigation, raise it on a cold
bundle), `VERIFY_KEEP_SIM=1`. `EXPO_PUBLIC_API_URL` defaults to `http://localhost:8787`; no backend
is needed for the auth screens.

## Feature map

| Scenario  | What it shows                                                                                | Command                                 | Artifacts                                   |
| --------- | -------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------- |
| `launch`  | Cold start: the app opens on the sign-in screen (unauthenticated users are redirected there) | `apps/mobile/scripts/verify.sh launch`  | `.verify/launch/{screenshot.png,video.mov}` |
| `sign-in` | Deep link to `/sign-in`                                                                      | `apps/mobile/scripts/verify.sh sign-in` | `.verify/sign-in/...`                       |
| `sign-up` | Deep link to `/sign-up`                                                                      | `apps/mobile/scripts/verify.sh sign-up` | `.verify/sign-up/...`                       |

The tabs (`/`, `/stats`, `/profile`) and `/modal` sit behind the auth redirect; they need a signed-in
session and a backend, so they have no scenario yet.

## How to add a scenario

1. Add a case in `verify.sh` mapping the name to its route(s), in `ROUTES`.
2. Add a row to the map above and run it for real before you commit it.
3. Keep one scenario per criterion; do not chain unrelated screens into one video.

## Next: Maestro

Maestro was not installed when this was written, and nothing here uses it. Once it is, Maestro
flows (`takeScreenshot`, `startRecording` / `stopRecording`) should replace the deep-link driver for
taps and forms, and the whole auth flow becomes testable. Keep each flow next to its scenario row.

## Common mistakes

- Treating exit code 0 as proof. Look at the screenshot: it can show the wrong route or an overlay.
- Known blocker: the first launch in a fresh Expo Go shows a "developer menu" sheet over the app,
  and `simctl` cannot tap to dismiss it (setting `EXDevMenuIsOnboardingFinished` in the app's
  preferences did not work). Until Maestro or a dev build removes it, screenshots carry that sheet.
- `simctl openurl` on Expo Go raises an "Open in Expo Go?" prompt that cannot be tapped; the script
  avoids it by passing the URL as a launch argument. In that mode the route path was not confirmed
  to be honored: the `sign-up` run still showed the sign-in screen. Check every route screenshot.
- `expo start --ios` fails when Simulator.app is missing from Xcode; the script installs Expo Go
  itself.
- Committing `.verify/`: it is gitignored; link artifacts from the PR instead.

## Before reporting

- List the files with sizes and say which screen each shows.
- Say what you saw, not what the command printed; name overlays or wrong routes.
- Confirm the simulator and Metro are stopped (`xcrun simctl list devices booted`).

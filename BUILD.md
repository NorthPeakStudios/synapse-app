# How Synapse is built

## The pieces
- **The web app** lives on the website (https://odin-cards.sites.tab.bot). Every change to it gets published there first.
- **This project** is a thin native shell (Capacitor 8) for **Android** (`android/`) and **iOS** (`ios/`), plus:
  - `native/boot.js`: starts the app and applies downloaded updates (see "Live updates").
  - Native features, all in the web file `native/app.js` on the site:
    - **Study reminders:** local notifications. Settings → Notifications → Daily study reminder, with a time and the number of cards due. These replace web push inside the app.
    - **Haptics:** real taps through the phone's haptic engine.
    - **Status bar:** colours follow the light/dark theme.
    - **Android back button:** closes sheets and search, goes back a screen, then minimizes the app.
    - **Export my data:** saves through the system share sheet.
    - **Splash screen and app icon:** drawn for the app.
- **Bundled offline:** the whole web app (about 950 files, 135 MB, including the 3D anatomy models, the 200 courses and the OCR engine) is packed inside the app, so it works with no signal. It is not a thin wrapper around a URL.

## Building (cloud only, no Mac or Android Studio needed)
The workflows in `.github/workflows/` do everything on GitHub's free runners:

| Workflow | Runner | Output |
|---|---|---|
| `Android (Google Play)` | Ubuntu | `.aab` for Google Play and a signed `.apk` to install directly. With no upload key set up yet, it builds a debug `.apk` only. |
| `Make upload key (run once)` | Ubuntu | The Play upload key and its password, as a 1-day artifact. |
| `iOS unsigned IPA (sideload)` | macOS | `Synapse-unsigned.ipa` (see SIDELOAD.md) |

Every build does the same steps:
1. `npm ci`
2. `node scripts/fetch-web.mjs [--store]` downloads every file listed in the site's `app-update.json` into `www/` and checks each SHA-256. A mismatch stops the build, so a half-published site never gets packaged.
3. `npx cap sync <platform>`
4. `node scripts/apply-native.mjs` re-applies Synapse's native settings (see below). It changes nothing when they are already in place.
5. Gradle or xcodebuild.

**Version numbers.** The Android `versionCode` is the workflow run number, so it goes up automatically. You type the `versionName` (for example 1.0.0) when you start the run.

### Upload key (Android, one time)
1. Actions → **Make upload key (run once)** → Run workflow.
2. Download the `synapse-upload-key` artifact and keep `upload.jks` and the password somewhere safe, outside the repo.
3. Repo **Settings → Secrets and variables → Actions** → add two secrets:
   - `ODIN_KEYSTORE_BASE64`: the text of `ODIN_KEYSTORE_BASE64.txt`
   - `ODIN_KEYSTORE_PASSWORD`: the text of `ODIN_KEYSTORE_PASSWORD.txt`
4. Delete the downloaded files. From now on, **Android (Google Play)** produces a signed `.aab`.

Keep the repository **private**. Artifacts in a public repo can be downloaded by anyone.

## Native settings (scripts/apply-native.mjs)
Everything that makes the Android and iOS projects "Synapse" instead of a blank Capacitor app is re-applied by one script, so the `android/` and `ios/` folders can be thrown away and regenerated at any time:

    rm -rf android ios
    npx cap add android && npx cap add ios
    node scripts/fetch-web.mjs --store && npx cap sync
    node scripts/apply-native.mjs          # or: npm run native
    node scripts/apply-native.mjs --check  # report only; exits 1 if anything is missing

What it sets:
- **Name and id:** "Synapse", `com.northpeakstudios.synapse` (capacitor.config.json, Android namespace/applicationId/strings, iOS bundle id and display name).
- **Version and signing (Android):** `versionCode`/`versionName` from the workflow, and the Play upload key from the repository secrets.
- **Icons and splash:** launcher icons (normal, round and adaptive), the adaptive icon background, splash screens, the white notification icon `ic_stat_icon` (Android); the 1024 app icon and splash (iOS). The images live in `native/res/` and are copied in.
- **System bars:** dark launch screen and window background (no white flash), transparent status bar, dark navigation bar.
- **Permissions:** microphone (speaking features, asked only when used), notifications (study reminders), Google Play billing (Synapse Pro).
- **iOS privacy strings:** microphone, speech recognition, camera and photos, plus `ITSAppUsesNonExemptEncryption = false`.

Haptics, status bar style, reminders and the back button are handled by `native/app.js` on the website, so they need no native change.

## Store mode vs personal build
`fetch-web.mjs --store` sets `store: true` in `www/native/config.js`. A store build:
- hides **Me** (Odin's personal page) and **Tab's Work** (a personal Google Drive folder) everywhere: Home, More, search and the Home Screen settings;
- only lists Deck Library decks that carry an open licence (see LICENSES.md).

- turns on the **Synapse Pro** paywall (see below).

Everything else is identical. Google Play builds default to store mode. The iPhone sideload build defaults to the personal build, because it's just for Odin.

## Synapse Pro (paywall, Google Play build only)
- **Where it is on:** only when `www/native/config.js` says `store: true` (the Google Play build). On the website and in the sideload `.ipa` the paywall code does nothing at all: no locks, no screen, no listeners, everything unlocked.
- **One config file:** `feat/pro/pro-config.js` on the website holds the product ID, the placeholder price, the free vs Pro split and the web-sale settings (off; see SELL-ONLINE.md). Because it is a web file, a change there reaches installed apps by live update. The real price always comes from Google Play when the app can reach it; the placeholders are only shown before that.
- **Product** (one only; create it in Play Console with exactly this ID): `synapse_pro_lifetime`, in-app product (one-time, non-consumable), **$35.00**. Synapse Pro is a one-time lifetime unlock: no subscriptions, no trial.

- **Free:** your own decks, studying (spaced repetition), stats and Weak Spots, the daily challenge, the daily Doctordle case, the first level ("Like I'm 5") of every course with its tests, and 3 Lab tools (Drug class matcher, Medical word builder, Vitals interpreter).
- **Pro:** every course level and test (all 200 courses), the rest of the Lab (patient sims, ECG, CT/MRI, Anatomy 3D, heart and lung sounds, and more), the Deck Library, Anki import, image occlusion, unlimited Doctordle, themes and alternate app icons.
- **How it works:** Google Play Billing through the open-source plugin `@capgo/native-purchases` (MPL-2.0). No RevenueCat or any other account. Locked rows show a small lock; tapping one opens the paywall instead. Settings has a **Synapse Pro** row. The paywall has Restore purchases, Terms, Privacy and "Cancel anytime in Google Play". Purchases are acknowledged automatically (Google refunds unacknowledged ones after 3 days).
- **Entitlement:** read from Google Play at launch and when the app returns to the foreground, then cached on the phone. Synapse Pro is a one-time lifetime unlock, so it stays unlocked offline.
- **Server check (optional, later):** v1 trusts Google Play on the device, which is normal for a small app. To harden it later, add a Worker route such as `POST /api/pro/play-verify` (note: `/api/pro/verify` is taken by the web unlock codes) that calls the Google Play Developer API (`purchases.subscriptionsv2.get` / `purchases.products.get`) with a service account. The key must stay on the server, never in the app.
- **Testing:** in Play Console add **license testers** (Setup → License testing). Their purchases are free test purchases. Purchases only work in a build installed from a Play testing track, not a sideloaded APK.

## Live updates (no new download for web changes)
The app checks `https://odin-cards.sites.tab.bot/app-update.json` 8 seconds after launch (at most hourly), when it comes back to the foreground (if the last check was 6+ hours ago), and when you tap **Settings → About → Check for updates**.

- **What it does:**
  1. Compares the update list with the files built into the app.
  2. Downloads only the files that changed.
  3. Checks each one's SHA-256.
  4. Stages them for the next launch.
- **What it never does:** replace the built-in copy. Downloaded files sit beside it and are used instead of the old ones.
- **Rollback:** if an update starts twice without reaching the Home screen, the app goes back to the previous version (or the built-in one) and skips that update. **Settings → About → Use the built-in version** does the same by hand.
- **How changed files get used:** `index.html` is kept in local storage; scripts, styles and data the app fetches load from the downloaded copy; everything unchanged loads from inside the app.

| Arrives by live update (no new .aab/.ipa) | Needs a new build from the workflows |
|---|---|
| Any change to screens, features, courses, decks, cases, styles, texts, bug fixes, the Pro prices or free/Pro split (`feat/pro/pro-config.js`) | New native plugin, new permission, app icon, splash, app name or id |
| New Lab tools and new course JSON | Changes to `native/boot.js` or `capacitor.config.json` |
| Changes to `native/app.js` (reminders, haptics, updater) | Raising the minimum native build (`minNative` in app-update.json) |

**Limit:** a brand-new image or sound file that a screen shows directly (not through `fetch`) is only in the next build. Until then the app falls back to what's built in.

**For whoever publishes the website:** after every change, regenerate the update list before publishing:

    node tools/make-app-update.mjs <site-dir>

If you skip this, the updater sees wrong checksums and safely refuses the update, and cloud builds fail at step 2 until it is regenerated.

## Local commands (optional, need Node 22)
    npm ci
    node scripts/fetch-web.mjs --store   # or without --store
    npx cap sync
    node scripts/apply-native.mjs

Opening the projects needs Android Studio (`npx cap open android`) or a Mac with Xcode. Neither is required, because the workflows build everything.

## Notes
- **The server:** the app talks to the same API as the website (`/api/*` on odin-cards.sites.tab.bot), which allows the app's origins (`capacitor://localhost`, `https://localhost`). Sync codes, share links and the pairing link point at the website, so they keep working between the app and the web.
- **Speech:** hands-free review uses the phone's speech service. Android's in-app browser engine has no built-in speech recognition, so answering out loud may show "not supported" on Android. Text-to-speech, voice notes and everything else work. Check on a real device before release.
- **Permissions:**
  - Microphone: only asked when you tap a hands-free review or voice-note feature.
  - Notifications: only asked when you turn reminders on.
  - Camera and photos (iOS): wording is included because the "Snap a page" picker can offer them.

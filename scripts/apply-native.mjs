#!/usr/bin/env node
// Re-applies Synapse's native customizations to the Android and iOS projects.
// Safe to run any number of times (it only changes what is not already right).
// Run it after `npx cap add android|ios` (fresh platforms) and after `npx cap sync`:
//   node scripts/apply-native.mjs            both platforms
//   node scripts/apply-native.mjs --check    report only, change nothing (exit 1 if something is off)
// What it sets: app name "Synapse", id com.northpeakstudios.synapse, version from CI, Play upload signing,
// permissions (microphone for speaking features, notifications for study reminders, Google Play billing),
// launcher icons, adaptive icon background, splash screens, the notification icon, dark system bars,
// iOS display name, bundle id, privacy usage strings and the export-compliance flag.
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const APP_ID = 'com.northpeakstudios.synapse', APP_NAME = 'Synapse', BG = '#0c0e13', ICON_BG = '#151922';
let changed = 0, problems = 0;
const log = (m) => console.log(m);
const rel = (p) => relative(ROOT, p);
function put(file, text) {
  const old = existsSync(file) ? readFileSync(file, 'utf8') : null;
  if (old === text) return;
  if (CHECK) { problems++; log('  needs update: ' + rel(file)); return; }
  mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); changed++; log('  updated ' + rel(file));
}
function edit(file, fn) { if (!existsSync(file)) { problems++; log('  MISSING ' + rel(file)); return; } put(file, fn(readFileSync(file, 'utf8'))); }
const sha = (b) => createHash('sha256').update(b).digest('hex');
function copyTree(src, dst) {
  if (!existsSync(src)) { problems++; log('  MISSING ' + rel(src)); return; }
  for (const n of readdirSync(src)) {
    const s = join(src, n), d = join(dst, n);
    if (statSync(s).isDirectory()) { copyTree(s, d); continue; }
    if (existsSync(d) && sha(readFileSync(s)) === sha(readFileSync(d))) continue;
    if (CHECK) { problems++; log('  needs update: ' + rel(d)); continue; }
    mkdirSync(dirname(d), { recursive: true }); copyFileSync(s, d); changed++;
  }
}
const ensureLine = (text, needle, line, before) => text.includes(needle) ? text : text.replace(before, line + '\n' + before);

/* ---------------- capacitor.config.json ---------------- */
log('capacitor.config.json');
edit(join(ROOT, 'capacitor.config.json'), (t) => { const c = JSON.parse(t); c.appId = APP_ID; c.appName = APP_NAME; return JSON.stringify(c, null, 2) + '\n'; });

/* ---------------- Android ---------------- */
const A = join(ROOT, 'android');
if (existsSync(A)) {
  log('android');
  const RES = join(A, 'app/src/main/res');
  copyTree(join(ROOT, 'native/res/android'), RES);   // launcher icons (normal, round, adaptive foreground), splash, ic_stat_icon

  put(join(RES, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${ICON_BG}</color>\n</resources>\n`);
  put(join(RES, 'values/synapse_colors.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="synapse_bg">${BG}</color>\n    <color name="colorPrimary">#0A84FF</color>\n    <color name="colorPrimaryDark">${BG}</color>\n    <color name="colorAccent">#0A84FF</color>\n</resources>\n`);
  edit(join(RES, 'values/strings.xml'), (t) => {
    const set = (k, v) => { const re = new RegExp(`(<string name="${k}">)[^<]*(</string>)`); t = re.test(t) ? t.replace(re, `$1${v}$2`) : t.replace('</resources>', `    <string name="${k}">${v}</string>\n</resources>`); };
    set('app_name', APP_NAME); set('title_activity_main', APP_NAME); set('package_name', APP_ID); set('custom_url_scheme', APP_ID); return t;
  });
  edit(join(RES, 'values/styles.xml'), (t) => {
    // dark launch + window background (no white flash), dark navigation bar, transparent status bar (the web app draws under it)
    const add = (style, items) => {
      const re = new RegExp(`(<style name="${style.replace('.', '\\.')}"[^>]*>)([\\s\\S]*?)(</style>)`);
      const m = t.match(re); if (!m) return;
      let body = m[2];
      for (const [k, v] of items) {
        const ire = new RegExp(`<item name="${k}">[^<]*</item>`);
        body = ire.test(body) ? body.replace(ire, `<item name="${k}">${v}</item>`) : body.replace(/\s*$/, `\n        <item name="${k}">${v}</item>\n    `);
      }
      t = t.replace(re, `$1${body}$3`);
    };
    add('AppTheme.NoActionBar', [['android:windowBackground', '@color/synapse_bg'], ['android:statusBarColor', '@android:color/transparent'], ['android:navigationBarColor', '@color/synapse_bg'], ['android:windowLightStatusBar', 'false']]);
    add('AppTheme.NoActionBarLaunch', [['windowSplashScreenBackground', '@color/synapse_bg'], ['windowSplashScreenAnimatedIcon', '@mipmap/ic_launcher_foreground'], ['postSplashScreenTheme', '@style/AppTheme.NoActionBar']]);
    return t;
  });
  edit(join(A, 'app/build.gradle'), (t) => {
    t = t.replace(/namespace\s*=\s*"[^"]*"/, `namespace = "${APP_ID}"`).replace(/applicationId\s+"[^"]*"/, `applicationId "${APP_ID}"`);
    t = t.replace(/versionCode\s+\d+\s*\n/, '// CI sets ODIN_VERSION_CODE (must go up for every Play upload) and ODIN_VERSION_NAME\n        versionCode (System.getenv("ODIN_VERSION_CODE") ?: "1") as Integer\n')
         .replace(/versionName\s+"[^"]*"\s*\n/, 'versionName System.getenv("ODIN_VERSION_NAME") ?: "1.0.0"\n');
    if (!t.includes('signingConfigs')) {
      t = t.replace(/(\n\s*buildTypes\s*\{)/, `
    signingConfigs {
        // Upload key for Google Play. CI writes the keystore from a GitHub secret; see BUILD.md.
        release {
            def ks = System.getenv("ODIN_KEYSTORE_FILE")
            if (ks != null && file(ks).exists()) {
                storeFile file(ks)
                storePassword System.getenv("ODIN_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ODIN_KEY_ALIAS") ?: "upload"
                keyPassword System.getenv("ODIN_KEY_PASSWORD") ?: System.getenv("ODIN_KEYSTORE_PASSWORD")
            }
        }
    }$1`);
    }
    if (!t.includes('signingConfig signingConfigs.release')) t = t.replace(/(release\s*\{\s*\n)(\s*)(minifyEnabled)/, `$1$2if (System.getenv("ODIN_KEYSTORE_FILE") != null) signingConfig signingConfigs.release\n$2$3`);
    return t;
  });
  edit(join(A, 'app/src/main/AndroidManifest.xml'), (t) => {
    const perms = [
      ['android.permission.RECORD_AUDIO', 'speaking, dictation and voice-note features (asked only when used)'],
      ['android.permission.MODIFY_AUDIO_SETTINGS', ''],
      ['android.permission.POST_NOTIFICATIONS', 'study reminders'],
      ['com.android.vending.BILLING', 'Synapse Pro purchases through Google Play (only used by the Play build)']
    ];
    for (const [p, why] of perms) if (!t.includes(`"${p}"`)) t = t.replace('</manifest>', `${why ? `    <!-- ${why} -->\n` : ''}    <uses-permission android:name="${p}" />\n</manifest>`);
    return t;
  });
  // MainActivity must live in the app id's package (cap add does this from capacitor.config.json)
  const ma = join(A, 'app/src/main/java', ...APP_ID.split('.'), 'MainActivity.java');
  if (!existsSync(ma)) { problems++; log('  MISSING ' + rel(ma) + ' (run: rm -rf android && npx cap add android, then this script)'); }
  else if (!readFileSync(ma, 'utf8').includes(`package ${APP_ID};`)) { problems++; log('  WRONG package in ' + rel(ma)); }
}

/* ---------------- iOS ---------------- */
const I = join(ROOT, 'ios/App');
if (existsSync(I)) {
  log('ios');
  copyTree(join(ROOT, 'native/res/ios'), join(I, 'App/Assets.xcassets'));   // 1024 app icon + splash
  edit(join(I, 'App.xcodeproj/project.pbxproj'), (t) => t.replace(/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g, `PRODUCT_BUNDLE_IDENTIFIER = ${APP_ID};`));
  edit(join(I, 'App/Info.plist'), (t) => {
    const setStr = (k, v) => {
      const re = new RegExp(`(<key>${k}</key>\\s*<string>)[^<]*(</string>)`);
      t = re.test(t) ? t.replace(re, `$1${v}$2`) : t.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>${k}</key>\n\t<string>${v}</string>\n</dict>\n</plist>\n`);
    };
    setStr('CFBundleDisplayName', APP_NAME);
    setStr('NSMicrophoneUsageDescription', 'Synapse uses the microphone when you tap a speaking, dictation or voice-note feature.');
    setStr('NSSpeechRecognitionUsageDescription', 'Synapse turns what you say into text to check your pronunciation and answers.');
    setStr('NSCameraUsageDescription', 'Take a photo of a page or diagram to turn it into flashcards.');
    setStr('NSPhotoLibraryUsageDescription', 'Pick a photo of a page or diagram to turn it into flashcards.');
    if (!t.includes('<key>ITSAppUsesNonExemptEncryption</key>')) t = t.replace(/<\/dict>\s*<\/plist>\s*$/, '\t<key>ITSAppUsesNonExemptEncryption</key>\n\t<false/>\n</dict>\n</plist>\n');
    return t;
  });
  // sideload build: light status bar text at launch (the page then follows its theme), arm64 only,
  // and permission to check whether SideStore is installed (re-sign reminder, native/resign.js)
  edit(join(I, 'App/Info.plist'), (t) => {
    t = t.replace('<string>armv7</string>', '<string>arm64</string>');
    if (!t.includes('<key>UIStatusBarStyle</key>')) t = t.replace(/<\/dict>\s*<\/plist>\s*$/, '\t<key>UIStatusBarStyle</key>\n\t<string>UIStatusBarStyleLightContent</string>\n</dict>\n</plist>\n');
    if (!t.includes('<key>LSApplicationQueriesSchemes</key>')) t = t.replace(/<\/dict>\s*<\/plist>\s*$/, '\t<key>LSApplicationQueriesSchemes</key>\n\t<array>\n\t\t<string>sidestore</string>\n\t\t<string>altstore</string>\n\t</array>\n</dict>\n</plist>\n');
    return t;
  });
  // root view = MainViewController (AppDelegate.swift): edge-to-edge web view + the SynapseSigning plugin
  edit(join(I, 'App/Base.lproj/Main.storyboard'), (t) => t.replace('customClass="CAPBridgeViewController" customModule="Capacitor"', 'customClass="MainViewController" customModule="App" customModuleProvider="target"'));
  { const ad = join(I, 'App/AppDelegate.swift'); if (existsSync(ad) && !readFileSync(ad, 'utf8').includes('class MainViewController')) { problems++; log('  AppDelegate.swift is missing MainViewController / SynapseSigningPlugin (restore it from git)'); } }
}

if (CHECK) { log(problems ? `${problems} thing(s) need applying. Run: node scripts/apply-native.mjs` : 'All native customizations are in place.'); process.exit(problems ? 1 : 0); }
log(problems ? `Done with ${problems} problem(s) above.` : `Done. ${changed} file(s) changed.`);
process.exit(problems ? 1 : 0);

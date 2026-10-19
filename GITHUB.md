# Put Synapse on GitHub and run the builds (about 15 minutes)

GitHub accounts are allowed from age 13, so Odin can own this himself. Everything here is free. The builds run on GitHub's computers, so no Mac and no Android Studio are needed.

## 1. Account
1. Go to https://github.com/signup and make an account. Use your own email and turn on two-factor authentication. Optional: name it after the studio, e.g. `northpeakstudios`.

## 2. Make a private repository
1. Click **+** (top right) → **New repository**.
2. Name it `synapse-app` and choose **Private**. This matters: the build outputs and the Android upload key must not be public.
3. Don't add a README. Click **Create repository**.

## 3. Upload the project (GitHub Desktop is easiest on Windows)
1. Install **GitHub Desktop** from https://desktop.github.com and sign in.
2. Unzip `synapse-app.zip` somewhere easy, e.g. `Documents\synapse-app`.
3. In GitHub Desktop: **File → Add local repository**, then choose that folder. When it says "this directory does not appear to be a Git repository", click **create a repository**, then **Create repository**.
4. Click **Publish repository**. Keep **"Keep this code private"** ticked, pick your account, then **Publish**.
   - If it says the repo already exists (from step 2), use **Repository → Repository settings → Remote** and paste the URL GitHub showed you, then **Push origin**.
5. Check on github.com that you see the folders `.github`, `android`, `ios`, `native`, `scripts`, `store` and the `.md` files. There is no `node_modules` or `www`; the builds make those.

## 4. Turn on Actions
Open the repo on github.com → **Actions** tab → click **"I understand my workflows, go ahead and enable them"** if it asks.

## 5. Build the iPhone app (.ipa)
1. **Actions** → **iOS unsigned IPA (sideload)** → **Run workflow** → leave "Store build" off → **Run workflow**.
2. Wait about 10–15 minutes for the green check.
3. Open the run → scroll to **Artifacts** → download **Synapse-unsigned-ipa** (a .zip). Unzip it to get `Synapse-unsigned.ipa`.
4. Install it with SIDELOAD.md.

## 6. Build the Android app
1. First time only: **Actions** → **Make upload key (run once)** → Run. Download the artifact and follow `KEY-README.txt` inside it to add the two secrets. Keep `upload.jks` and the password safe.
2. **Actions** → **Android (Google Play)** → **Run workflow** → version name `1.0.0`, Store build on → **Run workflow**.
3. Download the artifact. It holds:
   - `app-release.aab`, which goes to Google Play;
   - `app-release.apk`, which installs directly on any Android phone for testing.

## 7. Updating later
- **Website changes reach the installed apps by themselves.** The app downloads them and applies them the next time it opens, so most updates need no new build.
- Rebuild only for native changes (see the table in BUILD.md):
  1. Replace the changed files in your folder.
  2. In GitHub Desktop, **Commit to main** → **Push origin**.
  3. Run the workflow again.
- Each Android run gets a higher version code automatically. Raise the version name yourself (1.0.1, 1.1.0 …).

## Free minutes
Private repos get 2,000 free Actions minutes a month.
- **Android:** a build is about 8–12 minutes.
- **iOS:** macOS minutes count 10×, so one iOS build uses about 100–150 of the 2,000. Roughly 10 iOS builds a month fit. Because web changes arrive by live update, you rarely need a new one.

# Put Synapse on your iPhone from a Windows laptop (free Apple ID)

You need:
- the `.ipa` from GITHUB.md step 5;
- your iPhone 16 and its USB-C cable;
- the Windows laptop;
- an Apple ID (yours is fine).

No paid developer account. Apple's free signing has two limits:
- **The app stops opening after 7 days.** Re-sign it (step 6) and your cards stay.
- **Max 3 sideloaded apps per Apple ID at once.**

## 1. Install Apple's drivers (direct downloads, NOT the Microsoft Store versions)
The sideloading tool needs the classic desktop versions:
- **iTunes for Windows (64-bit):** from apple.com/itunes → "Looking for other versions?" → Windows. Get the direct `.exe` installer, not the Microsoft Store link.
- **iCloud for Windows:** the direct `.exe` installer from Apple's support download page, not the Microsoft Store.

If you already have the Microsoft Store versions, uninstall them first, then install these. Restart the laptop.

## 2. Install the sideloading tool
Install **Sideloadly** for Windows from its official site (sideloadly.io). AltStore's "AltServer for Windows" also works the same way, but these steps use Sideloadly.

## 3. Connect the iPhone
1. Plug the iPhone into the laptop and unlock it.
2. Tap **Trust** on the iPhone and enter your passcode.
3. Open iTunes once and check that it sees the phone, then close it.

## 4. Sign and install
1. Open Sideloadly. Your iPhone should appear under **iDevice**.
2. Drag `Synapse-unsigned.ipa` onto the Sideloadly window.
3. Type your Apple ID email under **Apple account** → **Start**. Enter your Apple ID password when asked.
   - Sideloadly sends it only to Apple to make a free signing certificate.
   - If your Apple ID is a child account in Family Sharing and Apple refuses it, a parent can sign in with their Apple ID instead.
4. If Apple sends a two-factor code, type it in.
5. Wait for **Done**.

## 5. First launch on the iPhone
1. **Turn on Developer Mode:** Settings → Privacy & Security → scroll down → **Developer Mode** → on → **Restart**. After the restart, tap **Turn On** and enter your passcode. The Developer Mode option only shows up after an app has been sideloaded.
2. **Trust the developer:** Settings → General → **VPN & Device Management** → under Developer App, tap your Apple ID → **Trust**.
3. Open **Synapse**.

## 6. Every 7 days
1. Plug in the phone.
2. Open Sideloadly.
3. Drag in the same `.ipa` again → Start.

This replaces the app in place and keeps your data. In Sideloadly's advanced options you can turn on automatic refresh over Wi-Fi when the laptop and phone are on the same network.

## Updates
New features and fixes from the website arrive by themselves: Synapse downloads them and uses them next time you open it, and **Settings → About → Check for updates** checks right away. You only need a new `.ipa` when BUILD.md says a native change was made.

## If something goes wrong
| Problem | Fix |
|---|---|
| **"Unable to verify app" / "Untrusted Developer"** | Redo step 5.2. |
| **The app won't open after a week** | Re-sign (step 6). |
| **"Maximum number of apps"** | A free Apple ID can only have 3 sideloaded apps. Remove one you don't need. |
| **Sideloadly can't see the phone** | Reinstall the non-Store iTunes, try another cable or port, unlock the phone. |
| **An update made the app act weird** | Settings → About → **Use the built-in version**. Your cards stay. |

# Synapse on iPhone, from your phone

Synapse for iPhone is an unsigned .ipa. With a free Apple ID, SideStore signs it on your phone. That signature lasts 7 days, and refreshing it takes one tap. You need a computer once, for setup. After that, everything happens on the phone.

Direct download: https://github.com/NorthPeakStudios/synapse-app/releases/download/ios-v1/Synapse.ipa

## One-time setup (computer needed once)

These steps follow SideStore's official guide (docs.sidestore.io → Installation). If anything below disagrees with that guide, the guide wins.

1. **On the iPhone:** install **LocalDevVPN** from the App Store. Open it, tap **Connect**, and allow the VPN configuration. SideStore uses this on-device VPN whenever it installs or refreshes an app.
2. **On a computer** (Windows, Mac, Linux, or a Chromebook with Linux turned on): install **iloader**, using the link on SideStore's Prerequisites page. On Windows, also install **iTunes**, preferably the version downloaded directly from Apple.
3. Plug the iPhone in with a USB cable, then tap **Trust** on the phone.
4. In iloader:
   1. Sign in with your Apple ID. It's case-sensitive.
   2. Pick your iPhone.
   3. Choose **Install SideStore (Stable)**.
   iloader also puts the *pairing file* on the phone. That file is what lets SideStore work without the computer from now on.
5. **On the iPhone (iOS 18):**
   1. Go to Settings → General → **VPN & Device Management** → under Developer App, tap your Apple ID → **Trust**, then **Allow & Restart**, and enter your passcode.
   2. Go to Settings → **Privacy & Security** → scroll to the bottom → turn on **Developer Mode**. The phone restarts.
6. Open LocalDevVPN and tap **Connect**. Open **SideStore** and sign in with the same Apple ID.
7. In SideStore, go to **My Apps** and tap the **7 DAYS** button next to SideStore. That refreshes SideStore and finishes setup. If it asks about a new signing certificate, tap **Yes / Refresh Now**.

## Install Synapse (phone only)

1. Make sure you're on **Wi-Fi** (cellular data won't work for this) and that LocalDevVPN is **connected**.
2. Open this link in Safari and SideStore will download and install Synapse:
   `sidestore://install?url=https://github.com/NorthPeakStudios/synapse-app/releases/download/ios-v1/Synapse.ipa`
   You can also install it by hand: download Synapse.ipa from the link at the top, then in SideStore go to My Apps → **+** and pick the file from Files.

## Every 7 days (phone only)

- Synapse counts down for you. **Settings** always shows how many days the signature has left. A banner on **Home** appears when 2 days or fewer are left.
- To refresh: tap **Refresh in SideStore**, connect LocalDevVPN, then in SideStore go to **My Apps** and tap the days button next to Synapse. Refresh SideStore itself at the same time, because it runs on the same 7-day clock.
- SideStore also tries to refresh apps in the background. Opening it once in a while helps that work.
- If you miss the deadline, Synapse won't open until you refresh it. Your cards and progress stay on the phone, and they sync once the app opens again.

## Good to know

- A free Apple ID can have **3 sideloaded apps at once**, counting SideStore. It can also only register **10 different apps per week**.
- After an iOS update or reset, the pairing file can stop working. If that happens, use the computer once more: in iloader, use **Manage Pairing File → Place** next to SideStore. SideStore's "Pairing File" page covers this.
- ESign and Feather can import the same download link too, but they need a signing certificate of their own. SideStore with your own Apple ID is the free option.
- Web updates (new cards, features, and fixes) download inside the app by themselves. You only need a new .ipa when the native shell changes.

Synapse is made by Northpeak Studios.

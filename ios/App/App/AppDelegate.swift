import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}


// MARK: - Synapse native additions (sideload build)
// MainViewController is the app's root view (set in Main.storyboard). It registers the small
// SynapseSigning plugin and lets the web page run edge to edge behind the status bar.

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SynapseSigningPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        // No inset, no system bar background: the page draws under the status bar and pads itself
        // with env(safe-area-inset-top). A dark backdrop avoids a white flash before the page paints.
        let bg = UIColor(red: 12.0 / 255.0, green: 14.0 / 255.0, blue: 19.0 / 255.0, alpha: 1)
        view.backgroundColor = bg
        if let wv = webView {
            wv.isOpaque = false
            wv.backgroundColor = bg
            wv.scrollView.backgroundColor = bg
            wv.scrollView.contentInsetAdjustmentBehavior = .never
        }
    }
}

// Reads how long this install's signature lasts. Free Apple ID signing (SideStore, AltStore, Sideloadly …)
// puts embedded.mobileprovision inside the app bundle; its ExpirationDate is when iOS stops opening the app.
@objc(SynapseSigningPlugin)
public class SynapseSigningPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SynapseSigningPlugin"
    public let jsName = "SynapseSigning"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "info", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "canOpen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]

    private func iso(_ d: Date) -> String {
        let f = ISO8601DateFormatter()
        return f.string(from: d)
    }

    @objc func info(_ call: CAPPluginCall) {
        var out: [String: Any] = ["found": false]
        out["bundleId"] = Bundle.main.bundleIdentifier ?? ""
        out["version"] = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        out["build"] = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? ""
        if let exe = Bundle.main.executableURL,
           let attrs = try? FileManager.default.attributesOfItem(atPath: exe.path),
           let m = attrs[.modificationDate] as? Date {
            out["installedMs"] = Int64(m.timeIntervalSince1970 * 1000)
        }
        guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
              let data = try? Data(contentsOf: url) else {
            call.resolve(out)
            return
        }
        // The profile is a signed (CMS) wrapper around a plain XML plist; cut the plist out and parse it.
        guard let text = String(data: data, encoding: .isoLatin1),
              let start = text.range(of: "<?xml"),
              let end = text.range(of: "</plist>", range: start.upperBound..<text.endIndex) else {
            call.resolve(out)
            return
        }
        let xml = String(text[start.lowerBound..<end.upperBound])
        guard let xmlData = xml.data(using: .isoLatin1),
              let plist = try? PropertyListSerialization.propertyList(from: xmlData, options: [], format: nil) as? [String: Any] else {
            call.resolve(out)
            return
        }
        out["found"] = true
        if let exp = plist["ExpirationDate"] as? Date {
            out["expires"] = iso(exp)
            out["expiresMs"] = Int64(exp.timeIntervalSince1970 * 1000)
        }
        if let made = plist["CreationDate"] as? Date {
            out["created"] = iso(made)
            out["createdMs"] = Int64(made.timeIntervalSince1970 * 1000)
        }
        if let name = plist["Name"] as? String { out["profileName"] = name }
        if let team = plist["TeamName"] as? String { out["teamName"] = team }
        call.resolve(out)
    }

    @objc func canOpen(_ call: CAPPluginCall) {
        let s = call.getString("url") ?? "sidestore://"
        DispatchQueue.main.async {
            guard let u = URL(string: s) else { call.resolve(["value": false]); return }
            call.resolve(["value": UIApplication.shared.canOpenURL(u)])
        }
    }

    @objc func open(_ call: CAPPluginCall) {
        let s = call.getString("url") ?? "sidestore://"
        DispatchQueue.main.async {
            guard let u = URL(string: s) else { call.resolve(["opened": false]); return }
            UIApplication.shared.open(u, options: [:]) { ok in call.resolve(["opened": ok]) }
        }
    }
}

// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
//
// One exception, re-apply it if it regresses: `cap sync ios` run on Windows
// writes these dependency paths with backslashes, which are not just the
// wrong separator for macOS but invalid Swift string escapes -- "node_modules"
// carries a literal newline escape, so the file does not even parse. CI
// regenerates this on its macOS runner and never sees it, but the committed
// copy is what an Xcode checkout opens, so it is kept POSIX by hand.
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.5.0"),
        .package(name: "CapacitorApp", path: "../../../node_modules/@capacitor/app"),
        .package(name: "CapacitorClipboard", path: "../../../node_modules/@capacitor/clipboard")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorClipboard", package: "CapacitorClipboard")
            ]
        )
    ]
)

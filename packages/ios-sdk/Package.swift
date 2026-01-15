// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "AIHubSDK",
    platforms: [
        .iOS(.v15),
        .macOS(.v12),
        .watchOS(.v8),
        .tvOS(.v15)
    ],
    products: [
        .library(
            name: "AIHubSDK",
            targets: ["AIHubSDK"]
        ),
    ],
    targets: [
        .target(
            name: "AIHubSDK",
            dependencies: [],
            path: "Sources/AIHubSDK"
        ),
        .testTarget(
            name: "AIHubSDKTests",
            dependencies: ["AIHubSDK"],
            path: "Tests/AIHubSDKTests"
        ),
    ],
    swiftLanguageVersions: [.v5]
)

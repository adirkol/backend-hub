# AIHub iOS SDK

A Swift SDK for integrating AIHub AI generation capabilities into your iOS, macOS, watchOS, and tvOS applications.

## Requirements

- iOS 15.0+ / macOS 12.0+ / watchOS 8.0+ / tvOS 15.0+
- Swift 5.9+
- Xcode 15.0+

## Installation

### Swift Package Manager

Add the following to your `Package.swift` dependencies:

```swift
dependencies: [
    .package(url: "https://github.com/adirkol/aihub-ios-sdk.git", from: "1.0.0")
]
```

Or in Xcode:
1. File → Add Package Dependencies
2. Enter: `https://github.com/adirkol/aihub-ios-sdk.git`
3. Select version and add to your target

## Quick Start

### Initialize the Client

```swift
import AIHubSDK

let client = AIHubClient(
    apiKey: "your-api-key",
    userId: "user-unique-id",
    baseURL: URL(string: "https://your-api-url.com")!
)
```

### Register User (First App Launch)

```swift
do {
    let response = try await client.registerUser(
        metadata: [
            "device": UIDevice.current.model,
            "app_version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        ]
    )
    print("User registered: \(response.user.externalId)")
    print("Token balance: \(response.user.tokenBalance)")
} catch {
    print("Registration failed: \(error)")
}
```

### Generate an Image

```swift
do {
    // Submit generation request
    let submitResponse = try await client.generate(
        model: "flux-dev",
        prompt: "A beautiful mountain landscape at sunset",
        aspectRatio: "16:9"
    )
    print("Job submitted: \(submitResponse.jobId)")
    
    // Wait for completion
    let job = try await client.waitForCompletion(jobId: submitResponse.jobId)
    
    if let imageURL = job.outputs?.first?.url {
        print("Generated image: \(imageURL)")
    }
} catch AIHubError.insufficientTokens(let balance, let required) {
    print("Not enough tokens. Have: \(balance), Need: \(required)")
} catch {
    print("Generation failed: \(error)")
}
```

### Or Use the Convenience Method

```swift
do {
    let job = try await client.generateAndWait(
        model: "flux-dev",
        prompt: "A serene beach at dawn",
        aspectRatio: "1:1"
    )
    
    if let imageURL = job.outputs?.first?.url {
        // Download and display the image
        let (data, _) = try await URLSession.shared.data(from: URL(string: imageURL)!)
        let image = UIImage(data: data)
    }
} catch {
    print("Error: \(error)")
}
```

## API Reference

### AIHubClient

The main client for interacting with the AIHub API.

#### Initialization

```swift
// Full configuration
let config = AIHubConfiguration(
    apiKey: "your-api-key",
    baseURL: URL(string: "https://api.example.com")!,
    timeoutInterval: 60
)
let client = AIHubClient(configuration: config, userId: "user-123")

// Simple initialization
let client = AIHubClient(
    apiKey: "your-api-key",
    userId: "user-123",
    baseURL: URL(string: "https://api.example.com")!
)
```

#### User Methods

| Method | Description |
|--------|-------------|
| `registerUser(metadata:initialTokens:)` | Register a new user or get existing user |
| `getUser()` | Get user info (may trigger daily token grant) |
| `getBalance()` | Get current token balance |
| `getTokenHistory(limit:)` | Get token transaction history |
| `hasEnoughTokens(for:)` | Check if user has enough tokens |

#### Generation Methods

| Method | Description |
|--------|-------------|
| `generate(model:prompt:images:aspectRatio:numOutputs:storeOutputs:idempotencyKey:)` | Submit a generation request |
| `generate(request:)` | Submit with full GenerationRequest |
| `getJob(id:)` | Get job status |
| `cancelJob(id:)` | Cancel a queued job |
| `waitForCompletion(jobId:pollInterval:timeout:)` | Poll until job completes |
| `generateAndWait(...)` | Generate and wait in one call |

### Error Handling

The SDK provides typed errors via `AIHubError`:

```swift
do {
    let job = try await client.generateAndWait(model: "flux-dev", prompt: "test")
} catch AIHubError.insufficientTokens(let balance, let required) {
    // Show purchase prompt
} catch AIHubError.rateLimitExceeded(let retryAfter) {
    // Wait and retry
    if let seconds = retryAfter {
        try await Task.sleep(nanoseconds: UInt64(seconds) * 1_000_000_000)
    }
} catch AIHubError.timeout(let duration) {
    // Handle timeout
} catch AIHubError.generationFailed(let message, let errorCode) {
    // Handle generation failure
} catch {
    // Handle other errors
}
```

#### Error Types

| Error | Description | Retryable |
|-------|-------------|-----------|
| `insufficientTokens` | Not enough tokens | No |
| `rateLimitExceeded` | Too many requests | Yes |
| `timeout` | Operation timed out | Yes |
| `networkError` | Network failure | Yes |
| `serverError` | Server error (5xx) | Yes |
| `unauthorized` | Invalid API key | No |
| `generationFailed` | Generation failed | No |
| `cannotCancelJob` | Job not in QUEUED status | No |

### Models

#### JobStatus

```swift
enum JobStatus {
    case queued    // Job is waiting in queue
    case running   // Job is being processed
    case succeeded // Job completed successfully
    case failed    // Job failed
    case cancelled // Job was cancelled
    
    var isTerminal: Bool  // True for succeeded, failed, cancelled
    var isSuccess: Bool   // True only for succeeded
}
```

#### GenerationJob

```swift
struct GenerationJob {
    let id: String
    let status: JobStatus
    let model: String
    let userId: String
    let tokensCharged: Int
    let outputs: [GenerationOutput]?  // Available when succeeded
    let error: String?                 // Available when failed
    let errorCode: String?
    let createdAt: Date
    let startedAt: Date?
    let completedAt: Date?
}
```

## Best Practices

### 1. Register User on App Launch

```swift
func application(_ application: UIApplication, didFinishLaunchingWithOptions...) {
    Task {
        do {
            _ = try await aiClient.registerUser()
        } catch {
            // Handle error
        }
    }
}
```

### 2. Check Balance Before Generation

```swift
func generateImage() async {
    do {
        guard try await client.hasEnoughTokens(for: 5) else {
            showPurchasePrompt()
            return
        }
        
        let job = try await client.generateAndWait(...)
    } catch {
        // Handle error
    }
}
```

### 3. Handle Daily Token Grants

The `getUser()` method automatically grants daily tokens if eligible:

```swift
let user = try await client.getUser()
if let dailyGrant = user.dailyGrant, dailyGrant.grantedNow {
    showToast("You received \(dailyGrant.tokensGranted) free tokens!")
}
```

### 4. Use Idempotency Keys for Critical Operations

```swift
let idempotencyKey = "generate_\(UUID().uuidString)"
let response = try await client.generate(
    model: "flux-dev",
    prompt: "test",
    idempotencyKey: idempotencyKey
)
```

## Thread Safety

`AIHubClient` is thread-safe and can be used from any thread or actor. All methods are `async` and use Swift concurrency.

## License

This SDK is proprietary software. All rights reserved.

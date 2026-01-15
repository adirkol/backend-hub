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

### Configure at App Launch

**Option 1: Configure with API key and user ID together**

Use this when you have the user ID available at app launch:

```swift
import AIHubSDK

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // Get or create a persistent user ID
        let userId = getOrCreateUserId()
        
        // Configure AIHub with both API key and user ID
        AIHubSDK.configure(apiKey: "your-app-api-key", userId: userId)
        
        // Register user (safe to call on every launch)
        Task {
            try? await AIHubSDK.client.registerUser()
        }
        
        return true
    }
    
    private func getOrCreateUserId() -> String {
        let key = "com.yourapp.userId"
        if let existingId = UserDefaults.standard.string(forKey: key) {
            return existingId
        }
        let newId = UUID().uuidString
        UserDefaults.standard.set(newId, forKey: key)
        return newId
    }
}
```

**Option 2: Configure in two steps**

Use this when the user ID is created later (e.g., after onboarding):

```swift
import AIHubSDK

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // Step 1: Configure API key at launch
        AIHubSDK.configure(apiKey: "your-app-api-key")
        
        // Check if user already exists
        if let userId = UserDefaults.standard.string(forKey: "userId") {
            AIHubSDK.setUser(userId: userId)
        }
        
        return true
    }
}

// For Example: Later, in your onboarding flow
class OnboardingViewController: UIViewController {
    
    func completeOnboarding() {
        // Create and save user ID
        let userId = UUID().uuidString
        UserDefaults.standard.set(userId, forKey: "userId")
        
        // Step 2: Set user ID - SDK is now ready
        AIHubSDK.setUser(userId: userId)
        
        // Register the user with AIHub
        Task {
            do {
                let response = try await AIHubSDK.client.registerUser()
                print("User registered with \(response.user.tokenBalance) tokens")
            } catch {
                print("Registration failed: \(error)")
            }
        }
    }
}
```

### Configuration Parameters

| Parameter | Description |
|-----------|-------------|
| `apiKey` | Your **App API key** from the Admin Panel (Apps → Your App → Settings). |
| `userId` | A **unique identifier for each user** that your app creates and manages. AIHub uses this ID to track token balance and generation history. |

### User ID Guidelines

The `userId` should be:
- **Unique**: Each user must have a distinct ID
- **Stable**: The same user should always have the same ID
- **Persistent**: Store it in UserDefaults or Keychain

### Use Anywhere in Your App

Once configured, access `AIHubSDK.client` from any file:

```swift
import AIHubSDK

class GenerationViewController: UIViewController {
    
    func generateImage() {
        // Check if SDK is ready
        guard AIHubSDK.isConfigured else {
            print("AIHub not configured yet")
            return
        }
        
        Task {
            do {
                let job = try await AIHubSDK.client.generateAndWait(
                    model: "flux-dev",
                    prompt: "A beautiful sunset over the ocean"
                )
                
                if let imageURL = job.outputs?.first?.url {
                    await loadImage(from: imageURL)
                }
            } catch {
                print("Generation failed: \(error)")
            }
        }
    }
    
    func loadImage(from urlString: String) async {
        guard let url = URL(string: urlString) else { return }
        
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            if let image = UIImage(data: data) {
                DispatchQueue.main.async {
                    self.imageView.image = image
                }
            }
        } catch {
            print("Failed to load image: \(error)")
        }
    }
}
```

## User Registration

### registerUser() is Idempotent

Calling `registerUser()` multiple times is safe:

| Scenario | What Happens |
|----------|--------------|
| **First call** | Creates user, grants welcome tokens, returns `created: true` |
| **Subsequent calls** | Returns existing user info, returns `created: false` |

```swift
Task {
    do {
        let response = try await AIHubSDK.client.registerUser(
            metadata: [
                "device": UIDevice.current.model,
                "app_version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
            ]
        )
        
        if response.created {
            print("Welcome! You received \(response.user.tokenBalance) tokens")
        } else {
            print("Welcome back! Balance: \(response.user.tokenBalance)")
        }
    } catch {
        print("Registration failed: \(error)")
    }
}
```

## Generation Examples

### Submit and Wait for Completion

```swift
func generateImage(prompt: String) async throws -> UIImage? {
    // Submit generation request
    let submitResponse = try await AIHubSDK.client.generate(
        model: "flux-dev",
        prompt: prompt,
        aspectRatio: "16:9"
    )
    print("Job submitted: \(submitResponse.jobId)")
    
    // Wait for completion (polls automatically)
    let job = try await AIHubSDK.client.waitForCompletion(jobId: submitResponse.jobId)
    
    // Download the generated image
    if let imageURL = job.outputs?.first?.url,
       let url = URL(string: imageURL) {
        let (data, _) = try await URLSession.shared.data(from: url)
        return UIImage(data: data)
    }
    
    return nil
}
```

### One-Line Generation

```swift
func quickGenerate() async {
    do {
        let job = try await AIHubSDK.client.generateAndWait(
            model: "flux-dev",
            prompt: "A serene mountain landscape",
            aspectRatio: "1:1"
        )
        
        if let imageURL = job.outputs?.first?.url {
            print("Generated: \(imageURL)")
        }
    } catch AIHubError.insufficientTokens(let balance, let required) {
        print("Not enough tokens. Have: \(balance), Need: \(required)")
        showPurchasePrompt()
    } catch {
        print("Error: \(error)")
    }
}
```

### Check Balance Before Generation

```swift
func generateWithBalanceCheck() async {
    do {
        // Check if user has enough tokens
        guard try await AIHubSDK.client.hasEnoughTokens(for: 5) else {
            showPurchasePrompt()
            return
        }
        
        let job = try await AIHubSDK.client.generateAndWait(
            model: "flux-dev",
            prompt: "A beautiful sunset"
        )
        // Handle result
    } catch {
        print("Error: \(error)")
    }
}
```

## API Reference

### AIHubSDK

Static entry point for SDK configuration.

| Property/Method | Description |
|----------------|-------------|
| `configure(apiKey:userId:)` | Configure with both API key and user ID |
| `configure(apiKey:)` | Configure with API key only (call `setUser` later) |
| `setUser(userId:)` | Set or change the user ID |
| `reset()` | Reset all configuration (for logout) |
| `client` | The configured `AIHubClient` instance |
| `isConfigured` | `true` if SDK is ready to use |
| `hasApiKey` | `true` if API key is set |
| `userId` | Current user ID, if set |

### AIHubClient

The client for API interactions. Access via `AIHubSDK.client`.

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

## Error Handling

The SDK provides typed errors via `AIHubError`:

```swift
func handleGeneration() async {
    do {
        let job = try await AIHubSDK.client.generateAndWait(
            model: "flux-dev",
            prompt: "test"
        )
        // Success
    } catch AIHubError.insufficientTokens(let balance, let required) {
        // User doesn't have enough tokens
        showPurchasePrompt()
    } catch AIHubError.rateLimitExceeded(let retryAfter) {
        // Too many requests - wait and retry
        if let seconds = retryAfter {
            try? await Task.sleep(nanoseconds: UInt64(seconds) * 1_000_000_000)
            // Retry
        }
    } catch AIHubError.timeout(let duration) {
        // Generation took too long
        showAlert("Generation timed out after \(duration) seconds")
    } catch AIHubError.generationFailed(let message, let errorCode) {
        // AI generation failed
        showAlert("Generation failed: \(message ?? "Unknown error")")
    } catch AIHubError.unauthorized {
        // Invalid API key
        showAlert("Invalid API key")
    } catch {
        // Other errors
        showAlert("Error: \(error.localizedDescription)")
    }
}
```

### Error Types

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

## Models

### JobStatus

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

### GenerationJob

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

### 1. Configure Once at App Launch

```swift
func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    
    AIHubSDK.configure(apiKey: "your-app-api-key", userId: getUserId())
    return true
}
```

### 2. Always Use AIHubSDK.client

```swift
// Good - use the shared client
let job = try await AIHubSDK.client.generateAndWait(...)

// Avoid - creating separate instances
let client = AIHubClient(apiKey: "...", userId: "...")
```

### 3. Register User on App Launch

```swift
// In AppDelegate, after configuration
Task {
    _ = try? await AIHubSDK.client.registerUser()
}
```

### 4. Handle Daily Token Grants

The `getUser()` method automatically grants daily tokens if eligible:

```swift
func checkDailyTokens() async {
    do {
        let user = try await AIHubSDK.client.getUser()
        if let dailyGrant = user.dailyGrant, dailyGrant.grantedNow {
            showToast("You received \(dailyGrant.tokensGranted) free tokens!")
        }
    } catch {
        print("Error: \(error)")
    }
}
```

### 5. Use Idempotency Keys for Critical Operations

```swift
let idempotencyKey = "generate_\(UUID().uuidString)"
let response = try await AIHubSDK.client.generate(
    model: "flux-dev",
    prompt: "My prompt",
    idempotencyKey: idempotencyKey
)
```

### 6. Handle User Logout (probably not needed in our apps)

```swift
func logout() {
    
    // Reset AIHub SDK
    AIHubSDK.reset()
}
```

### 7. Switch Users

```swift
func switchToUser(_ newUserId: String) {
    // setUser works for both initial setup and switching
    AIHubSDK.setUser(userId: newUserId)
    
    // Register the new user
    Task {
        try? await AIHubSDK.client.registerUser()
    }
}
```

## Thread Safety

`AIHubSDK` and `AIHubClient` are thread-safe and can be used from any thread. All methods are `async` and use Swift concurrency.

## License

This SDK is proprietary software of Video Bakery LTD. All rights reserved.

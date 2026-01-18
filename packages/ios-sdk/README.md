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

## Token Balance

### Display Balance Instantly with Caching

The SDK automatically caches the token balance in UserDefaults. This lets you show the balance immediately when your app launches, without waiting for a network request:

```swift
class TokenDisplayViewController: UIViewController {
    @IBOutlet weak var tokenLabel: UILabel!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // 1. Show cached balance immediately (instant, may be stale)
        if let cachedBalance = AIHubSDK.cachedBalance {
            tokenLabel.text = "Tokens: \(cachedBalance)"
        } else {
            tokenLabel.text = "Tokens: --"
        }
        
        // 2. Listen for balance updates from the server
        AIHubSDK.onBalanceUpdate = { [weak self] newBalance in
            DispatchQueue.main.async {
                self?.tokenLabel.text = "Tokens: \(newBalance)"
            }
        }
        
        // 3. Fetch fresh balance from server
        Task {
            try? await AIHubSDK.client.refreshBalance()
        }
    }
}
```

### Balance Observer

The `onBalanceUpdate` closure is called automatically whenever the SDK receives balance data from the server, including:
- After `registerUser()`
- After `getUser()`
- After `getBalance()` or `refreshBalance()`

```swift
// Set up the observer once (e.g., in AppDelegate or your main view controller)
AIHubSDK.onBalanceUpdate = { newBalance in
    DispatchQueue.main.async {
        // Update your UI
        NotificationCenter.default.post(
            name: .tokenBalanceDidUpdate,
            object: nil,
            userInfo: ["balance": newBalance]
        )
    }
}

// Define the notification name
extension Notification.Name {
    static let tokenBalanceDidUpdate = Notification.Name("tokenBalanceDidUpdate")
}
```

### Check Balance Before Generation

```swift
func generateWithBalanceCheck() async {
    do {
        // Option 1: Simple check
        guard try await AIHubSDK.client.hasEnoughTokens(for: 5) else {
            showPurchasePrompt()
            return
        }
        
        // Option 2: Get balance details
        let check = try await AIHubSDK.client.checkBalance(for: 5)
        if !check.hasEnough {
            showAlert("Need \(check.shortfall) more tokens. Current: \(check.currentBalance)")
            return
        }
        
        // Proceed with generation
        let job = try await AIHubSDK.client.generateAndWait(
            model: "flux-dev",
            prompt: "A beautiful sunset"
        )
    } catch {
        print("Error: \(error)")
    }
}
```

### Get Current Balance

```swift
// Fetch fresh balance from server (updates cache automatically)
let balance = try await AIHubSDK.client.getBalance()
print("Current balance: \(balance)")

// Or use refreshBalance() which is the same
let balance = try await AIHubSDK.client.refreshBalance()
```

### Optimistic UI Updates After Purchase

When a user purchases tokens through RevenueCat, there may be a brief delay before the webhook is processed and the balance is updated on the server. To provide instant feedback, use the product token mapping:

```swift
class PurchaseManager {
    // Cache the product → token mapping
    private var productTokenMap: [String: Int] = [:]
    
    func loadProductMapping() async {
        // Fetch mapping once (or periodically)
        if let mapping = try? await AIHubSDK.client.getProductTokenMapping() {
            productTokenMap = mapping
        }
    }
    
    func handlePurchaseSuccess(productId: String) {
        // Get tokens for this product
        guard let purchasedTokens = productTokenMap[productId] else {
            // Product not found in mapping, just refresh balance
            Task { try? await AIHubSDK.client.refreshBalance() }
            return
        }
        
        // Show optimistic balance immediately
        if let currentBalance = AIHubSDK.cachedBalance {
            let optimisticBalance = currentBalance + purchasedTokens
            
            // Update UI immediately
            DispatchQueue.main.async {
                NotificationCenter.default.post(
                    name: .tokenBalanceDidUpdate,
                    object: nil,
                    userInfo: ["balance": optimisticBalance, "isOptimistic": true]
                )
            }
        }
        
        // Then fetch actual balance in background (will update UI when ready)
        Task {
            try await Task.sleep(nanoseconds: 2_000_000_000) // Wait 2 seconds for webhook
            try? await AIHubSDK.client.refreshBalance()
        }
    }
}
```

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
                
                if let imageURL = job.outputs?.first {
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
    if let imageURL = job.outputs?.first,
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
        
        if let imageURL = job.outputs?.first {
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

## Image Editing with p-image-edit

The `p-image-edit` model by Pruna AI is a fast, sub-second image editing model. It supports multiple input images for reference and editing tasks.

### Edit Image with URL Input

```swift
func editImageFromURL() async {
    do {
        let job = try await AIHubSDK.client.generateAndWait(
            model: "p-image-edit",
            prompt: "Change the background to a sunset beach scene",
            images: ["https://example.com/my-photo.jpg"],
            aspectRatio: "match_input_image"  // Preserve original aspect ratio
        )
        
        if let editedImageURL = job.outputs?.first {
            print("Edited image: \(editedImageURL)")
            await loadAndDisplayImage(from: editedImageURL)
        }
    } catch {
        print("Image editing failed: \(error)")
    }
}
```

### Edit Image with Base64 Input

For images captured from the camera or selected from the photo library, convert to base64:

```swift
func editImageFromCamera(image: UIImage) async {
    // Convert UIImage to base64 data URI
    guard let imageData = image.jpegData(compressionQuality: 0.8) else {
        print("Failed to convert image to JPEG")
        return
    }
    let base64String = imageData.base64EncodedString()
    let dataURI = "data:image/jpeg;base64,\(base64String)"
    
    do {
        let job = try await AIHubSDK.client.generateAndWait(
            model: "p-image-edit",
            prompt: "Make this photo look like a professional studio portrait",
            images: [dataURI],
            aspectRatio: "match_input_image"
        )
        
        if let resultURL = job.outputs?.first,
           let url = URL(string: resultURL) {
            let (data, _) = try await URLSession.shared.data(from: url)
            if let editedImage = UIImage(data: data) {
                await MainActor.run {
                    self.imageView.image = editedImage
                }
            }
        }
    } catch {
        print("Image editing failed: \(error)")
    }
}
```

### Multi-Image Editing (Style Transfer)

Use multiple images for style transfer or reference-based editing:

```swift
func applyStyleFromReference(contentImage: UIImage, styleImage: UIImage) async {
    // Convert both images to base64
    guard let contentData = contentImage.jpegData(compressionQuality: 0.8),
          let styleData = styleImage.jpegData(compressionQuality: 0.8) else {
        return
    }
    
    let contentURI = "data:image/jpeg;base64,\(contentData.base64EncodedString())"
    let styleURI = "data:image/jpeg;base64,\(styleData.base64EncodedString())"
    
    do {
        // Image 1 is the main image, Image 2 is the style reference
        let job = try await AIHubSDK.client.generateAndWait(
            model: "p-image-edit",
            prompt: "Apply the artistic style from image 2 to image 1",
            images: [contentURI, styleURI],
            aspectRatio: "match_input_image"
        )
        
        if let resultURL = job.outputs?.first {
            print("Style transfer complete: \(resultURL)")
        }
    } catch {
        print("Style transfer failed: \(error)")
    }
}
```

## LLM Chat Completion

AIHub supports OpenAI LLM models for text generation and chat completion. Available models:

| Model | Description | Best For |
|-------|-------------|----------|
| `gpt-4o-mini` | Cost-efficient, 128K context | High-volume apps, general tasks |
| `gpt-4.1-mini` | 1M context, excellent coding | Complex tasks, long documents |
| `gpt-4.1-nano` | Fastest and cheapest | Classification, simple tasks |
| `gpt-5-nano` | GPT-5 series, 400K context | Advanced reasoning |

### Simple Text Chat

```swift
func chatWithAI(userMessage: String) async {
    do {
        let job = try await AIHubSDK.client.generateAndWait(
            model: "gpt-4.1-nano",
            prompt: userMessage
        )
        
        // LLM responses are text strings in the outputs array
        if let response = job.outputs?.first {
            print("AI Response: \(response)")
            await MainActor.run {
                self.responseLabel.text = response
            }
        }
    } catch {
        print("Chat failed: \(error)")
    }
}
```

### LLM with Vision (Analyze Images)

LLM models support vision input for analyzing images:

```swift
func analyzeImage(image: UIImage, question: String) async {
    // Convert image to base64
    guard let imageData = image.jpegData(compressionQuality: 0.8) else {
        return
    }
    let base64String = imageData.base64EncodedString()
    let dataURI = "data:image/jpeg;base64,\(base64String)"
    
    do {
        let job = try await AIHubSDK.client.generateAndWait(
            model: "gpt-4.1-nano",  // or any vision-capable model
            prompt: question,
            images: [dataURI]
        )
        
        if let analysis = job.outputs?.first {
            print("Image analysis: \(analysis)")
        }
    } catch {
        print("Image analysis failed: \(error)")
    }
}

// Usage example
func describePhoto() async {
    guard let photo = selectedPhoto else { return }
    
    await analyzeImage(
        image: photo,
        question: "Describe this image in detail. What objects, people, or scenes do you see?"
    )
}
```

### LLM with Image URL

```swift
func analyzeImageFromURL() async {
    do {
        let job = try await AIHubSDK.client.generateAndWait(
            model: "gpt-4.1-mini",
            prompt: "What's in this image? List all the items you can see.",
            images: ["https://example.com/photo.jpg"]
        )
        
        if let description = job.outputs?.first {
            print("Description: \(description)")
        }
    } catch {
        print("Analysis failed: \(error)")
    }
}
```

### Multi-Image Comparison

```swift
func compareImages(image1: UIImage, image2: UIImage) async {
    guard let data1 = image1.jpegData(compressionQuality: 0.7),
          let data2 = image2.jpegData(compressionQuality: 0.7) else {
        return
    }
    
    let uri1 = "data:image/jpeg;base64,\(data1.base64EncodedString())"
    let uri2 = "data:image/jpeg;base64,\(data2.base64EncodedString())"
    
    do {
        let job = try await AIHubSDK.client.generateAndWait(
            model: "gpt-4.1-nano",
            prompt: "Compare these two images. What are the main differences and similarities?",
            images: [uri1, uri2]
        )
        
        if let comparison = job.outputs?.first {
            print("Comparison: \(comparison)")
        }
    } catch {
        print("Comparison failed: \(error)")
    }
}
```

### Understanding Outputs

The `outputs` array contains strings that are:
- **For image models**: URLs to the generated images
- **For LLM models**: The text response

```swift
func handleResponse(job: GenerationJob) {
    guard let outputs = job.outputs else { return }
    
    // For image models
    if job.model.contains("flux") || job.model.contains("image") {
        for imageURL in outputs {
            loadAndDisplayImage(from: imageURL)
        }
    }
    
    // For LLM models
    if job.model.contains("gpt") {
        if let textResponse = outputs.first {
            displayMessage(textResponse)
        }
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
| `clearCache()` | Clear cached data for current user |
| `client` | The configured `AIHubClient` instance |
| `isConfigured` | `true` if SDK is ready to use |
| `hasApiKey` | `true` if API key is set |
| `userId` | Current user ID, if set |
| `cachedBalance` | Cached token balance (instant access, may be stale) |
| `onBalanceUpdate` | Closure called when balance updates from server |

### AIHubClient

The client for API interactions. Access via `AIHubSDK.client`.

#### User Methods

| Method | Description |
|--------|-------------|
| `registerUser(metadata:initialTokens:)` | Register a new user or get existing user |
| `getUser()` | Get user info (may trigger daily token grant) |
| `getBalance()` | Get current token balance |
| `refreshBalance()` | Refresh and return current balance |
| `checkBalance(for:)` | Check balance with detailed result |
| `getTokenHistory(limit:)` | Get token transaction history |
| `hasEnoughTokens(for:)` | Check if user has enough tokens |
| `getProductTokenMapping()` | Get product ID → token amount mapping for optimistic UI |

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

## Available AI Models

### Image Generation Models

| Model | Description | Token Cost | Max Images |
|-------|-------------|------------|------------|
| `flux-dev` | High-quality image generation with excellent prompt following | 10 | 0 |
| `flux-schnell` | Fast image generation for quick iterations | 5 | 0 |
| `gpt-image-1.5` | OpenAI's GPT-based image generation | 15 | 4 |
| `nano-banana` | Google's efficient model with broad aspect ratio support | 8 | 4 |
| `p-image-edit` | Pruna AI's sub-second image editing model | 5 | 10 |

### LLM Models (Chat Completion)

| Model | Description | Token Cost | Context | Vision |
|-------|-------------|------------|---------|--------|
| `gpt-4o-mini` | Cost-efficient multimodal model | 2 | 128K | ✓ |
| `gpt-4.1-mini` | Excellent coding and instruction following | 3 | 1M | ✓ |
| `gpt-4.1-nano` | Fastest and most cost-effective | 1 | 1M | ✓ |
| `gpt-5-nano` | GPT-5 series with advanced reasoning | 2 | 400K | ✓ |

## Data Types

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
    let outputs: [String]?   // URLs (images) or text responses (LLMs)
    var numOutputs: Int      // Count of outputs
    let error: String?       // Available when failed
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

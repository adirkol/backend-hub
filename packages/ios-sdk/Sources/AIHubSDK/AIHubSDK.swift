import Foundation

/// Global entry point for the AIHub SDK.
///
/// Use `AIHubSDK` to configure the SDK once at app launch and access the client anywhere in your app.
///
/// ## Usage
///
/// **Option 1: Configure with both API key and user ID at once**
/// ```swift
/// // In AppDelegate
/// AIHubSDK.configure(apiKey: "your-app-api-key", userId: "user-123")
/// ```
///
/// **Option 2: Configure in two steps (when userId comes later)**
/// ```swift
/// // At app launch
/// AIHubSDK.configure(apiKey: "your-app-api-key")
///
/// // Later, when user ID is available
/// AIHubSDK.setUser(userId: "user-123")
/// ```
///
/// **Access the client anywhere:**
/// ```swift
/// let job = try await AIHubSDK.client.generateAndWait(model: "flux-dev", prompt: "...")
/// ```
public enum AIHubSDK {
    
    // MARK: - Private State
    
    private static var _apiKey: String?
    private static var _userId: String?
    private static var _client: AIHubClient?
    private static let lock = NSLock()
    
    // MARK: - Public Properties
    
    /// The configured AIHub client.
    ///
    /// - Important: You must call `configure(apiKey:userId:)` or both `configure(apiKey:)` and `setUser(userId:)`
    ///   before accessing this property.
    /// - Returns: The configured `AIHubClient` instance.
    public static var client: AIHubClient {
        lock.lock()
        defer { lock.unlock() }
        
        guard let client = _client else {
            if _apiKey == nil {
                fatalError("AIHubSDK: Call configure(apiKey:) before accessing client.")
            } else {
                fatalError("AIHubSDK: Call setUser(userId:) before accessing client. API key is set but user ID is missing.")
            }
        }
        return client
    }
    
    /// Returns `true` if the SDK is fully configured and ready to use.
    ///
    /// The SDK is configured when both `apiKey` and `userId` have been set.
    public static var isConfigured: Bool {
        lock.lock()
        defer { lock.unlock() }
        return _client != nil
    }
    
    /// Returns `true` if the API key has been set (but userId may still be missing).
    public static var hasApiKey: Bool {
        lock.lock()
        defer { lock.unlock() }
        return _apiKey != nil
    }
    
    /// The current user ID, if set.
    public static var userId: String? {
        lock.lock()
        defer { lock.unlock() }
        return _userId
    }
    
    // MARK: - Configuration Methods
    
    /// Configures the SDK with both API key and user ID.
    ///
    /// Call this method once at app launch when you have the user ID available immediately.
    ///
    /// - Parameters:
    ///   - apiKey: Your App API key from the Admin Panel (Apps → Your App → Settings).
    ///   - userId: A unique identifier for the user that your app creates and manages.
    ///
    /// ## Example
    /// ```swift
    /// func application(_ application: UIApplication,
    ///                  didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    ///     let userId = UserDefaults.standard.string(forKey: "userId") ?? UUID().uuidString
    ///     AIHubSDK.configure(apiKey: "your-app-api-key", userId: userId)
    ///     return true
    /// }
    /// ```
    public static func configure(apiKey: String, userId: String) {
        lock.lock()
        defer { lock.unlock() }
        
        _apiKey = apiKey
        _userId = userId
        _client = AIHubClient(apiKey: apiKey, userId: userId)
    }
    
    /// Configures the SDK with the API key only.
    ///
    /// Call this method at app launch when the user ID is not yet available.
    /// You must call `setUser(userId:)` before using `client`.
    ///
    /// - Parameter apiKey: Your App API key from the Admin Panel (Apps → Your App → Settings).
    ///
    /// ## Example
    /// ```swift
    /// func application(_ application: UIApplication,
    ///                  didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    ///     AIHubSDK.configure(apiKey: "your-app-api-key")
    ///     return true
    /// }
    /// ```
    public static func configure(apiKey: String) {
        lock.lock()
        defer { lock.unlock() }
        
        _apiKey = apiKey
        // Client not created yet - waiting for userId
    }
    
    /// Sets the user ID and creates (or recreates) the client.
    ///
    /// Call this method after `configure(apiKey:)` when the user ID becomes available,
    /// or call it again to switch to a different user.
    ///
    /// - Parameter userId: A unique identifier for the user that your app creates and manages.
    ///
    /// ## Example
    /// ```swift
    /// // Initial setup
    /// func onboardingComplete() {
    ///     let userId = UUID().uuidString
    ///     UserDefaults.standard.set(userId, forKey: "userId")
    ///     AIHubSDK.setUser(userId: userId)
    ///
    ///     Task {
    ///         try? await AIHubSDK.client.registerUser()
    ///     }
    /// }
    ///
    /// // Or switch users
    /// func switchAccount(to newUserId: String) {
    ///     AIHubSDK.setUser(userId: newUserId)
    /// }
    /// ```
    public static func setUser(userId: String) {
        lock.lock()
        defer { lock.unlock() }
        
        guard let apiKey = _apiKey else {
            fatalError("AIHubSDK: Call configure(apiKey:) before setUser(userId:).")
        }
        
        _userId = userId
        _client = AIHubClient(apiKey: apiKey, userId: userId)
    }
    
    /// Resets the SDK configuration.
    ///
    /// Use this when the user logs out and you want to clear all state.
    /// After calling this, you must call `configure()` again before using the SDK.
    public static func reset() {
        lock.lock()
        defer { lock.unlock() }
        
        _apiKey = nil
        _userId = nil
        _client = nil
    }
}

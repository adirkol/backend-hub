import Foundation

/// Configuration for the AIHub SDK
public struct AIHubConfiguration {
    /// The production API base URL
    public static let productionURL = URL(string: "https://hub.videobakery.co")!
    
    /// The App API key (found in Admin Panel → Apps → Settings)
    public let apiKey: String
    
    /// The base URL for the API (defaults to production)
    public let baseURL: URL
    
    /// Default timeout for requests in seconds
    public let timeoutInterval: TimeInterval
    
    /// Custom URLSession configuration (optional)
    public let sessionConfiguration: URLSessionConfiguration
    
    /// Creates a new configuration
    /// - Parameters:
    ///   - apiKey: Your App API key (found in Admin Panel → Apps → Settings)
    ///   - baseURL: The API base URL (defaults to production: https://hub.videobakery.co)
    ///   - timeoutInterval: Request timeout in seconds (default: 30)
    ///   - sessionConfiguration: Custom URLSession configuration
    public init(
        apiKey: String,
        baseURL: URL = AIHubConfiguration.productionURL,
        timeoutInterval: TimeInterval = 30,
        sessionConfiguration: URLSessionConfiguration = .default
    ) {
        self.apiKey = apiKey
        self.baseURL = baseURL
        self.timeoutInterval = timeoutInterval
        self.sessionConfiguration = sessionConfiguration
    }
    
    /// Creates a configuration for a custom base URL
    /// - Parameters:
    ///   - apiKey: Your App API key
    ///   - baseURLString: The API base URL as a string
    ///   - timeoutInterval: Request timeout in seconds (default: 30)
    public init(
        apiKey: String,
        baseURLString: String,
        timeoutInterval: TimeInterval = 30
    ) throws {
        guard let url = URL(string: baseURLString) else {
            throw AIHubError.invalidConfiguration("Invalid base URL: \(baseURLString)")
        }
        self.init(apiKey: apiKey, baseURL: url, timeoutInterval: timeoutInterval)
    }
}

/// Internal API version configuration
internal enum APIVersion {
    static let v1 = "/api/v1"
}

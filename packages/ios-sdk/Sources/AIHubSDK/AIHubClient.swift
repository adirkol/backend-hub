import Foundation

/// Main client for interacting with the AIHub API
///
/// ## Usage
/// ```swift
/// let client = AIHubClient(
///     configuration: AIHubConfiguration(
///         apiKey: "your-api-key",
///         baseURL: URL(string: "https://your-api.com")!
///     ),
///     userId: "user-123"
/// )
///
/// // Generate an image
/// let job = try await client.generate(
///     model: "flux-dev",
///     prompt: "A beautiful sunset over the ocean"
/// )
///
/// // Wait for completion
/// let result = try await client.waitForCompletion(jobId: job.jobId)
/// print("Generated image: \(result.outputs?.first?.url ?? "N/A")")
/// ```
public final class AIHubClient: @unchecked Sendable {
    
    // MARK: - Properties
    
    private let configuration: AIHubConfiguration
    private let userId: String
    private let session: URLSession
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    
    // MARK: - Initialization
    
    /// Creates a new AIHub client
    /// - Parameters:
    ///   - configuration: The SDK configuration
    ///   - userId: The external user ID for this user
    public init(configuration: AIHubConfiguration, userId: String) {
        self.configuration = configuration
        self.userId = userId
        self.session = URLSession(configuration: configuration.sessionConfiguration)
        
        self.encoder = JSONEncoder()
        self.decoder = JSONDecoder()
    }
    
    /// Convenience initializer with API key and user ID
    /// - Parameters:
    ///   - apiKey: Your app's API key
    ///   - userId: The external user ID
    ///   - baseURL: The API base URL (defaults to production)
    public convenience init(
        apiKey: String,
        userId: String,
        baseURL: URL = URL(string: "https://api.yourdomain.com")!
    ) {
        let config = AIHubConfiguration(apiKey: apiKey, baseURL: baseURL)
        self.init(configuration: config, userId: userId)
    }
    
    // MARK: - User Management
    
    /// Registers a new user or returns existing user info
    /// Call this on first app launch to ensure the user exists
    /// - Parameters:
    ///   - metadata: Optional metadata to attach to the user
    ///   - initialTokens: Optional initial tokens (for migrating users)
    /// - Returns: The create user response
    public func registerUser(
        metadata: [String: Any]? = nil,
        initialTokens: Int? = nil
    ) async throws -> CreateUserResponse {
        let request = CreateUserRequest(
            externalId: userId,
            metadata: metadata,
            initialTokens: initialTokens
        )
        
        return try await post(
            path: "/users",
            body: request,
            responseType: CreateUserResponse.self
        )
    }
    
    /// Gets the current user's info including token balance
    /// Note: This may also trigger a daily token grant if eligible
    /// - Returns: The user info
    public func getUser() async throws -> AIHubUser {
        return try await get(
            path: "/users/\(userId)",
            responseType: AIHubUser.self
        )
    }
    
    /// Gets the current user's token balance
    /// - Returns: The current token balance
    public func getBalance() async throws -> Int {
        let user = try await getUser()
        return user.tokenBalance
    }
    
    /// Gets the user's token transaction history
    /// - Parameter limit: Maximum number of transactions to return (default: 50, max: 100)
    /// - Returns: The token history response
    public func getTokenHistory(limit: Int = 50) async throws -> TokenHistoryResponse {
        return try await get(
            path: "/users/\(userId)/tokens?limit=\(min(limit, 100))",
            responseType: TokenHistoryResponse.self
        )
    }
    
    // MARK: - Generation
    
    /// Submits a new generation request
    /// - Parameters:
    ///   - model: The model to use (e.g., "flux-dev")
    ///   - prompt: Text prompt for generation
    ///   - images: Optional input image URLs
    ///   - aspectRatio: Aspect ratio (default: "1:1")
    ///   - numOutputs: Number of outputs (default: 1)
    ///   - storeOutputs: Whether to store outputs permanently (default: false)
    ///   - idempotencyKey: Optional key to prevent duplicate requests
    /// - Returns: The generation submit response with job ID
    public func generate(
        model: String,
        prompt: String? = nil,
        images: [String]? = nil,
        aspectRatio: String = "1:1",
        numOutputs: Int = 1,
        storeOutputs: Bool = false,
        idempotencyKey: String? = nil
    ) async throws -> GenerationSubmitResponse {
        let input = GenerationInput(
            prompt: prompt,
            images: images,
            aspectRatio: aspectRatio,
            numOutputs: numOutputs
        )
        
        let request = GenerationRequest(
            model: model,
            input: input,
            idempotencyKey: idempotencyKey,
            storeOutputs: storeOutputs
        )
        
        return try await post(
            path: "/generate",
            body: request,
            responseType: GenerationSubmitResponse.self
        )
    }
    
    /// Submits a generation request with full control over parameters
    /// - Parameter request: The generation request
    /// - Returns: The generation submit response
    public func generate(request: GenerationRequest) async throws -> GenerationSubmitResponse {
        return try await post(
            path: "/generate",
            body: request,
            responseType: GenerationSubmitResponse.self
        )
    }
    
    /// Gets the status of a generation job
    /// - Parameter jobId: The job ID
    /// - Returns: The job details
    public func getJob(id jobId: String) async throws -> GenerationJob {
        return try await get(
            path: "/jobs/\(jobId)",
            responseType: GenerationJob.self
        )
    }
    
    /// Cancels a queued job and refunds tokens
    /// - Parameter jobId: The job ID to cancel
    /// - Returns: The cancel response with refund info
    /// - Throws: `AIHubError.cannotCancelJob` if job is not in QUEUED status
    public func cancelJob(id jobId: String) async throws -> CancelJobResponse {
        return try await delete(
            path: "/jobs/\(jobId)",
            responseType: CancelJobResponse.self
        )
    }
    
    /// Waits for a job to complete by polling
    /// - Parameters:
    ///   - jobId: The job ID to wait for
    ///   - pollInterval: How often to poll in seconds (default: 2.0)
    ///   - timeout: Maximum time to wait in seconds (default: 120.0)
    /// - Returns: The completed job
    /// - Throws: `AIHubError.timeout` if the job doesn't complete in time
    /// - Throws: `AIHubError.generationFailed` if the job fails
    public func waitForCompletion(
        jobId: String,
        pollInterval: TimeInterval = 2.0,
        timeout: TimeInterval = 120.0
    ) async throws -> GenerationJob {
        let startTime = Date()
        
        while Date().timeIntervalSince(startTime) < timeout {
            let job = try await getJob(id: jobId)
            
            switch job.status {
            case .succeeded:
                return job
            case .failed:
                throw AIHubError.generationFailed(
                    message: job.error,
                    errorCode: job.errorCode
                )
            case .cancelled:
                throw AIHubError.generationFailed(
                    message: "Job was cancelled",
                    errorCode: "CANCELLED"
                )
            case .queued, .running:
                try await Task.sleep(nanoseconds: UInt64(pollInterval * 1_000_000_000))
            }
        }
        
        throw AIHubError.timeout(timeout)
    }
    
    /// Generates and waits for completion in one call
    /// - Parameters:
    ///   - model: The model to use
    ///   - prompt: Text prompt for generation
    ///   - images: Optional input image URLs
    ///   - aspectRatio: Aspect ratio (default: "1:1")
    ///   - numOutputs: Number of outputs (default: 1)
    ///   - storeOutputs: Whether to store outputs permanently (default: false)
    ///   - timeout: Maximum time to wait (default: 120 seconds)
    /// - Returns: The completed job with outputs
    public func generateAndWait(
        model: String,
        prompt: String? = nil,
        images: [String]? = nil,
        aspectRatio: String = "1:1",
        numOutputs: Int = 1,
        storeOutputs: Bool = false,
        timeout: TimeInterval = 120.0
    ) async throws -> GenerationJob {
        let response = try await generate(
            model: model,
            prompt: prompt,
            images: images,
            aspectRatio: aspectRatio,
            numOutputs: numOutputs,
            storeOutputs: storeOutputs
        )
        
        return try await waitForCompletion(jobId: response.jobId, timeout: timeout)
    }
    
    // MARK: - Private Methods
    
    private func buildURL(path: String) throws -> URL {
        let fullPath = APIVersion.v1 + path
        guard let url = URL(string: fullPath, relativeTo: configuration.baseURL) else {
            throw AIHubError.invalidURL(fullPath)
        }
        return url
    }
    
    private func buildRequest(url: URL, method: String, body: Data? = nil) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = configuration.timeoutInterval
        
        // Required headers
        request.setValue(configuration.apiKey, forHTTPHeaderField: "X-API-Key")
        request.setValue(userId, forHTTPHeaderField: "X-User-ID")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("AIHubSDK/1.0.0", forHTTPHeaderField: "User-Agent")
        
        if let body = body {
            request.httpBody = body
        }
        
        return request
    }
    
    private func get<T: Decodable>(path: String, responseType: T.Type) async throws -> T {
        let url = try buildURL(path: path)
        let request = buildRequest(url: url, method: "GET")
        return try await execute(request: request, responseType: responseType)
    }
    
    private func post<T: Decodable, B: Encodable>(
        path: String,
        body: B,
        responseType: T.Type
    ) async throws -> T {
        let url = try buildURL(path: path)
        let bodyData = try encoder.encode(body)
        let request = buildRequest(url: url, method: "POST", body: bodyData)
        return try await execute(request: request, responseType: responseType)
    }
    
    private func delete<T: Decodable>(path: String, responseType: T.Type) async throws -> T {
        let url = try buildURL(path: path)
        let request = buildRequest(url: url, method: "DELETE")
        return try await execute(request: request, responseType: responseType)
    }
    
    private func execute<T: Decodable>(
        request: URLRequest,
        responseType: T.Type
    ) async throws -> T {
        let data: Data
        let response: URLResponse
        
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw AIHubError.networkError(error)
        }
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AIHubError.unknown("Invalid response type")
        }
        
        // Handle success
        if 200...299 ~= httpResponse.statusCode {
            do {
                return try decoder.decode(responseType, from: data)
            } catch {
                throw AIHubError.decodingError(error)
            }
        }
        
        // Handle errors
        let errorResponse: APIErrorResponse?
        do {
            errorResponse = try decoder.decode(APIErrorResponse.self, from: data)
        } catch {
            errorResponse = nil
        }
        
        switch httpResponse.statusCode {
        case 401:
            throw AIHubError.unauthorized(errorResponse?.error ?? "Invalid API key")
        case 402:
            if let balance = errorResponse?.balance, let required = errorResponse?.required {
                throw AIHubError.insufficientTokens(balance: balance, required: required)
            }
            throw AIHubError.insufficientTokens(balance: 0, required: 0)
        case 404:
            let message = errorResponse?.error ?? "Not found"
            if message.lowercased().contains("user") {
                throw AIHubError.userNotFound(userId)
            } else if message.lowercased().contains("job") {
                throw AIHubError.jobNotFound(request.url?.lastPathComponent ?? "unknown")
            } else if message.lowercased().contains("model") {
                throw AIHubError.modelNotFound(message)
            }
            throw AIHubError.serverError(statusCode: 404, message: message, details: nil)
        case 409:
            if let currentStatus = errorResponse?.currentStatus {
                throw AIHubError.cannotCancelJob(currentStatus: currentStatus)
            }
            throw AIHubError.serverError(
                statusCode: 409,
                message: errorResponse?.error ?? "Conflict",
                details: nil
            )
        case 429:
            throw AIHubError.rateLimitExceeded(retryAfter: errorResponse?.retryAfter)
        default:
            throw AIHubError.serverError(
                statusCode: httpResponse.statusCode,
                message: errorResponse?.error ?? "Unknown error",
                details: nil
            )
        }
    }
}

// MARK: - Convenience Extensions

public extension AIHubClient {
    /// Checks if the user has enough tokens for an operation
    /// - Parameter cost: The token cost to check
    /// - Returns: True if user has sufficient balance
    func hasEnoughTokens(for cost: Int) async throws -> Bool {
        let balance = try await getBalance()
        return balance >= cost
    }
}

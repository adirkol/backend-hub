import Foundation

/// Errors that can occur when using the AIHub SDK
public enum AIHubError: LocalizedError {
    /// Invalid configuration provided
    case invalidConfiguration(String)
    
    /// Invalid URL constructed
    case invalidURL(String)
    
    /// Network request failed
    case networkError(Error)
    
    /// Server returned an error response
    case serverError(statusCode: Int, message: String, details: [String: Any]?)
    
    /// Authentication failed (invalid API key)
    case unauthorized(String)
    
    /// User not found
    case userNotFound(String)
    
    /// Job not found
    case jobNotFound(String)
    
    /// Insufficient tokens for the operation
    case insufficientTokens(balance: Int, required: Int)
    
    /// Rate limit exceeded
    case rateLimitExceeded(retryAfter: Int?)
    
    /// Model not found
    case modelNotFound(String)
    
    /// Generation job failed
    case generationFailed(message: String?, errorCode: String?)
    
    /// Operation timed out
    case timeout(TimeInterval)
    
    /// Job cannot be cancelled (not in QUEUED status)
    case cannotCancelJob(currentStatus: String)
    
    /// Failed to decode response
    case decodingError(Error)
    
    /// Unknown error
    case unknown(String)
    
    public var errorDescription: String? {
        switch self {
        case .invalidConfiguration(let message):
            return "Invalid configuration: \(message)"
        case .invalidURL(let url):
            return "Invalid URL: \(url)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .serverError(let statusCode, let message, _):
            return "Server error (\(statusCode)): \(message)"
        case .unauthorized(let message):
            return "Authentication failed: \(message)"
        case .userNotFound(let userId):
            return "User not found: \(userId)"
        case .jobNotFound(let jobId):
            return "Job not found: \(jobId)"
        case .insufficientTokens(let balance, let required):
            return "Insufficient tokens. Balance: \(balance), Required: \(required)"
        case .rateLimitExceeded(let retryAfter):
            if let retryAfter = retryAfter {
                return "Rate limit exceeded. Retry after \(retryAfter) seconds"
            }
            return "Rate limit exceeded"
        case .modelNotFound(let model):
            return "Model not found: \(model)"
        case .generationFailed(let message, let errorCode):
            var desc = "Generation failed"
            if let code = errorCode { desc += " [\(code)]" }
            if let msg = message { desc += ": \(msg)" }
            return desc
        case .timeout(let duration):
            return "Operation timed out after \(Int(duration)) seconds"
        case .cannotCancelJob(let status):
            return "Cannot cancel job with status: \(status)"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .unknown(let message):
            return "Unknown error: \(message)"
        }
    }
    
    /// Returns true if this error is recoverable by retrying
    public var isRetryable: Bool {
        switch self {
        case .networkError, .rateLimitExceeded, .timeout:
            return true
        case .serverError(let statusCode, _, _):
            return statusCode >= 500
        default:
            return false
        }
    }
}

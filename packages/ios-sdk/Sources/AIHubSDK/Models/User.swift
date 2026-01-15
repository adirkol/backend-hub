import Foundation

/// An app user
public struct AIHubUser: Codable, Sendable, Identifiable {
    /// The external ID used to identify this user
    public var id: String { externalId }
    
    /// The external ID (your app's user identifier)
    public let externalId: String
    
    /// Current token balance
    public let tokenBalance: Int
    
    /// Total jobs submitted by this user
    public let totalJobs: Int?
    
    /// Successful jobs by this user
    public let successfulJobs: Int?
    
    /// Whether the user is active
    public let isActive: Bool
    
    /// Custom metadata attached to the user
    public let metadata: [String: AnyCodable]?
    
    /// Daily grant information (if enabled for the app)
    public let dailyGrant: DailyGrantInfo?
    
    /// When the user was created
    public let createdAt: Date
    
    private enum CodingKeys: String, CodingKey {
        case externalId = "external_id"
        case tokenBalance = "token_balance"
        case totalJobs = "total_jobs"
        case successfulJobs = "successful_jobs"
        case isActive = "is_active"
        case metadata
        case dailyGrant = "daily_grant"
        case createdAt = "created_at"
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        externalId = try container.decode(String.self, forKey: .externalId)
        tokenBalance = try container.decode(Int.self, forKey: .tokenBalance)
        totalJobs = try container.decodeIfPresent(Int.self, forKey: .totalJobs)
        successfulJobs = try container.decodeIfPresent(Int.self, forKey: .successfulJobs)
        isActive = try container.decodeIfPresent(Bool.self, forKey: .isActive) ?? true
        metadata = try container.decodeIfPresent([String: AnyCodable].self, forKey: .metadata)
        dailyGrant = try container.decodeIfPresent(DailyGrantInfo.self, forKey: .dailyGrant)
        
        let dateString = try container.decode(String.self, forKey: .createdAt)
        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = dateFormatter.date(from: dateString) {
            createdAt = date
        } else {
            dateFormatter.formatOptions = [.withInternetDateTime]
            createdAt = dateFormatter.date(from: dateString) ?? Date()
        }
    }
}

/// Information about daily token grants
public struct DailyGrantInfo: Codable, Sendable {
    /// Whether daily grants are enabled for this app
    public let enabled: Bool
    
    /// Amount of tokens granted daily
    public let amount: Int
    
    /// Whether tokens were granted in this request
    public let grantedNow: Bool
    
    /// Tokens that were granted (if grantedNow is true)
    public let tokensGranted: Int
    
    /// When the next daily grant will be available
    public let nextAvailableAt: Date?
    
    private enum CodingKeys: String, CodingKey {
        case enabled
        case amount
        case grantedNow = "granted_now"
        case tokensGranted = "tokens_granted"
        case nextAvailableAt = "next_available_at"
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        enabled = try container.decode(Bool.self, forKey: .enabled)
        amount = try container.decode(Int.self, forKey: .amount)
        grantedNow = try container.decode(Bool.self, forKey: .grantedNow)
        tokensGranted = try container.decode(Int.self, forKey: .tokensGranted)
        
        if let dateString = try container.decodeIfPresent(String.self, forKey: .nextAvailableAt) {
            let dateFormatter = ISO8601DateFormatter()
            dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = dateFormatter.date(from: dateString) {
                nextAvailableAt = date
            } else {
                dateFormatter.formatOptions = [.withInternetDateTime]
                nextAvailableAt = dateFormatter.date(from: dateString)
            }
        } else {
            nextAvailableAt = nil
        }
    }
}

/// Response from creating/registering a user
public struct CreateUserResponse: Codable {
    /// Whether the operation succeeded
    public let success: Bool
    
    /// Whether a new user was created (false if existing)
    public let created: Bool
    
    /// Whether tokens were synced (for RevenueCat webhook users)
    public let synced: Bool
    
    /// The user object
    public let user: CreateUserResponseUser
}

/// User info in create response (subset of full user)
public struct CreateUserResponseUser: Codable {
    public let externalId: String
    public let tokenBalance: Int
    public let isActive: Bool
    public let metadata: [String: AnyCodable]?
    public let createdAt: Date
    
    private enum CodingKeys: String, CodingKey {
        case externalId = "external_id"
        case tokenBalance = "token_balance"
        case isActive = "is_active"
        case metadata
        case createdAt = "created_at"
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        externalId = try container.decode(String.self, forKey: .externalId)
        tokenBalance = try container.decode(Int.self, forKey: .tokenBalance)
        isActive = try container.decodeIfPresent(Bool.self, forKey: .isActive) ?? true
        metadata = try container.decodeIfPresent([String: AnyCodable].self, forKey: .metadata)
        
        let dateString = try container.decode(String.self, forKey: .createdAt)
        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = dateFormatter.date(from: dateString) {
            createdAt = date
        } else {
            dateFormatter.formatOptions = [.withInternetDateTime]
            createdAt = dateFormatter.date(from: dateString) ?? Date()
        }
    }
}

/// Request to create/register a user
public struct CreateUserRequest: Encodable {
    public let externalId: String
    public let metadata: [String: AnyCodable]?
    public let initialTokens: Int?
    
    private enum CodingKeys: String, CodingKey {
        case externalId = "external_id"
        case metadata
        case initialTokens = "initial_tokens"
    }
    
    public init(
        externalId: String,
        metadata: [String: Any]? = nil,
        initialTokens: Int? = nil
    ) {
        self.externalId = externalId
        self.metadata = metadata?.mapValues { AnyCodable($0) }
        self.initialTokens = initialTokens
    }
}

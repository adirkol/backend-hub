import Foundation

/// Response from granting tokens
public struct GrantTokensResponse: Codable {
    public let externalId: String
    public let previousBalance: Int
    public let amountAdded: Int
    public let newBalance: Int
    public let transactionId: String
    public let expiresAt: Date?
    
    private enum CodingKeys: String, CodingKey {
        case externalId = "external_id"
        case previousBalance = "previous_balance"
        case amountAdded = "amount_added"
        case newBalance = "new_balance"
        case transactionId = "transaction_id"
        case expiresAt = "expires_at"
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        externalId = try container.decode(String.self, forKey: .externalId)
        previousBalance = try container.decode(Int.self, forKey: .previousBalance)
        amountAdded = try container.decode(Int.self, forKey: .amountAdded)
        newBalance = try container.decode(Int.self, forKey: .newBalance)
        transactionId = try container.decode(String.self, forKey: .transactionId)
        
        if let dateString = try container.decodeIfPresent(String.self, forKey: .expiresAt) {
            let dateFormatter = ISO8601DateFormatter()
            dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = dateFormatter.date(from: dateString) {
                expiresAt = date
            } else {
                dateFormatter.formatOptions = [.withInternetDateTime]
                expiresAt = dateFormatter.date(from: dateString)
            }
        } else {
            expiresAt = nil
        }
    }
}

/// A token transaction in the history
public struct TokenTransaction: Codable, Identifiable {
    public let id: String
    public let amount: Int
    public let balanceAfter: Int
    public let type: TokenTransactionType
    public let description: String?
    public let jobId: String?
    public let expiresAt: Date?
    public let createdAt: Date
    
    private enum CodingKeys: String, CodingKey {
        case id
        case amount
        case balanceAfter = "balance_after"
        case type
        case description
        case jobId = "job_id"
        case expiresAt = "expires_at"
        case createdAt = "created_at"
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        id = try container.decode(String.self, forKey: .id)
        amount = try container.decode(Int.self, forKey: .amount)
        balanceAfter = try container.decode(Int.self, forKey: .balanceAfter)
        type = try container.decode(TokenTransactionType.self, forKey: .type)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        jobId = try container.decodeIfPresent(String.self, forKey: .jobId)
        
        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        if let expiresAtString = try container.decodeIfPresent(String.self, forKey: .expiresAt) {
            if let date = dateFormatter.date(from: expiresAtString) {
                expiresAt = date
            } else {
                dateFormatter.formatOptions = [.withInternetDateTime]
                expiresAt = dateFormatter.date(from: expiresAtString)
            }
        } else {
            expiresAt = nil
        }
        
        dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let createdAtString = try container.decode(String.self, forKey: .createdAt)
        if let date = dateFormatter.date(from: createdAtString) {
            createdAt = date
        } else {
            dateFormatter.formatOptions = [.withInternetDateTime]
            createdAt = dateFormatter.date(from: createdAtString) ?? Date()
        }
    }
}

/// Type of token transaction
public enum TokenTransactionType: String, Codable {
    case grant
    case debit
    case refund
    case expire
}

/// Response from getting token history
public struct TokenHistoryResponse: Codable {
    public let externalId: String
    public let currentBalance: Int
    public let transactions: [TokenTransaction]
    
    private enum CodingKeys: String, CodingKey {
        case externalId = "external_id"
        case currentBalance = "current_balance"
        case transactions
    }
}

/// Error response from the API
internal struct APIErrorResponse: Codable {
    let error: String
    let details: APIErrorDetails?
    let balance: Int?
    let required: Int?
    let retryAfter: Int?
    let currentStatus: String?
    
    private enum CodingKeys: String, CodingKey {
        case error
        case details
        case balance
        case required
        case retryAfter = "retry_after"
        case currentStatus = "current_status"
    }
}

internal struct APIErrorDetails: Codable {
    let fieldErrors: [String: [String]]?
    let formErrors: [String]?
    
    private enum CodingKeys: String, CodingKey {
        case fieldErrors
        case formErrors
    }
}

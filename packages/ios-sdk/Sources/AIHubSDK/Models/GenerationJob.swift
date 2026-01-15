import Foundation

/// Status of a generation job
public enum JobStatus: String, Codable, CaseIterable {
    case queued = "queued"
    case running = "running"
    case succeeded = "succeeded"
    case failed = "failed"
    case cancelled = "cancelled"
    
    /// Returns true if the job is in a terminal state
    public var isTerminal: Bool {
        switch self {
        case .succeeded, .failed, .cancelled:
            return true
        case .queued, .running:
            return false
        }
    }
    
    /// Returns true if the job completed successfully
    public var isSuccess: Bool {
        self == .succeeded
    }
}

/// Output from a successful generation
public struct GenerationOutput: Codable, Sendable {
    /// URL to the generated image
    public let url: String
    
    /// Index of this output (for multi-output generations)
    public let index: Int?
    
    public init(url: String, index: Int? = nil) {
        self.url = url
        self.index = index
    }
}

/// A generation job
public struct GenerationJob: Codable, Sendable, Identifiable {
    /// Unique identifier for the job
    public let id: String
    
    /// Current status of the job
    public let status: JobStatus
    
    /// Model used for generation
    public let model: String
    
    /// User who created this job
    public let userId: String
    
    /// Tokens charged for this generation
    public let tokensCharged: Int
    
    /// Generated outputs (available when status is succeeded)
    public let outputs: [GenerationOutput]?
    
    /// Provider that processed the job (available when completed)
    public let providerUsed: String?
    
    /// Error message (available when status is failed)
    public let error: String?
    
    /// Error code (available when status is failed)
    public let errorCode: String?
    
    /// Whether tokens were refunded (for failed jobs)
    public let tokensRefunded: Bool?
    
    /// When the job was created
    public let createdAt: Date
    
    /// When the job started processing
    public let startedAt: Date?
    
    /// When the job completed
    public let completedAt: Date?
    
    private enum CodingKeys: String, CodingKey {
        case id = "job_id"
        case status
        case model
        case userId = "user_id"
        case tokensCharged = "tokens_charged"
        case outputs
        case providerUsed = "provider_used"
        case error
        case errorCode = "error_code"
        case tokensRefunded = "tokens_refunded"
        case createdAt = "created_at"
        case startedAt = "started_at"
        case completedAt = "completed_at"
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        id = try container.decode(String.self, forKey: .id)
        status = try container.decode(JobStatus.self, forKey: .status)
        model = try container.decode(String.self, forKey: .model)
        userId = try container.decode(String.self, forKey: .userId)
        tokensCharged = try container.decode(Int.self, forKey: .tokensCharged)
        outputs = try container.decodeIfPresent([GenerationOutput].self, forKey: .outputs)
        providerUsed = try container.decodeIfPresent(String.self, forKey: .providerUsed)
        error = try container.decodeIfPresent(String.self, forKey: .error)
        errorCode = try container.decodeIfPresent(String.self, forKey: .errorCode)
        tokensRefunded = try container.decodeIfPresent(Bool.self, forKey: .tokensRefunded)
        
        // Parse dates
        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        let createdAtString = try container.decode(String.self, forKey: .createdAt)
        if let date = dateFormatter.date(from: createdAtString) {
            createdAt = date
        } else {
            // Try without fractional seconds
            dateFormatter.formatOptions = [.withInternetDateTime]
            createdAt = dateFormatter.date(from: createdAtString) ?? Date()
        }
        
        if let startedAtString = try container.decodeIfPresent(String.self, forKey: .startedAt) {
            dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = dateFormatter.date(from: startedAtString) {
                startedAt = date
            } else {
                dateFormatter.formatOptions = [.withInternetDateTime]
                startedAt = dateFormatter.date(from: startedAtString)
            }
        } else {
            startedAt = nil
        }
        
        if let completedAtString = try container.decodeIfPresent(String.self, forKey: .completedAt) {
            dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = dateFormatter.date(from: completedAtString) {
                completedAt = date
            } else {
                dateFormatter.formatOptions = [.withInternetDateTime]
                completedAt = dateFormatter.date(from: completedAtString)
            }
        } else {
            completedAt = nil
        }
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        
        try container.encode(id, forKey: .id)
        try container.encode(status, forKey: .status)
        try container.encode(model, forKey: .model)
        try container.encode(userId, forKey: .userId)
        try container.encode(tokensCharged, forKey: .tokensCharged)
        try container.encodeIfPresent(outputs, forKey: .outputs)
        try container.encodeIfPresent(providerUsed, forKey: .providerUsed)
        try container.encodeIfPresent(error, forKey: .error)
        try container.encodeIfPresent(errorCode, forKey: .errorCode)
        try container.encodeIfPresent(tokensRefunded, forKey: .tokensRefunded)
        
        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        try container.encode(dateFormatter.string(from: createdAt), forKey: .createdAt)
        if let startedAt = startedAt {
            try container.encode(dateFormatter.string(from: startedAt), forKey: .startedAt)
        }
        if let completedAt = completedAt {
            try container.encode(dateFormatter.string(from: completedAt), forKey: .completedAt)
        }
    }
}

/// Request parameters for generation
public struct GenerationRequest: Encodable {
    /// The model to use for generation
    public let model: String
    
    /// The input parameters
    public let input: GenerationInput
    
    /// Priority of this job (1-100, higher = higher priority)
    public let priority: Int?
    
    /// Webhook URL to call when job completes
    public let webhookURL: String?
    
    /// Idempotency key to prevent duplicate requests
    public let idempotencyKey: String?
    
    /// Whether to store outputs permanently in cloud storage
    public let storeOutputs: Bool
    
    private enum CodingKeys: String, CodingKey {
        case model
        case input
        case priority
        case webhookURL = "webhook_url"
        case idempotencyKey = "idempotency_key"
        case storeOutputs = "store_outputs"
    }
    
    public init(
        model: String,
        input: GenerationInput,
        priority: Int? = nil,
        webhookURL: String? = nil,
        idempotencyKey: String? = nil,
        storeOutputs: Bool = false
    ) {
        self.model = model
        self.input = input
        self.priority = priority
        self.webhookURL = webhookURL
        self.idempotencyKey = idempotencyKey
        self.storeOutputs = storeOutputs
    }
}

/// Input parameters for generation
public struct GenerationInput: Encodable {
    /// Text prompt for generation
    public let prompt: String?
    
    /// Input image URLs
    public let images: [String]?
    
    /// Aspect ratio (e.g., "1:1", "16:9", "9:16")
    public let aspectRatio: String
    
    /// Number of outputs to generate
    public let numOutputs: Int
    
    /// Additional provider-specific parameters
    public let additionalParams: [String: AnyCodable]?
    
    private enum CodingKeys: String, CodingKey {
        case prompt
        case images
        case aspectRatio = "aspect_ratio"
        case numOutputs = "num_outputs"
    }
    
    public init(
        prompt: String? = nil,
        images: [String]? = nil,
        aspectRatio: String = "1:1",
        numOutputs: Int = 1,
        additionalParams: [String: AnyCodable]? = nil
    ) {
        self.prompt = prompt
        self.images = images
        self.aspectRatio = aspectRatio
        self.numOutputs = numOutputs
        self.additionalParams = additionalParams
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(prompt, forKey: .prompt)
        try container.encodeIfPresent(images, forKey: .images)
        try container.encode(aspectRatio, forKey: .aspectRatio)
        try container.encode(numOutputs, forKey: .numOutputs)
        
        // Encode additional params at root level
        if let additionalParams = additionalParams {
            var dynamicContainer = encoder.container(keyedBy: DynamicCodingKey.self)
            for (key, value) in additionalParams {
                try dynamicContainer.encode(value, forKey: DynamicCodingKey(stringValue: key))
            }
        }
    }
}

/// Response from submitting a generation request
public struct GenerationSubmitResponse: Codable {
    public let jobId: String
    public let status: String
    public let model: String
    public let tokensCharged: Int
    public let userBalance: Int
    public let message: String?
    
    private enum CodingKeys: String, CodingKey {
        case jobId = "job_id"
        case status
        case model
        case tokensCharged = "tokens_charged"
        case userBalance = "user_balance"
        case message
    }
}

/// Response from cancelling a job
public struct CancelJobResponse: Codable {
    public let jobId: String
    public let status: String
    public let tokensRefunded: Int
    public let userBalance: Int
    public let cancelledAt: Date
    
    private enum CodingKeys: String, CodingKey {
        case jobId = "job_id"
        case status
        case tokensRefunded = "tokens_refunded"
        case userBalance = "user_balance"
        case cancelledAt = "cancelled_at"
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        jobId = try container.decode(String.self, forKey: .jobId)
        status = try container.decode(String.self, forKey: .status)
        tokensRefunded = try container.decode(Int.self, forKey: .tokensRefunded)
        userBalance = try container.decode(Int.self, forKey: .userBalance)
        
        let dateString = try container.decode(String.self, forKey: .cancelledAt)
        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = dateFormatter.date(from: dateString) {
            cancelledAt = date
        } else {
            dateFormatter.formatOptions = [.withInternetDateTime]
            cancelledAt = dateFormatter.date(from: dateString) ?? Date()
        }
    }
}

// MARK: - Helper Types

/// A type-erased Codable value
public struct AnyCodable: Codable, @unchecked Sendable {
    public let value: Any
    
    public init(_ value: Any) {
        self.value = value
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        
        if container.decodeNil() {
            self.value = NSNull()
        } else if let bool = try? container.decode(Bool.self) {
            self.value = bool
        } else if let int = try? container.decode(Int.self) {
            self.value = int
        } else if let double = try? container.decode(Double.self) {
            self.value = double
        } else if let string = try? container.decode(String.self) {
            self.value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            self.value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            self.value = dict.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode value")
        }
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        
        switch value {
        case is NSNull:
            try container.encodeNil()
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            throw EncodingError.invalidValue(value, .init(codingPath: encoder.codingPath, debugDescription: "Cannot encode value"))
        }
    }
}

/// Dynamic coding key for encoding additional parameters
internal struct DynamicCodingKey: CodingKey {
    var stringValue: String
    var intValue: Int? { nil }
    
    init(stringValue: String) {
        self.stringValue = stringValue
    }
    
    init?(intValue: Int) {
        return nil
    }
}

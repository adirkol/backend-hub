import XCTest
@testable import AIHubSDK

final class AIHubSDKTests: XCTestCase {
    
    // MARK: - Configuration Tests
    
    func testConfigurationInitialization() throws {
        let config = AIHubConfiguration(
            apiKey: "test-key",
            baseURL: URL(string: "https://api.example.com")!
        )
        
        XCTAssertEqual(config.apiKey, "test-key")
        XCTAssertEqual(config.baseURL.absoluteString, "https://api.example.com")
        XCTAssertEqual(config.timeoutInterval, 30)
    }
    
    func testConfigurationWithStringURL() throws {
        let config = try AIHubConfiguration(
            apiKey: "test-key",
            baseURLString: "https://api.example.com"
        )
        
        XCTAssertEqual(config.baseURL.absoluteString, "https://api.example.com")
    }
    
    func testConfigurationInvalidURL() {
        XCTAssertThrowsError(try AIHubConfiguration(
            apiKey: "test-key",
            baseURLString: "not a valid url"
        ))
    }
    
    // MARK: - Model Tests
    
    func testJobStatusIsTerminal() {
        XCTAssertFalse(JobStatus.queued.isTerminal)
        XCTAssertFalse(JobStatus.running.isTerminal)
        XCTAssertTrue(JobStatus.succeeded.isTerminal)
        XCTAssertTrue(JobStatus.failed.isTerminal)
        XCTAssertTrue(JobStatus.cancelled.isTerminal)
    }
    
    func testJobStatusIsSuccess() {
        XCTAssertFalse(JobStatus.queued.isSuccess)
        XCTAssertFalse(JobStatus.running.isSuccess)
        XCTAssertTrue(JobStatus.succeeded.isSuccess)
        XCTAssertFalse(JobStatus.failed.isSuccess)
        XCTAssertFalse(JobStatus.cancelled.isSuccess)
    }
    
    // MARK: - Error Tests
    
    func testErrorIsRetryable() {
        XCTAssertTrue(AIHubError.networkError(NSError(domain: "", code: 0)).isRetryable)
        XCTAssertTrue(AIHubError.rateLimitExceeded(retryAfter: 60).isRetryable)
        XCTAssertTrue(AIHubError.timeout(30).isRetryable)
        XCTAssertTrue(AIHubError.serverError(statusCode: 500, message: "", details: nil).isRetryable)
        XCTAssertTrue(AIHubError.serverError(statusCode: 503, message: "", details: nil).isRetryable)
        
        XCTAssertFalse(AIHubError.unauthorized("").isRetryable)
        XCTAssertFalse(AIHubError.insufficientTokens(balance: 0, required: 10).isRetryable)
        XCTAssertFalse(AIHubError.serverError(statusCode: 400, message: "", details: nil).isRetryable)
    }
    
    func testErrorDescriptions() {
        let insufficientError = AIHubError.insufficientTokens(balance: 5, required: 10)
        XCTAssertTrue(insufficientError.errorDescription?.contains("5") ?? false)
        XCTAssertTrue(insufficientError.errorDescription?.contains("10") ?? false)
        
        let rateLimitError = AIHubError.rateLimitExceeded(retryAfter: 60)
        XCTAssertTrue(rateLimitError.errorDescription?.contains("60") ?? false)
    }
    
    // MARK: - AnyCodable Tests
    
    func testAnyCodableEncoding() throws {
        let value = AnyCodable(["key": "value", "number": 42])
        let data = try JSONEncoder().encode(value)
        let decoded = try JSONDecoder().decode(AnyCodable.self, from: data)
        
        if let dict = decoded.value as? [String: Any] {
            XCTAssertEqual(dict["key"] as? String, "value")
            XCTAssertEqual(dict["number"] as? Int, 42)
        } else {
            XCTFail("Failed to decode dictionary")
        }
    }
    
    // MARK: - Generation Input Tests
    
    func testGenerationInputDefaults() {
        let input = GenerationInput(prompt: "test")
        
        XCTAssertEqual(input.prompt, "test")
        XCTAssertNil(input.images)
        XCTAssertEqual(input.aspectRatio, "1:1")
        XCTAssertEqual(input.numOutputs, 1)
    }
    
    func testGenerationInputCustomValues() {
        let input = GenerationInput(
            prompt: "test prompt",
            images: ["https://example.com/image.jpg"],
            aspectRatio: "16:9",
            numOutputs: 2
        )
        
        XCTAssertEqual(input.prompt, "test prompt")
        XCTAssertEqual(input.images?.count, 1)
        XCTAssertEqual(input.aspectRatio, "16:9")
        XCTAssertEqual(input.numOutputs, 2)
    }
}

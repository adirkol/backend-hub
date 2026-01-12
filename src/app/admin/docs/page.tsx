import { prisma } from "@/lib/db";
import { BookOpen, Key, Zap, CheckCircle, Clock } from "lucide-react";
import { TabbedCodeBlock } from "./code-examples";

async function getModels() {
  return prisma.aIModel.findMany({
    where: { isEnabled: true },
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      name: true,
      displayName: true,
      description: true,
      tokenCost: true,
      supportsImages: true,
      supportsPrompt: true,
      maxInputImages: true,
      supportedAspectRatios: true,
    },
  });
}

function Section({ 
  id, 
  title, 
  children 
}: { 
  id: string; 
  title: string; 
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ scrollMarginTop: "100px" }}>
      <h2 style={{ 
        fontSize: "22px", 
        fontWeight: "600", 
        color: "#fafafa", 
        marginBottom: "20px",
        paddingBottom: "12px",
        borderBottom: "1px solid rgba(63, 63, 70, 0.3)",
      }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function EndpointCard({
  method,
  path,
  description,
  children,
}: {
  method: "GET" | "POST" | "DELETE";
  path: string;
  description: string;
  children?: React.ReactNode;
}) {
  const methodColors = {
    GET: { bg: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", border: "rgba(59, 130, 246, 0.3)" },
    POST: { bg: "rgba(16, 185, 129, 0.15)", color: "#34d399", border: "rgba(16, 185, 129, 0.3)" },
    DELETE: { bg: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "rgba(239, 68, 68, 0.3)" },
  };

  const colors = methodColors[method];

  return (
    <div className="glass" style={{ padding: "24px", marginBottom: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
        <span style={{
          padding: "4px 10px",
          borderRadius: "6px",
          fontSize: "12px",
          fontWeight: "700",
          background: colors.bg,
          color: colors.color,
          border: `1px solid ${colors.border}`,
        }}>
          {method}
        </span>
        <code style={{ 
          fontSize: "15px", 
          color: "#fafafa", 
          fontWeight: "500",
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {path}
        </code>
      </div>
      <p style={{ color: "#b8b8c8", fontSize: "14px", marginBottom: children ? "20px" : 0 }}>
        {description}
      </p>
      {children}
    </div>
  );
}

export default async function DocsPage() {
  const models = await getModels();
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.yourdomain.com";

  // Code examples for each endpoint
  const generateExamples = {
    curl: `curl -X POST "${baseUrl}/api/v1/generate" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your_api_key" \\
  -H "X-User-ID: user_123" \\
  -d '{
    "model": "flux-dev",
    "prompt": "A beautiful mountain landscape at sunset",
    "aspect_ratio": "16:9"
  }'`,
    swift: `// Create a generation request
func generateImage() async throws -> GenerationJob {
    let client = AIHubClient(
        apiKey: "your_api_key",
        userId: "user_123"
    )
    
    let job = try await client.generate(
        model: "flux-dev",
        prompt: "A beautiful mountain landscape at sunset",
        aspectRatio: "16:9"
    )
    
    print("Job created: \\(job.id)")
    return job
}`,
  };

  const jobStatusExamples = {
    curl: `# Get job status
curl "${baseUrl}/api/v1/jobs/JOB_ID_HERE" \\
  -H "X-API-Key: your_api_key" \\
  -H "X-User-ID: user_123"`,
    swift: `// Poll for job completion
func waitForResult(jobId: String) async throws -> GenerationJob {
    let client = AIHubClient(
        apiKey: "your_api_key",
        userId: "user_123"
    )
    
    // Poll until complete (with 2s interval, 120s timeout)
    let result = try await client.waitForCompletion(
        jobId: jobId,
        pollInterval: 2.0,
        timeout: 120.0
    )
    
    if let output = result.outputs?.first {
        print("Generated image: \\(output.url)")
    }
    
    return result
}`,
  };

  const cancelJobExamples = {
    curl: `# Cancel a queued job
curl -X DELETE "${baseUrl}/api/v1/jobs/JOB_ID_HERE" \\
  -H "X-API-Key: your_api_key" \\
  -H "X-User-ID: user_123"`,
    swift: `// Cancel a job
func cancelJob(jobId: String) async throws -> CancelResponse {
    let client = AIHubClient(
        apiKey: "your_api_key",
        userId: "user_123"
    )
    
    let result = try await client.cancelJob(id: jobId)
    
    print("Job cancelled, tokens refunded: \\(result.tokensRefunded)")
    print("New balance: \\(result.userBalance)")
    
    return result
}

struct CancelResponse: Codable {
    let jobId: String
    let status: String
    let tokensRefunded: Int
    let userBalance: Int
    let cancelledAt: String
}`,
  };

  const createUserExamples = {
    curl: `# Register a new user (call on first app launch)
curl -X POST "${baseUrl}/api/v1/users" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your_api_key" \\
  -d '{
    "external_id": "user_unique_id",
    "metadata": {
      "device": "iPhone 15",
      "app_version": "1.0.0"
    }
  }'`,
    swift: `// Register user on first app launch
func registerUser(userId: String) async throws -> UserProfile {
    var request = URLRequest(url: URL(string: "${baseUrl}/api/v1/users")!)
    request.httpMethod = "POST"
    request.setValue("your_api_key", forHTTPHeaderField: "X-API-Key")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    let body: [String: Any] = [
        "external_id": userId,
        "metadata": [
            "device": UIDevice.current.model,
            "app_version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        ]
    ]
    request.httpBody = try JSONSerialization.data(withJSONObject: body)
    
    let (data, response) = try await URLSession.shared.data(for: request)
    guard (response as? HTTPURLResponse)?.statusCode == 201 ||
          (response as? HTTPURLResponse)?.statusCode == 200 else {
        throw NSError(domain: "RegistrationError", code: -1)
    }
    
    let result = try JSONDecoder().decode(CreateUserResponse.self, from: data)
    print("User registered: \\(result.user.external_id), Balance: \\(result.user.token_balance)")
    return result.user
}

struct CreateUserResponse: Codable {
    let success: Bool
    let created: Bool
    let user: UserProfile
}

struct UserProfile: Codable {
    let external_id: String
    let token_balance: Int
    let is_active: Bool
    let created_at: String
}`,
  };

  const userInfoExamples = {
    curl: `# Get user info and token balance
curl "${baseUrl}/api/v1/users/user_123" \\
  -H "X-API-Key: your_api_key" \\
  -H "X-User-ID: user_123"`,
    swift: `// Get user's token balance
func checkBalance() async throws -> Int {
    let client = AIHubClient(
        apiKey: "your_api_key",
        userId: "user_123"
    )
    
    let balance = try await client.getUserBalance()
    print("Current balance: \\(balance) tokens")
    
    return balance
}`,
  };

  const grantTokensExamples = {
    curl: `# Grant tokens to a user
curl -X POST "${baseUrl}/api/v1/users/user_123/tokens" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your_api_key" \\
  -H "X-User-ID: user_123" \\
  -d '{
    "amount": 100,
    "description": "Purchase - Premium Pack"
  }'`,
    swift: `// Grant tokens (typically called from your backend, not iOS app)
func grantTokens(userId: String, amount: Int) async throws {
    var request = URLRequest(url: URL(string: "${baseUrl}/api/v1/users/\\(userId)/tokens")!)
    request.httpMethod = "POST"
    request.setValue("your_api_key", forHTTPHeaderField: "X-API-Key")
    request.setValue(userId, forHTTPHeaderField: "X-User-ID")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    let body = ["amount": amount, "description": "Purchase"] as [String: Any]
    request.httpBody = try JSONSerialization.data(withJSONObject: body)
    
    let (_, response) = try await URLSession.shared.data(for: request)
    guard (response as? HTTPURLResponse)?.statusCode == 200 else {
        throw NSError(domain: "TokenError", code: -1)
    }
}`,
  };

  const fullClientExample = {
    swift: `import Foundation

class AIHubClient {
    private let baseURL: String
    private let apiKey: String
    private let userId: String
    
    init(apiKey: String, userId: String, baseURL: String = "${baseUrl}/api/v1") {
        self.apiKey = apiKey
        self.userId = userId
        self.baseURL = baseURL
    }
    
    // MARK: - Generate Image
    
    func generate(
        model: String,
        prompt: String?,
        images: [String]? = nil,
        aspectRatio: String = "1:1"
    ) async throws -> GenerationJob {
        var body: [String: Any] = ["model": model]
        if let prompt = prompt { body["prompt"] = prompt }
        if let images = images { body["images"] = images }
        body["aspect_ratio"] = aspectRatio
        
        let data = try await request(method: "POST", path: "/generate", body: body)
        let response = try JSONDecoder().decode(GenerateResponse.self, from: data)
        return response.job
    }
    
    // MARK: - Get Job Status
    
    func getJob(id: String) async throws -> GenerationJob {
        let data = try await request(method: "GET", path: "/jobs/\\(id)")
        let response = try JSONDecoder().decode(JobResponse.self, from: data)
        return response.job
    }
    
    // MARK: - Poll Until Complete
    
    func waitForCompletion(
        jobId: String,
        pollInterval: TimeInterval = 2.0,
        timeout: TimeInterval = 120.0
    ) async throws -> GenerationJob {
        let startTime = Date()
        
        while Date().timeIntervalSince(startTime) < timeout {
            let job = try await getJob(id: jobId)
            
            switch job.status {
            case "SUCCEEDED":
                return job
            case "FAILED":
                throw AIHubError.generationFailed(job.errorMessage)
            default:
                try await Task.sleep(nanoseconds: UInt64(pollInterval * 1_000_000_000))
            }
        }
        
        throw AIHubError.timeout
    }
    
    // MARK: - Get User Balance
    
    func getUserBalance() async throws -> Int {
        let data = try await request(method: "GET", path: "/users/\\(userId)")
        let response = try JSONDecoder().decode(UserResponse.self, from: data)
        return response.user.tokenBalance
    }
    
    // MARK: - Cancel Job
    
    func cancelJob(id: String) async throws -> CancelJobResponse {
        let data = try await request(method: "DELETE", path: "/jobs/\\(id)")
        return try JSONDecoder().decode(CancelJobResponse.self, from: data)
    }
    
    // MARK: - Private
    
    private func request(
        method: String,
        path: String,
        body: [String: Any]? = nil
    ) async throws -> Data {
        guard let url = URL(string: baseURL + path) else {
            throw AIHubError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        request.setValue(userId, forHTTPHeaderField: "X-User-ID")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let body = body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              200...299 ~= httpResponse.statusCode else {
            throw AIHubError.httpError((response as? HTTPURLResponse)?.statusCode ?? 0)
        }
        
        return data
    }
}

// MARK: - Models

struct GenerationJob: Codable {
    let id: String
    let status: String
    let outputs: [Output]?
    let tokenCost: Int
    let errorMessage: String?
    
    struct Output: Codable {
        let url: String
        let index: Int
    }
}

struct GenerateResponse: Codable { let success: Bool; let job: GenerationJob }
struct JobResponse: Codable { let success: Bool; let job: GenerationJob }
struct UserResponse: Codable {
    let success: Bool
    let user: User
    struct User: Codable { let externalId: String; let tokenBalance: Int }
}
struct CancelJobResponse: Codable {
    let jobId: String
    let status: String
    let tokensRefunded: Int
    let userBalance: Int
    let cancelledAt: String
}

enum AIHubError: Error {
    case invalidURL, invalidResponse, timeout
    case httpError(Int)
    case generationFailed(String?)
}`,
  };

  const usageExample = {
    swift: `// Complete usage example
import UIKit

class GenerateViewController: UIViewController {
    private let client = AIHubClient(
        apiKey: "your_api_key",
        userId: "user_unique_id"
    )
    
    @IBAction func generateTapped(_ sender: UIButton) {
        Task {
            do {
                // 1. Check balance first
                let balance = try await client.getUserBalance()
                guard balance >= 5 else {
                    showAlert("Insufficient tokens. Please purchase more.")
                    return
                }
                
                // 2. Submit generation request
                showLoading(true)
                let job = try await client.generate(
                    model: "flux-dev",
                    prompt: promptTextField.text ?? "",
                    aspectRatio: "1:1"
                )
                
                // 3. Wait for completion
                let result = try await client.waitForCompletion(jobId: job.id)
                
                // 4. Display result
                if let imageURL = result.outputs?.first?.url,
                   let url = URL(string: imageURL) {
                    let (data, _) = try await URLSession.shared.data(from: url)
                    resultImageView.image = UIImage(data: data)
                }
                
                showLoading(false)
            } catch {
                showLoading(false)
                showAlert("Error: \\(error.localizedDescription)")
            }
        }
    }
}`,
  };

  return (
    <div className="animate-fade-in" style={{ display: "flex", gap: "40px" }}>
      {/* Table of Contents */}
      <nav style={{
        width: "220px",
        flexShrink: 0,
        position: "sticky",
        top: "100px",
        alignSelf: "flex-start",
        height: "fit-content",
      }}>
        <h3 style={{ 
          fontSize: "12px", 
          fontWeight: "600", 
          color: "#9ca3af", 
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "16px",
        }}>
          On this page
        </h3>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            { id: "overview", label: "Overview" },
            { id: "authentication", label: "Authentication" },
            { id: "models", label: "Available Models" },
            { id: "create-user", label: "POST /users" },
            { id: "generate", label: "POST /generate" },
            { id: "job-status", label: "GET /jobs/:id" },
            { id: "cancel-job", label: "DELETE /jobs/:id" },
            { id: "user-info", label: "GET /users/:id" },
            { id: "grant-tokens", label: "POST /tokens" },
            { id: "full-client", label: "Full Swift Client" },
            { id: "errors", label: "Error Handling" },
          ].map((item) => (
            <li key={item.id}>
              <a 
                href={`#${item.id}`}
                style={{
                  fontSize: "14px",
                  color: "#b8b8c8",
                  textDecoration: "none",
                  display: "block",
                  padding: "4px 0",
                }}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "48px", maxWidth: "900px" }}>
        {/* Header */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px" }}>
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.3) 100%)",
              border: "1px solid rgba(59, 130, 246, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <BookOpen style={{ width: "24px", height: "24px", color: "#60a5fa" }} />
            </div>
            <div>
              <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa", letterSpacing: "-0.02em" }}>
                API Documentation
              </h1>
              <p style={{ color: "#9ca3af", fontSize: "15px" }}>
                Complete reference for integrating AI generation into your iOS app
              </p>
            </div>
          </div>
        </div>

        {/* Overview */}
        <Section id="overview" title="Overview">
          <p style={{ color: "#b8b8c8", fontSize: "15px", lineHeight: "1.7", marginBottom: "16px" }}>
            The AI Hub API allows you to generate AI content from your iOS application. 
            The API uses a simple request-response pattern with asynchronous job processing.
          </p>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
            <div style={{ 
              padding: "20px", 
              background: "rgba(39, 39, 42, 0.4)", 
              borderRadius: "12px",
              border: "1px solid rgba(63, 63, 70, 0.3)",
            }}>
              <Zap style={{ width: "24px", height: "24px", color: "#00f0ff", marginBottom: "12px" }} />
              <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#fafafa", marginBottom: "4px" }}>
                1. Submit Request
              </h4>
              <p style={{ fontSize: "13px", color: "#9ca3af" }}>
                POST to /generate with your prompt and images
              </p>
            </div>
            <div style={{ 
              padding: "20px", 
              background: "rgba(39, 39, 42, 0.4)", 
              borderRadius: "12px",
              border: "1px solid rgba(63, 63, 70, 0.3)",
            }}>
              <Clock style={{ width: "24px", height: "24px", color: "#fbbf24", marginBottom: "12px" }} />
              <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#fafafa", marginBottom: "4px" }}>
                2. Poll Status
              </h4>
              <p style={{ fontSize: "13px", color: "#9ca3af" }}>
                GET job status until completion
              </p>
            </div>
            <div style={{ 
              padding: "20px", 
              background: "rgba(39, 39, 42, 0.4)", 
              borderRadius: "12px",
              border: "1px solid rgba(63, 63, 70, 0.3)",
            }}>
              <CheckCircle style={{ width: "24px", height: "24px", color: "#60a5fa", marginBottom: "12px" }} />
              <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#fafafa", marginBottom: "4px" }}>
                3. Get Results
              </h4>
              <p style={{ fontSize: "13px", color: "#9ca3af" }}>
                Download generated images from URLs
              </p>
            </div>
          </div>

          <p style={{ color: "#9ca3af", fontSize: "14px" }}>
            Base URL: <code style={{ color: "#00f0ff", background: "rgba(0, 240, 255, 0.1)", padding: "2px 8px", borderRadius: "4px" }}>{baseUrl}/api/v1</code>
          </p>
        </Section>

        {/* Authentication */}
        <Section id="authentication" title="Authentication">
          <p style={{ color: "#b8b8c8", fontSize: "15px", lineHeight: "1.7", marginBottom: "16px" }}>
            All API requests require two headers for authentication:
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
            <div style={{ 
              padding: "16px 20px", 
              background: "rgba(39, 39, 42, 0.4)", 
              borderRadius: "10px",
              border: "1px solid rgba(63, 63, 70, 0.3)",
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}>
              <Key style={{ width: "20px", height: "20px", color: "#fbbf24", flexShrink: 0 }} />
              <div>
                <code style={{ fontSize: "14px", color: "#fafafa", fontWeight: "600" }}>X-API-Key</code>
                <p style={{ fontSize: "13px", color: "#9ca3af", marginTop: "4px" }}>
                  Your app&apos;s API key (found in Apps → Settings)
                </p>
              </div>
            </div>
            <div style={{ 
              padding: "16px 20px", 
              background: "rgba(39, 39, 42, 0.4)", 
              borderRadius: "10px",
              border: "1px solid rgba(63, 63, 70, 0.3)",
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}>
              <Key style={{ width: "20px", height: "20px", color: "#60a5fa", flexShrink: 0 }} />
              <div>
                <code style={{ fontSize: "14px", color: "#fafafa", fontWeight: "600" }}>X-User-ID</code>
                <p style={{ fontSize: "13px", color: "#9ca3af", marginTop: "4px" }}>
                  A unique identifier for your user (any string you choose)
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* Available Models */}
        <Section id="models" title="Available Models">
          <p style={{ color: "#b8b8c8", fontSize: "15px", lineHeight: "1.7", marginBottom: "20px" }}>
            The following AI models are available for generation. Use the <code style={{ color: "#00f0ff" }}>name</code> field in your API requests.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {models.map((model) => (
              <div 
                key={model.id}
                style={{ 
                  padding: "16px 20px", 
                  background: "rgba(39, 39, 42, 0.4)", 
                  borderRadius: "10px",
                  border: "1px solid rgba(63, 63, 70, 0.3)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "15px", fontWeight: "600", color: "#fafafa" }}>
                      {model.displayName}
                    </span>
                    <code style={{ 
                      fontSize: "12px", 
                      color: "#00f0ff",
                      background: "rgba(0, 240, 255, 0.1)",
                      padding: "2px 8px", 
                      borderRadius: "4px" 
                    }}>
                      {model.name}
                    </code>
                  </div>
                  <span style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    background: "rgba(168, 85, 247, 0.15)",
                    color: "#a78bfa",
                  }}>
                    {model.tokenCost} tokens
                  </span>
                </div>
                {model.description && (
                  <p style={{ fontSize: "13px", color: "#9ca3af", marginBottom: "8px" }}>
                    {model.description}
                  </p>
                )}
                <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "#71717a" }}>
                  <span>Images: {model.supportsImages ? `✓ max ${model.maxInputImages}` : "✗"}</span>
                  <span>Prompt: {model.supportsPrompt ? "✓" : "✗"}</span>
                  <span>Ratios: {model.supportedAspectRatios.slice(0, 3).join(", ")}{model.supportedAspectRatios.length > 3 ? "..." : ""}</span>
                </div>
              </div>
            ))}

            {models.length === 0 && (
              <p style={{ color: "#9ca3af", textAlign: "center", padding: "40px" }}>
                No models available
              </p>
            )}
          </div>
        </Section>

        {/* POST /users - Create User */}
        <Section id="create-user" title="POST /users">
          <EndpointCard 
            method="POST" 
            path="/api/v1/users"
            description="Register a new user for your app. Call this on first app launch. Idempotent - returns existing user if already registered."
          >
            <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#e4e4e7", marginBottom: "12px" }}>
              Request Body
            </h4>
            <div style={{ 
              padding: "16px", 
              background: "rgba(9, 9, 11, 0.6)", 
              borderRadius: "8px",
              marginBottom: "16px",
              fontSize: "13px",
              fontFamily: "monospace",
              color: "#b8b8c8",
            }}>
              <div><span style={{ color: "#9ca3af" }}>external_id</span>: <span style={{ color: "#fbbf24" }}>string</span> <span style={{ color: "#f87171" }}>required</span> <span style={{ color: "#71717a" }}>- your user&apos;s unique ID</span></div>
              <div><span style={{ color: "#9ca3af" }}>metadata</span>: <span style={{ color: "#fbbf24" }}>object</span> <span style={{ color: "#71717a" }}>optional - device info, app version, etc.</span></div>
            </div>

            <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#e4e4e7", marginBottom: "12px" }}>
              Response
            </h4>
            <div style={{ 
              padding: "16px", 
              background: "rgba(9, 9, 11, 0.6)", 
              borderRadius: "8px",
              fontSize: "13px",
              fontFamily: "monospace",
              color: "#b8b8c8",
            }}>
              <div><span style={{ color: "#9ca3af" }}>success</span>: <span style={{ color: "#34d399" }}>true</span></div>
              <div><span style={{ color: "#9ca3af" }}>created</span>: <span style={{ color: "#fbbf24" }}>boolean</span> <span style={{ color: "#71717a" }}>- true if new user, false if existing</span></div>
              <div><span style={{ color: "#9ca3af" }}>user.external_id</span>: <span style={{ color: "#fbbf24" }}>string</span></div>
              <div><span style={{ color: "#9ca3af" }}>user.token_balance</span>: <span style={{ color: "#fbbf24" }}>number</span> <span style={{ color: "#71717a" }}>- includes welcome bonus if configured</span></div>
            </div>
          </EndpointCard>

          <TabbedCodeBlock
            title="Register User Example"
            defaultOpen={true}
            tabs={[
              { language: "curl", label: "cURL", code: createUserExamples.curl },
              { language: "swift", label: "Swift", code: createUserExamples.swift },
            ]}
          />
        </Section>

        {/* POST /generate */}
        <Section id="generate" title="POST /generate">
          <EndpointCard 
            method="POST" 
            path="/api/v1/generate"
            description="Submit a new AI generation request. Returns a job ID for tracking."
          >
            <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#e4e4e7", marginBottom: "12px" }}>
              Request Body
            </h4>
            <div style={{ 
              padding: "16px", 
              background: "rgba(9, 9, 11, 0.6)", 
              borderRadius: "8px",
              marginBottom: "16px",
              fontSize: "13px",
              fontFamily: "monospace",
              color: "#b8b8c8",
            }}>
              <div><span style={{ color: "#9ca3af" }}>model</span>: <span style={{ color: "#fbbf24" }}>string</span> <span style={{ color: "#f87171" }}>required</span></div>
              <div><span style={{ color: "#9ca3af" }}>prompt</span>: <span style={{ color: "#fbbf24" }}>string</span> <span style={{ color: "#71717a" }}>optional</span></div>
              <div><span style={{ color: "#9ca3af" }}>images</span>: <span style={{ color: "#fbbf24" }}>string[]</span> <span style={{ color: "#71717a" }}>optional - URLs or base64</span></div>
              <div><span style={{ color: "#9ca3af" }}>aspect_ratio</span>: <span style={{ color: "#fbbf24" }}>string</span> <span style={{ color: "#71717a" }}>optional - default &quot;1:1&quot;</span></div>
            </div>
          </EndpointCard>

          <TabbedCodeBlock
            title="Generate Request Example"
            defaultOpen={true}
            tabs={[
              { language: "curl", label: "cURL", code: generateExamples.curl },
              { language: "swift", label: "Swift", code: generateExamples.swift },
            ]}
          />
        </Section>

        {/* GET /jobs/:id */}
        <Section id="job-status" title="GET /jobs/:id">
          <EndpointCard 
            method="GET" 
            path="/api/v1/jobs/:id"
            description="Get the current status and results of a generation job."
          >
            <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#e4e4e7", marginBottom: "12px" }}>
              Job Statuses
            </h4>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {[
                { status: "QUEUED", color: "#9ca3af" },
                { status: "RUNNING", color: "#fbbf24" },
                { status: "SUCCEEDED", color: "#34d399" },
                { status: "FAILED", color: "#f87171" },
                { status: "CANCELLED", color: "#a78bfa" },
              ].map((s) => (
                <span 
                  key={s.status}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    background: `${s.color}20`,
                    color: s.color,
                  }}
                >
                  {s.status}
                </span>
              ))}
            </div>
          </EndpointCard>

          <TabbedCodeBlock
            title="Get Job Status Example"
            defaultOpen={false}
            tabs={[
              { language: "curl", label: "cURL", code: jobStatusExamples.curl },
              { language: "swift", label: "Swift", code: jobStatusExamples.swift },
            ]}
          />
        </Section>

        {/* DELETE /jobs/:id */}
        <Section id="cancel-job" title="DELETE /jobs/:id">
          <EndpointCard 
            method="DELETE" 
            path="/api/v1/jobs/:id"
            description="Cancel a queued job and refund tokens. Only the user who created the job can cancel it."
          >
            <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#e4e4e7", marginBottom: "12px" }}>
              Requirements
            </h4>
            <div style={{ 
              padding: "16px", 
              background: "rgba(9, 9, 11, 0.6)", 
              borderRadius: "8px",
              marginBottom: "16px",
              fontSize: "13px",
              fontFamily: "monospace",
              color: "#b8b8c8",
            }}>
              <div><span style={{ color: "#9ca3af" }}>Job Status</span>: <span style={{ color: "#fbbf24" }}>QUEUED</span> <span style={{ color: "#71717a" }}>- only queued jobs can be cancelled</span></div>
              <div><span style={{ color: "#9ca3af" }}>Owner</span>: <span style={{ color: "#71717a" }}>Only the user who created the job can cancel it</span></div>
            </div>

            <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#e4e4e7", marginBottom: "12px" }}>
              Response
            </h4>
            <div style={{ 
              padding: "16px", 
              background: "rgba(9, 9, 11, 0.6)", 
              borderRadius: "8px",
              fontSize: "13px",
              fontFamily: "monospace",
              color: "#b8b8c8",
            }}>
              <div><span style={{ color: "#9ca3af" }}>job_id</span>: <span style={{ color: "#fbbf24" }}>string</span></div>
              <div><span style={{ color: "#9ca3af" }}>status</span>: <span style={{ color: "#34d399" }}>&quot;cancelled&quot;</span></div>
              <div><span style={{ color: "#9ca3af" }}>tokens_refunded</span>: <span style={{ color: "#fbbf24" }}>number</span> <span style={{ color: "#71717a" }}>- tokens returned to user</span></div>
              <div><span style={{ color: "#9ca3af" }}>user_balance</span>: <span style={{ color: "#fbbf24" }}>number</span> <span style={{ color: "#71717a" }}>- updated token balance</span></div>
              <div><span style={{ color: "#9ca3af" }}>cancelled_at</span>: <span style={{ color: "#fbbf24" }}>string</span> <span style={{ color: "#71717a" }}>- ISO timestamp</span></div>
            </div>

            <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#e4e4e7", marginTop: "16px", marginBottom: "12px" }}>
              Error Responses
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ 
                padding: "8px 12px", 
                background: "rgba(239, 68, 68, 0.1)", 
                borderRadius: "6px",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}>
                <span style={{ color: "#f87171", fontWeight: "600" }}>403</span>
                <span style={{ color: "#b8b8c8" }}>You can only cancel your own jobs</span>
              </div>
              <div style={{ 
                padding: "8px 12px", 
                background: "rgba(239, 68, 68, 0.1)", 
                borderRadius: "6px",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}>
                <span style={{ color: "#f87171", fontWeight: "600" }}>409</span>
                <span style={{ color: "#b8b8c8" }}>Job is already running / completed / failed / cancelled</span>
              </div>
            </div>
          </EndpointCard>

          <TabbedCodeBlock
            title="Cancel Job Example"
            defaultOpen={false}
            tabs={[
              { language: "curl", label: "cURL", code: cancelJobExamples.curl },
              { language: "swift", label: "Swift", code: cancelJobExamples.swift },
            ]}
          />
        </Section>

        {/* GET /users/:externalId */}
        <Section id="user-info" title="GET /users/:externalId">
          <EndpointCard 
            method="GET" 
            path="/api/v1/users/:externalId"
            description="Get user information including token balance."
          />

          <TabbedCodeBlock
            title="Get User Info Example"
            defaultOpen={false}
            tabs={[
              { language: "curl", label: "cURL", code: userInfoExamples.curl },
              { language: "swift", label: "Swift", code: userInfoExamples.swift },
            ]}
          />
        </Section>

        {/* POST /users/:externalId/tokens */}
        <Section id="grant-tokens" title="POST /users/:externalId/tokens">
          <EndpointCard 
            method="POST" 
            path="/api/v1/users/:externalId/tokens"
            description="Grant tokens to a user. Typically called from your backend after a purchase."
          >
            <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#e4e4e7", marginBottom: "12px" }}>
              Request Body
            </h4>
            <div style={{ 
              padding: "16px", 
              background: "rgba(9, 9, 11, 0.6)", 
              borderRadius: "8px",
              fontSize: "13px",
              fontFamily: "monospace",
              color: "#b8b8c8",
            }}>
              <div><span style={{ color: "#9ca3af" }}>amount</span>: <span style={{ color: "#fbbf24" }}>number</span> <span style={{ color: "#f87171" }}>required</span></div>
              <div><span style={{ color: "#9ca3af" }}>description</span>: <span style={{ color: "#fbbf24" }}>string</span> <span style={{ color: "#71717a" }}>optional</span></div>
            </div>
          </EndpointCard>

          <TabbedCodeBlock
            title="Grant Tokens Example"
            defaultOpen={false}
            tabs={[
              { language: "curl", label: "cURL", code: grantTokensExamples.curl },
              { language: "swift", label: "Swift", code: grantTokensExamples.swift },
            ]}
          />
        </Section>

        {/* Full Swift Client */}
        <Section id="full-client" title="Full Swift Client">
          <p style={{ color: "#b8b8c8", fontSize: "15px", lineHeight: "1.7", marginBottom: "20px" }}>
            Copy this complete client class into your iOS project for easy API integration.
          </p>

          <TabbedCodeBlock
            title="AIHubClient.swift"
            defaultOpen={false}
            tabs={[
              { language: "swift", label: "Swift Client", code: fullClientExample.swift },
            ]}
          />

          <TabbedCodeBlock
            title="Usage Example"
            defaultOpen={false}
            tabs={[
              { language: "swift", label: "Swift", code: usageExample.swift },
            ]}
          />
        </Section>

        {/* Error Handling */}
        <Section id="errors" title="Error Handling">
          <p style={{ color: "#b8b8c8", fontSize: "15px", lineHeight: "1.7", marginBottom: "20px" }}>
            The API returns standard HTTP status codes along with error details:
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { code: 400, message: "Bad Request", desc: "Invalid request body or parameters" },
              { code: 401, message: "Unauthorized", desc: "Missing or invalid API key" },
              { code: 402, message: "Payment Required", desc: "Insufficient token balance" },
              { code: 404, message: "Not Found", desc: "Resource not found" },
              { code: 429, message: "Too Many Requests", desc: "Rate limit exceeded" },
              { code: 500, message: "Internal Server Error", desc: "Server error, try again later" },
            ].map((err) => (
              <div 
                key={err.code}
                style={{ 
                  padding: "12px 16px", 
                  background: "rgba(39, 39, 42, 0.4)", 
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span style={{
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: "700",
                  background: err.code >= 500 ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)",
                  color: err.code >= 500 ? "#f87171" : "#fbbf24",
                  fontFamily: "monospace",
                }}>
                  {err.code}
                </span>
                <span style={{ fontSize: "14px", color: "#fafafa" }}>{err.message}</span>
                <span style={{ fontSize: "13px", color: "#9ca3af" }}>— {err.desc}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

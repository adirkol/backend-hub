import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { defapiAdapter } from "@/lib/providers/defapi";
import { replicateAdapter } from "@/lib/providers/replicate";
import { openaiAdapter } from "@/lib/providers/openai";
import { reserveTokens, refundTokens } from "@/lib/tokens";

/**
 * Healthcheck API for testing AI models and providers
 * 
 * Two types of tests:
 * 
 * MODEL TESTS (simulates iOS client):
 * - modelCreateTest: POST /api/v1/generate (through queue/worker)
 * - modelPollTest: GET /api/v1/jobs/:id (check job status)
 * 
 * PROVIDER TESTS (direct debugging):
 * - providerCreateTest: Direct call to provider (bypasses queue)
 * - providerPollTest: Direct poll to provider
 */

const HEALTHCHECK_APP_SLUG = "_healthcheck_app";
const HEALTHCHECK_USER_EXTERNAL_ID = "_healthcheck_user";
const DEFAULT_TEST_PROMPT = "A beautiful sunset over mountains, high quality, 4k";
const DEFAULT_LLM_TEST_PROMPT = "Say hello and briefly describe yourself in one sentence.";

// =============================================================================
// Schema Definitions
// =============================================================================

const ModelCreateTestSchema = z.object({
  action: z.literal("modelCreateTest"),
  modelName: z.string(), // Model name (e.g., "gpt-image-1.5")
  prompt: z.string().optional(),
});

const ModelPollTestSchema = z.object({
  action: z.literal("modelPollTest"),
  jobId: z.string(),
});

const ProviderCreateTestSchema = z.object({
  action: z.literal("providerCreateTest"),
  providerConfigId: z.string(),
  providerId: z.string(),
  providerName: z.string(),
  providerModelId: z.string(),
  modelId: z.string(),
  prompt: z.string().optional(),
});

const ProviderPollTestSchema = z.object({
  action: z.literal("providerPollTest"),
  providerName: z.string(),
  taskId: z.string(),
  jobId: z.string().optional(),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get or create the healthcheck app and user
 */
async function getOrCreateHealthcheckResources() {
  // Find or create healthcheck app
  let app = await prisma.app.findFirst({
    where: { slug: HEALTHCHECK_APP_SLUG },
  });

  if (!app) {
    app = await prisma.app.create({
      data: {
        name: "Healthcheck Tests",
        slug: HEALTHCHECK_APP_SLUG,
        description: "Internal app for healthcheck testing",
        isEnabled: true,
        defaultTokenGrant: 1000000,
      },
    });
    console.log("[Healthcheck] Created healthcheck app:", app.id);
  }

  // Find or create healthcheck user
  let appUser = await prisma.appUser.findFirst({
    where: {
      appId: app.id,
      externalId: HEALTHCHECK_USER_EXTERNAL_ID,
    },
  });

  if (!appUser) {
    appUser = await prisma.appUser.create({
      data: {
        appId: app.id,
        externalId: HEALTHCHECK_USER_EXTERNAL_ID,
        tokenBalance: 1000000,
        metadata: { type: "healthcheck" },
      },
    });
    console.log("[Healthcheck] Created healthcheck user:", appUser.id);
  }

  // Ensure user has enough tokens (refill if low)
  if (appUser.tokenBalance < 10000) {
    await prisma.appUser.update({
      where: { id: appUser.id },
      data: { tokenBalance: 1000000 },
    });
    appUser.tokenBalance = 1000000;
  }

  return { app, appUser };
}

/**
 * Get the appropriate provider adapter
 */
function getProviderAdapter(providerName: string) {
  switch (providerName) {
    case "defapi":
      return defapiAdapter;
    case "replicate":
      return replicateAdapter;
    case "openai":
      return openaiAdapter;
    default:
      return null;
  }
}

// =============================================================================
// MODEL TESTS - Simulates iOS Client (Uses Queue/Worker)
// =============================================================================

/**
 * Model Create Test - Calls POST /api/v1/generate
 * This goes through the queue and worker, just like a real iOS client
 */
async function handleModelCreateTest(
  data: z.infer<typeof ModelCreateTestSchema>,
  request: NextRequest
) {
  const { modelName, prompt } = data;

  // Get healthcheck resources
  const { app, appUser } = await getOrCreateHealthcheckResources();

  // Build the internal API URL
  const baseUrl = new URL(request.url).origin;
  const generateUrl = `${baseUrl}/api/v1/generate`;

  const startTime = Date.now();

  try {
    // Call the actual /api/v1/generate endpoint
    const response = await fetch(generateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": app.apiKey,
        "X-User-ID": HEALTHCHECK_USER_EXTERNAL_ID,
      },
      body: JSON.stringify({
        model: modelName,
        input: {
          prompt: prompt || DEFAULT_TEST_PROMPT,
          aspect_ratio: "1:1",
          num_outputs: 1,
        },
      }),
    });

    const latencyMs = Date.now() - startTime;
    const result = await response.json();

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: `Job created: ${result.job_id}`,
        endpoint: "POST /api/v1/generate",
        jobId: result.job_id,
        status: result.status,
        tokensCost: result.tokens_charged,
        userBalance: result.user_balance,
        latencyMs,
        response: result,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || "Failed to create job",
        endpoint: "POST /api/v1/generate",
        latencyMs,
        response: result,
      });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Network error",
      endpoint: "POST /api/v1/generate",
      latencyMs: Date.now() - startTime,
    });
  }
}

/**
 * Model Poll Test - Calls GET /api/v1/jobs/:id
 * This checks the job status, just like a real iOS client
 */
async function handleModelPollTest(
  data: z.infer<typeof ModelPollTestSchema>,
  request: NextRequest
) {
  const { jobId } = data;

  // Get healthcheck resources
  const { app } = await getOrCreateHealthcheckResources();

  // Build the internal API URL
  const baseUrl = new URL(request.url).origin;
  const jobUrl = `${baseUrl}/api/v1/jobs/${jobId}`;

  const startTime = Date.now();

  try {
    // Call the actual /api/v1/jobs/:id endpoint
    const response = await fetch(jobUrl, {
      method: "GET",
      headers: {
        "X-API-Key": app.apiKey,
      },
    });

    const latencyMs = Date.now() - startTime;
    const result = await response.json();

    if (response.ok) {
      const isComplete = result.status === "succeeded" || result.status === "failed";
      const isSuccess = result.status === "succeeded";

      return NextResponse.json({
        success: isSuccess,
        status: result.status,
        message: isComplete 
          ? (isSuccess ? "Generation completed!" : `Failed: ${result.error}`)
          : `Status: ${result.status}`,
        endpoint: `GET /api/v1/jobs/${jobId}`,
        jobId,
        outputs: result.outputs,
        providerUsed: result.provider_used,
        tokensCost: result.tokens_charged,
        tokensRefunded: result.tokens_refunded,
        latencyMs,
        response: result,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || "Failed to get job status",
        endpoint: `GET /api/v1/jobs/${jobId}`,
        latencyMs,
        response: result,
      });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Network error",
      endpoint: `GET /api/v1/jobs/${jobId}`,
      latencyMs: Date.now() - startTime,
    });
  }
}

// =============================================================================
// PROVIDER TESTS - Direct Debugging (Bypasses Queue)
// =============================================================================

/**
 * Provider Create Test - Direct call to provider (for debugging)
 */
async function handleProviderCreateTest(
  data: z.infer<typeof ProviderCreateTestSchema>,
  adminId: string
) {
  const { providerName, providerModelId, modelId, prompt } = data;

  // Get or create healthcheck resources
  const { app, appUser } = await getOrCreateHealthcheckResources();

  // Get the AI model for token cost
  const aiModel = await prisma.aIModel.findUnique({
    where: { id: modelId },
  });

  if (!aiModel) {
    return NextResponse.json({
      success: false,
      error: `Model not found: ${modelId}`,
    });
  }

  const tokenCost = aiModel.tokenCost;

  // Check provider adapter
  const adapter = getProviderAdapter(providerName);
  if (!adapter) {
    return NextResponse.json({
      success: false,
      error: `Unknown provider: ${providerName}`,
    });
  }

  if (!adapter.isConfigured()) {
    return NextResponse.json({
      success: false,
      error: `${providerName} is not configured (missing API key)`,
    });
  }

  // Create the generation job in the database
  const job = await prisma.generationJob.create({
    data: {
      appId: app.id,
      appUserId: appUser.id,
      aiModelId: modelId,
      inputPayload: {
        prompt: prompt || DEFAULT_TEST_PROMPT,
        source: "healthcheck_provider_test",
        admin_id: adminId,
      },
      tokenCost,
      priority: 1,
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  // Reserve tokens
  const tokenResult = await reserveTokens(
    appUser.id,
    tokenCost,
    job.id,
    `Healthcheck provider test: ${aiModel.displayName}`
  );

  if (!tokenResult.success) {
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorMessage: tokenResult.error,
        errorCode: "INSUFFICIENT_TOKENS",
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: false,
      error: `Token reservation failed: ${tokenResult.error}`,
    });
  }

  // Mark tokens as charged
  await prisma.generationJob.update({
    where: { id: job.id },
    data: { tokensCharged: true },
  });

  // Determine if this is an LLM model (OpenAI provider or GPT models)
  const isLLMModel = providerName === "openai" || 
    providerModelId.startsWith("gpt-") ||
    providerModelId.includes("gpt-");

  // Determine endpoint for display
  const providerEndpoint = providerName === "defapi"
    ? providerModelId.startsWith("openai/")
      ? "POST https://api.defapi.org/api/gpt-image/gen"
      : "POST https://api.defapi.org/api/image/gen"
    : providerName === "replicate"
      ? `POST https://api.replicate.com/v1/predictions`
      : providerName === "openai"
        ? `POST https://api.openai.com/v1/chat/completions`
        : `${providerName} API`;

  // Use appropriate test prompt based on model type
  const testPrompt = prompt || (isLLMModel ? DEFAULT_LLM_TEST_PROMPT : DEFAULT_TEST_PROMPT);

  // Submit to provider
  const startTime = Date.now();
  const result = await adapter.submitGeneration({
    providerModelId,
    prompt: testPrompt,
    imageUrls: [],
    aspectRatio: isLLMModel ? undefined : "1:1",
    numberOfOutputs: 1,
  });

  const latencyMs = Date.now() - startTime;

  if (!result.success) {
    // Refund tokens on failure
    await refundTokens(
      appUser.id,
      tokenCost,
      job.id,
      "Healthcheck provider test failed"
    );

    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorMessage: result.error,
        errorCode: "PROVIDER_ERROR",
        completedAt: new Date(),
        tokensRefunded: true,
      },
    });

    return NextResponse.json({
      success: false,
      error: result.error,
      endpoint: providerEndpoint,
      jobId: job.id,
      latencyMs,
    });
  }

  // If provider returned immediate result (Replicate)
  if (result.immediateResult) {
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCEEDED",
        outputs: result.immediateResult.outputs.map((url, index) => ({
          url,
          index,
        })),
        usedProvider: providerName,
        providerTaskId: result.immediateResult.predictionId,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Generation completed immediately",
      endpoint: providerEndpoint,
      jobId: job.id,
      taskId: result.immediateResult.predictionId,
      outputs: result.immediateResult.outputs,
      latencyMs,
      tokensCost: tokenCost,
    });
  }

  // For async providers (DefAPI)
  if (result.taskId) {
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        providerTaskId: result.taskId,
        usedProvider: providerName,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Task submitted, use Poll Result to check status",
      endpoint: providerEndpoint,
      jobId: job.id,
      taskId: result.taskId,
      latencyMs,
      tokensCost: tokenCost,
      needsPolling: true,
    });
  }

  return NextResponse.json({
    success: false,
    error: "Provider returned no taskId or immediate result",
    endpoint: providerEndpoint,
    jobId: job.id,
  });
}

/**
 * Provider Poll Test - Direct poll to provider (for debugging)
 */
async function handleProviderPollTest(data: z.infer<typeof ProviderPollTestSchema>) {
  const { providerName, taskId, jobId } = data;

  const adapter = getProviderAdapter(providerName);
  if (!adapter) {
    return NextResponse.json({
      success: false,
      error: `Unknown provider: ${providerName}`,
    });
  }

  if (!adapter.isConfigured()) {
    return NextResponse.json({
      success: false,
      error: `${providerName} is not configured`,
    });
  }

  // For Replicate, polling isn't supported
  if (providerName === "replicate") {
    return NextResponse.json({
      success: false,
      error: "Replicate uses synchronous SDK - results are returned immediately",
      endpoint: "N/A (Replicate is synchronous)",
    });
  }

  const pollEndpoint = providerName === "defapi"
    ? `GET https://api.defapi.org/api/task/query?task_id=${taskId}`
    : `${providerName} poll API`;

  const startTime = Date.now();
  const result = await adapter.pollResult(taskId);
  const latencyMs = Date.now() - startTime;

  // Update job status if jobId provided
  if (jobId) {
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId },
      include: { appUser: true },
    });

    if (job && job.status === "RUNNING") {
      if (result.status === "succeeded" && result.result) {
        await prisma.generationJob.update({
          where: { id: jobId },
          data: {
            status: "SUCCEEDED",
            outputs: result.result.outputs.map((url, index) => ({
              url,
              index,
            })),
            completedAt: new Date(),
          },
        });
      } else if (result.status === "failed") {
        await refundTokens(
          job.appUserId,
          job.tokenCost,
          job.id,
          "Healthcheck poll failed"
        );

        await prisma.generationJob.update({
          where: { id: jobId },
          data: {
            status: "FAILED",
            errorMessage: result.error,
            errorCode: "POLL_FAILED",
            completedAt: new Date(),
            tokensRefunded: true,
          },
        });
      }
    }
  }

  return NextResponse.json({
    success: result.status === "succeeded",
    status: result.status,
    message: result.status === "succeeded" 
      ? "Generation completed" 
      : result.status === "failed" 
        ? result.error 
        : `Status: ${result.status}`,
    endpoint: pollEndpoint,
    outputs: result.result?.outputs,
    latencyMs,
    jobId,
    costCharged: result.costCharged,
  });
}

// =============================================================================
// Main Handler
// =============================================================================

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    switch (body.action) {
      case "modelCreateTest": {
        const parsed = ModelCreateTestSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Invalid request", details: parsed.error.issues },
            { status: 400 }
          );
        }
        return handleModelCreateTest(parsed.data, request);
      }

      case "modelPollTest": {
        const parsed = ModelPollTestSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Invalid request", details: parsed.error.issues },
            { status: 400 }
          );
        }
        return handleModelPollTest(parsed.data, request);
      }

      case "providerCreateTest": {
        const parsed = ProviderCreateTestSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Invalid request", details: parsed.error.issues },
            { status: 400 }
          );
        }
        return handleProviderCreateTest(parsed.data, session.user.id ?? "unknown");
      }

      case "providerPollTest": {
        const parsed = ProviderPollTestSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Invalid request", details: parsed.error.issues },
            { status: 400 }
          );
        }
        return handleProviderPollTest(parsed.data);
      }

      default:
        return NextResponse.json(
          { 
            error: "Invalid action", 
            validActions: ["modelCreateTest", "modelPollTest", "providerCreateTest", "providerPollTest"] 
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Healthcheck] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

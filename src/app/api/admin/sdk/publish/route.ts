import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit";
import { execSync } from "child_process";

const PublishSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Invalid semver format"),
  releaseNotes: z.string().nullable().optional(),
});

// Get current HEAD commit SHA
function getCurrentCommitSha(): string | null {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

// Trigger GitHub Actions workflow
async function triggerGitHubWorkflow(version: string, releaseNotes: string | null): Promise<{ success: boolean; runId?: string; error?: string }> {
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return { success: false, error: "GITHUB_TOKEN not configured" };
  }

  // Repository info - adjust these for your setup
  const owner = "adirkol";
  const repo = "backend-hub"; // The source repo that has the workflow
  const workflowFile = "publish-sdk.yml";

  try {
    // Trigger workflow_dispatch
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${githubToken}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            version: version,
            release_notes: releaseNotes || "",
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub API error:", errorText);
      return { success: false, error: `GitHub API error: ${response.status}` };
    }

    // Workflow dispatch doesn't return the run ID immediately
    // We return success and the run ID will be updated later or via webhook
    return { success: true };
  } catch (error) {
    console.error("Failed to trigger workflow:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verify admin session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate body
    const body = await req.json();
    const validation = PublishSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { version, releaseNotes } = validation.data;

    // Check if version already exists
    const existingPublish = await prisma.sDKPublish.findUnique({
      where: { version },
    });

    if (existingPublish) {
      return NextResponse.json(
        { error: `Version ${version} has already been published` },
        { status: 409 }
      );
    }

    // Get current commit SHA
    const commitSha = getCurrentCommitSha();

    // Create publish record
    const publish = await prisma.sDKPublish.create({
      data: {
        version,
        releaseNotes: releaseNotes || null,
        publishedBy: session.user.email,
        status: "PENDING",
        commitSha,
        tagName: version,
      },
    });

    // Trigger GitHub workflow
    const workflowResult = await triggerGitHubWorkflow(version, releaseNotes || null);

    if (!workflowResult.success) {
      // Update publish record with error
      await prisma.sDKPublish.update({
        where: { id: publish.id },
        data: {
          status: "FAILED",
          errorMessage: workflowResult.error,
          completedAt: new Date(),
        },
      });

      return NextResponse.json(
        { error: `Failed to trigger workflow: ${workflowResult.error}` },
        { status: 500 }
      );
    }

    // Update status to in progress
    await prisma.sDKPublish.update({
      where: { id: publish.id },
      data: {
        status: "IN_PROGRESS",
        workflowRunId: workflowResult.runId || null,
      },
    });

    // Log audit event
    await logAuditEvent({
      action: "sdk.publish.initiated",
      entityType: "SDKPublish",
      entityId: publish.id,
      actorType: "admin",
      actorId: session.user.email,
      metadata: {
        version,
        releaseNotes: releaseNotes || null,
        commitSha,
      },
    });

    return NextResponse.json({
      success: true,
      publish: {
        id: publish.id,
        version: publish.version,
        status: "IN_PROGRESS",
      },
      message: `Publishing v${version}... Check the publish history for status updates.`,
    });
  } catch (error) {
    console.error("SDK publish error:", error);
    return NextResponse.json(
      { error: "Failed to initiate publish" },
      { status: 500 }
    );
  }
}

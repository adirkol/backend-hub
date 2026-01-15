import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const WebhookSchema = z.object({
  version: z.string(),
  status: z.enum(["SUCCESS", "FAILED"]),
  commitSha: z.string().optional(),
  error: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret
    const authHeader = req.headers.get("Authorization");
    const expectedSecret = process.env.SDK_WEBHOOK_SECRET;
    
    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate body
    const body = await req.json();
    const validation = WebhookSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { version, status, error } = validation.data;

    // Find and update the publish record
    const publish = await prisma.sDKPublish.findUnique({
      where: { version },
    });

    if (!publish) {
      return NextResponse.json(
        { error: `Publish record not found for version ${version}` },
        { status: 404 }
      );
    }

    // Update the publish record
    // Note: We don't update commitSha here - the source repo's SHA is already
    // stored when the publish was created. The workflow sends the distribution
    // repo's SHA which we don't need for change detection.
    await prisma.sDKPublish.update({
      where: { id: publish.id },
      data: {
        status,
        errorMessage: error || null,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      version,
      status,
    });
  } catch (error) {
    console.error("SDK webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

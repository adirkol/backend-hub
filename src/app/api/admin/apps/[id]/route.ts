import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import crypto from "crypto";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const UpdateAppSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isEnabled: z.boolean().optional(),
  defaultTokenGrant: z.number().int().min(0).optional(),
  webhookUrl: z.string().url().optional().or(z.literal("")),
  webhookSecret: z.string().optional().or(z.literal("")),
  rateLimitPerUser: z.number().int().min(1).optional(),
  rateLimitPerApp: z.number().int().min(1).optional(),
  revenueCatAppId: z.string().optional().or(z.literal("")),
});

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const app = await prisma.app.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, jobs: true },
        },
      },
    });

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    return NextResponse.json(app);
  } catch (error) {
    console.error("Get app error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();
    const validation = UpdateAppSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Check if app exists
    const existing = await prisma.app.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
    if (data.defaultTokenGrant !== undefined) updateData.defaultTokenGrant = data.defaultTokenGrant;
    if (data.rateLimitPerUser !== undefined) updateData.rateLimitPerUser = data.rateLimitPerUser;
    if (data.rateLimitPerApp !== undefined) updateData.rateLimitPerApp = data.rateLimitPerApp;

    // Handle webhook URL
    if (data.webhookUrl !== undefined) {
      updateData.webhookUrl = data.webhookUrl || null;
      // Generate new webhook secret if URL is set and no secret exists
      if (data.webhookUrl && !existing.webhookSecret && !data.webhookSecret) {
        updateData.webhookSecret = `whsec_${crypto.randomBytes(24).toString("base64url")}`;
      }
    }

    // Handle webhook secret
    if (data.webhookSecret !== undefined) {
      updateData.webhookSecret = data.webhookSecret || null;
    }

    // Handle RevenueCat App ID
    if (data.revenueCatAppId !== undefined) {
      updateData.revenueCatAppId = data.revenueCatAppId || null;
    }

    const app = await prisma.app.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(app);
  } catch (error) {
    console.error("Update app error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check if app exists
    const existing = await prisma.app.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    // Delete app (cascades to users, jobs, etc.)
    await prisma.app.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete app error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}



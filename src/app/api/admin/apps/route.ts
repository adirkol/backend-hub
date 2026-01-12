import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import crypto from "crypto";
import { auditAdminAction } from "@/lib/audit";

const CreateAppSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  defaultTokenGrant: z.number().int().min(0).default(0),
  webhookUrl: z.string().url().optional().or(z.literal("")),
  rateLimitPerUser: z.number().int().min(1).default(30),
  rateLimitPerApp: z.number().int().min(1).default(1000),
  // App Store info (optional)
  appStoreUrl: z.string().url().optional().or(z.literal("")),
  iconUrl: z.string().url().optional().or(z.literal("")),
  bundleId: z.string().max(255).optional().or(z.literal("")),
});

function generateApiKey(slug: string): { apiKey: string; prefix: string } {
  const prefix = `${slug.slice(0, 3)}_live_`;
  const random = crypto.randomBytes(24).toString("base64url");
  return {
    apiKey: `${prefix}${random}`,
    prefix: prefix,
  };
}

export async function GET() {
  try {
    const apps = await prisma.app.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { users: true, jobs: true },
        },
      },
    });

    return NextResponse.json(apps);
  } catch (error) {
    console.error("List apps error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = CreateAppSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Check if slug already exists
    const existing = await prisma.app.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An app with this slug already exists" },
        { status: 409 }
      );
    }

    // Generate API key
    const { apiKey, prefix } = generateApiKey(data.slug);

    // Generate webhook secret
    const webhookSecret = data.webhookUrl
      ? `whsec_${crypto.randomBytes(24).toString("base64url")}`
      : null;

    const app = await prisma.app.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        apiKey,
        apiKeyPrefix: prefix,
        defaultTokenGrant: data.defaultTokenGrant,
        webhookUrl: data.webhookUrl || null,
        webhookSecret,
        rateLimitPerUser: data.rateLimitPerUser,
        rateLimitPerApp: data.rateLimitPerApp,
        appStoreUrl: data.appStoreUrl || null,
        iconUrl: data.iconUrl || null,
        bundleId: data.bundleId || null,
      },
    });

    // Audit log
    await auditAdminAction(req, "app.created", "App", app.id, {
      name: app.name,
      slug: app.slug,
      defaultTokenGrant: app.defaultTokenGrant,
    });

    return NextResponse.json(app, { status: 201 });
  } catch (error) {
    console.error("Create app error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}



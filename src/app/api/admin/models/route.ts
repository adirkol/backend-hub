import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { auditAdminAction } from "@/lib/audit";

const CreateModelSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9-]+$/, "Name must be lowercase with hyphens only"),
  displayName: z.string().min(1),
  description: z.string().nullable().optional(),
  modelFamily: z.string().nullable().optional(),
  tokenCost: z.number().int().min(0).default(5),
  maxInputImages: z.number().int().min(0).default(4),
  supportsImages: z.boolean().default(true),
  supportsPrompt: z.boolean().default(true),
  supportedAspectRatios: z.array(z.string()).default(["1:1", "16:9", "9:16", "4:3", "3:4"]),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const models = await prisma.aIModel.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      providerConfigs: {
        include: { provider: true },
        orderBy: { priority: "asc" },
      },
      _count: { select: { jobs: true } },
    },
  });

  return NextResponse.json(models);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = CreateModelSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const {
    name,
    displayName,
    description,
    modelFamily,
    tokenCost,
    maxInputImages,
    supportsImages,
    supportsPrompt,
    supportedAspectRatios,
  } = parsed.data;

  // Check if model with same name already exists
  const existingModel = await prisma.aIModel.findUnique({
    where: { name },
  });

  if (existingModel) {
    return NextResponse.json(
      { error: `Model with name "${name}" already exists` },
      { status: 400 }
    );
  }

  // Create the model
  const model = await prisma.aIModel.create({
    data: {
      name,
      displayName,
      description,
      modelFamily,
      tokenCost,
      maxInputImages,
      supportsImages,
      supportsPrompt,
      supportedAspectRatios,
      isEnabled: true,
    },
  });

  // Audit log
  await auditAdminAction(request, "model.created", "AIModel", model.id, {
    name,
    displayName,
    tokenCost,
  });

  return NextResponse.json(model, { status: 201 });
}

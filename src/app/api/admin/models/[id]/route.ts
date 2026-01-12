import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { auditAdminAction } from "@/lib/audit";

const UpdateModelSchema = z.object({
  displayName: z.string().min(1).optional(),
  description: z.string().optional(),
  tokenCost: z.number().int().min(0).optional(),
  isEnabled: z.boolean().optional(),
  providerConfigs: z.array(z.object({
    id: z.string().optional(),
    providerId: z.string(),
    providerModelId: z.string(),
    priority: z.number().int(),
    isEnabled: z.boolean(),
  })).optional(),
  appTokenOverrides: z.record(z.string(), z.number().int().min(1)).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const model = await prisma.aIModel.findUnique({
    where: { id },
    include: {
      providerConfigs: {
        include: { provider: true },
        orderBy: { priority: "asc" },
      },
      appTokenConfigs: {
        include: { app: { select: { id: true, name: true, slug: true } } },
      },
    },
  });

  if (!model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  return NextResponse.json(model);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const body = await request.json();
  const parsed = UpdateModelSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { displayName, description, tokenCost, isEnabled, providerConfigs, appTokenOverrides } = parsed.data;

  // Check model exists
  const existingModel = await prisma.aIModel.findUnique({
    where: { id },
    include: { providerConfigs: true, appTokenConfigs: true },
  });

  if (!existingModel) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  // Use a transaction to update everything atomically
  const updatedModel = await prisma.$transaction(async (tx) => {
    // Update basic model info
    const model = await tx.aIModel.update({
      where: { id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(description !== undefined && { description }),
        ...(tokenCost !== undefined && { tokenCost }),
        ...(isEnabled !== undefined && { isEnabled }),
      },
    });

    // Update provider configs if provided
    if (providerConfigs) {
      // Get existing config IDs
      const existingConfigIds = existingModel.providerConfigs.map((c) => c.id);
      
      // Separate configs into new and existing
      const existingConfigs = providerConfigs.filter((c) => c.id && existingConfigIds.includes(c.id));
      const newConfigs = providerConfigs.filter((c) => !c.id || !existingConfigIds.includes(c.id));
      
      // IDs to keep
      const keepIds = existingConfigs.map((c) => c.id!);
      
      // Delete configs that are no longer present
      await tx.modelProviderConfig.deleteMany({
        where: {
          modelId: id,
          id: { notIn: keepIds },
        },
      });

      // Update existing configs
      for (const config of existingConfigs) {
        await tx.modelProviderConfig.update({
          where: { id: config.id },
          data: {
            providerModelId: config.providerModelId,
            priority: config.priority,
            isEnabled: config.isEnabled,
          },
        });
      }

      // Create new configs
      for (const config of newConfigs) {
        await tx.modelProviderConfig.create({
          data: {
            modelId: id,
            providerId: config.providerId,
            providerModelId: config.providerModelId,
            priority: config.priority,
            isEnabled: config.isEnabled,
          },
        });
      }
    }

    // Update per-app token overrides if provided
    if (appTokenOverrides) {
      // Get current app IDs with overrides
      const currentAppIds = existingModel.appTokenConfigs.map((c) => c.appId);
      const newAppIds = Object.keys(appTokenOverrides);
      
      // Delete overrides for apps no longer in the list
      await tx.appModelTokenConfig.deleteMany({
        where: {
          modelId: id,
          appId: { notIn: newAppIds },
        },
      });

      // Upsert each override
      for (const [appId, cost] of Object.entries(appTokenOverrides)) {
        await tx.appModelTokenConfig.upsert({
          where: {
            appId_modelId: { appId, modelId: id },
          },
          update: { tokenCost: cost },
          create: {
            appId,
            modelId: id,
            tokenCost: cost,
          },
        });
      }
    }

    return model;
  });

  // Audit log
  const changes: Record<string, unknown> = {};
  if (displayName !== undefined && displayName !== existingModel.displayName) {
    changes.displayName = { from: existingModel.displayName, to: displayName };
  }
  if (description !== undefined && description !== existingModel.description) {
    changes.description = { from: existingModel.description, to: description };
  }
  if (tokenCost !== undefined && tokenCost !== existingModel.tokenCost) {
    changes.tokenCost = { from: existingModel.tokenCost, to: tokenCost };
  }
  if (isEnabled !== undefined && isEnabled !== existingModel.isEnabled) {
    changes.isEnabled = { from: existingModel.isEnabled, to: isEnabled };
  }
  if (providerConfigs) {
    changes.providerConfigsUpdated = true;
  }
  if (appTokenOverrides) {
    changes.appTokenOverridesUpdated = true;
  }

  await auditAdminAction(request, "model.updated", "AIModel", id, {
    modelName: existingModel.name,
    changes,
  });

  return NextResponse.json(updatedModel);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Check if model exists
  const model = await prisma.aIModel.findUnique({ where: { id } });
  if (!model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  // Check if model has any jobs
  const jobCount = await prisma.generationJob.count({ where: { aiModelId: id } });
  if (jobCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete model with ${jobCount} associated jobs` },
      { status: 400 }
    );
  }

  // Audit log before deletion
  await auditAdminAction(request, "model.deleted", "AIModel", id, {
    modelName: model.name,
    displayName: model.displayName,
  });

  await prisma.aIModel.delete({ where: { id } });

  return NextResponse.json({ success: true });
}





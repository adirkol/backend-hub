import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { auditAdminAction } from "@/lib/audit";

const UpdateConfigSchema = z.object({
  costPerRequest: z.number().min(0).optional(),
  inputTokenCostPer1M: z.number().min(0).nullable().optional(),
  outputTokenCostPer1M: z.number().min(0).nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; configId: string }> }
) {
  const { id: providerId, configId } = await params;

  try {
    const body = await request.json();
    const parsed = UpdateConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Verify the config exists and belongs to this provider
    const existingConfig = await prisma.modelProviderConfig.findFirst({
      where: {
        id: configId,
        providerId: providerId,
      },
    });

    if (!existingConfig) {
      return NextResponse.json(
        { error: "Configuration not found" },
        { status: 404 }
      );
    }

    // Build update data object
    const updateData: Record<string, unknown> = {};
    if (parsed.data.costPerRequest !== undefined) {
      updateData.costPerRequest = parsed.data.costPerRequest;
    }
    if (parsed.data.inputTokenCostPer1M !== undefined) {
      updateData.inputTokenCostPer1M = parsed.data.inputTokenCostPer1M;
    }
    if (parsed.data.outputTokenCostPer1M !== undefined) {
      updateData.outputTokenCostPer1M = parsed.data.outputTokenCostPer1M;
    }

    const updated = await prisma.modelProviderConfig.update({
      where: { id: configId },
      data: updateData,
      include: {
        model: { select: { name: true } },
        provider: { select: { name: true } },
      },
    });

    // Audit log
    await auditAdminAction(request, "provider.config_updated", "ModelProviderConfig", configId, {
      providerId,
      providerName: updated.provider.name,
      modelName: updated.model.name,
      costPerRequest: parsed.data.costPerRequest !== undefined ? {
        from: Number(existingConfig.costPerRequest),
        to: parsed.data.costPerRequest,
      } : undefined,
      inputTokenCostPer1M: parsed.data.inputTokenCostPer1M !== undefined ? {
        from: existingConfig.inputTokenCostPer1M ? Number(existingConfig.inputTokenCostPer1M) : null,
        to: parsed.data.inputTokenCostPer1M,
      } : undefined,
      outputTokenCostPer1M: parsed.data.outputTokenCostPer1M !== undefined ? {
        from: existingConfig.outputTokenCostPer1M ? Number(existingConfig.outputTokenCostPer1M) : null,
        to: parsed.data.outputTokenCostPer1M,
      } : undefined,
    });

    return NextResponse.json({
      success: true,
      config: {
        ...updated,
        costPerRequest: Number(updated.costPerRequest),
        inputTokenCostPer1M: updated.inputTokenCostPer1M ? Number(updated.inputTokenCostPer1M) : null,
        outputTokenCostPer1M: updated.outputTokenCostPer1M ? Number(updated.outputTokenCostPer1M) : null,
      },
    });
  } catch (error) {
    console.error("Error updating config:", error);
    return NextResponse.json(
      { error: "Failed to update configuration" },
      { status: 500 }
    );
  }
}





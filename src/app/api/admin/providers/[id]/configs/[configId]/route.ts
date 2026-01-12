import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { auditAdminAction } from "@/lib/audit";

const UpdateConfigSchema = z.object({
  costPerRequest: z.number().min(0),
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

    const updated = await prisma.modelProviderConfig.update({
      where: { id: configId },
      data: {
        costPerRequest: parsed.data.costPerRequest,
      },
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
      costPerRequest: {
        from: Number(existingConfig.costPerRequest),
        to: parsed.data.costPerRequest,
      },
    });

    return NextResponse.json({
      success: true,
      config: {
        ...updated,
        costPerRequest: Number(updated.costPerRequest),
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





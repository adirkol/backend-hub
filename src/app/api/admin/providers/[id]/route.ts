import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const provider = await prisma.aIProvider.findUnique({
      where: { id },
    });

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const modelConfigs = await prisma.modelProviderConfig.findMany({
      where: { providerId: id },
      include: {
        model: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
      orderBy: [
        { model: { displayName: "asc" } },
        { priority: "asc" },
      ],
    });

    // Convert Decimal to number for JSON serialization
    const serializedConfigs = modelConfigs.map(config => ({
      ...config,
      costPerRequest: Number(config.costPerRequest),
    }));

    return NextResponse.json({
      provider,
      modelConfigs: serializedConfigs,
    });
  } catch (error) {
    console.error("Error fetching provider:", error);
    return NextResponse.json(
      { error: "Failed to fetch provider" },
      { status: 500 }
    );
  }
}



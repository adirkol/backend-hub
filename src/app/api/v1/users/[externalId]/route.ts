import { NextRequest, NextResponse } from "next/server";
import { validateApiRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getEffectiveTokenBalance } from "@/lib/tokens";

interface RouteParams {
  params: Promise<{ externalId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate request
    const auth = await validateApiRequest(req);
    if (!auth.success || !auth.app) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { externalId } = await params;

    // Find user for this app
    const appUser = await prisma.appUser.findUnique({
      where: {
        appId_externalId: {
          appId: auth.app.id,
          externalId,
        },
      },
    });

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get job stats and effective balance
    const [totalJobs, successfulJobs, balanceInfo] = await Promise.all([
      prisma.generationJob.count({
        where: { appUserId: appUser.id },
      }),
      prisma.generationJob.count({
        where: {
          appUserId: appUser.id,
          status: "SUCCEEDED",
        },
      }),
      getEffectiveTokenBalance(appUser.id),
    ]);

    return NextResponse.json({
      external_id: appUser.externalId,
      token_balance: balanceInfo.effectiveBalance,
      total_jobs: totalJobs,
      successful_jobs: successfulJobs,
      is_active: appUser.isActive,
      metadata: appUser.metadata,
      created_at: appUser.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate request
    const auth = await validateApiRequest(req);
    if (!auth.success || !auth.app) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { externalId } = await params;
    const body = await req.json();

    // Find user for this app
    const appUser = await prisma.appUser.findUnique({
      where: {
        appId_externalId: {
          appId: auth.app.id,
          externalId,
        },
      },
    });

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update allowed fields
    const updateData: Prisma.AppUserUpdateInput = {};

    if (body.metadata !== undefined) {
      updateData.metadata = body.metadata as Prisma.InputJsonValue;
    }
    if (typeof body.is_active === "boolean") {
      updateData.isActive = body.is_active;
    }

    const updatedUser = await prisma.appUser.update({
      where: { id: appUser.id },
      data: updateData,
    });

    // Get effective balance
    const { effectiveBalance } = await getEffectiveTokenBalance(updatedUser.id);

    return NextResponse.json({
      external_id: updatedUser.externalId,
      token_balance: effectiveBalance,
      is_active: updatedUser.isActive,
      metadata: updatedUser.metadata,
      updated_at: updatedUser.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}





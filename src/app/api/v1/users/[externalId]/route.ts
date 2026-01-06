import { NextRequest, NextResponse } from "next/server";
import { validateApiRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

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

    // Get job stats
    const [totalJobs, successfulJobs] = await Promise.all([
      prisma.generationJob.count({
        where: { appUserId: appUser.id },
      }),
      prisma.generationJob.count({
        where: {
          appUserId: appUser.id,
          status: "SUCCEEDED",
        },
      }),
    ]);

    return NextResponse.json({
      external_id: appUser.externalId,
      token_balance: appUser.tokenBalance,
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
    const updateData: { metadata?: unknown; isActive?: boolean } = {};

    if (body.metadata !== undefined) {
      updateData.metadata = body.metadata;
    }
    if (typeof body.is_active === "boolean") {
      updateData.isActive = body.is_active;
    }

    const updatedUser = await prisma.appUser.update({
      where: { id: appUser.id },
      data: updateData,
    });

    return NextResponse.json({
      external_id: updatedUser.externalId,
      token_balance: updatedUser.tokenBalance,
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



import { NextRequest, NextResponse } from "next/server";
import { validateApiRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { Prisma, TokenEntryType } from "@prisma/client";
import { getEffectiveTokenBalance, calculateExpirationDate } from "@/lib/tokens";

interface RouteParams {
  params: Promise<{ externalId: string }>;
}

/**
 * Check if user is eligible for daily token grant (rolling 24h)
 */
function isDailyGrantEligible(lastDailyGrantAt: Date | null): boolean {
  if (!lastDailyGrantAt) {
    return true; // Never received daily grant, eligible
  }
  
  const now = new Date();
  const hoursSinceLastGrant = (now.getTime() - lastDailyGrantAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceLastGrant >= 24;
}

/**
 * Calculate next available time for daily grant
 */
function getNextDailyGrantTime(lastDailyGrantAt: Date | null): Date | null {
  if (!lastDailyGrantAt) {
    return new Date(); // Available now
  }
  
  const nextAvailable = new Date(lastDailyGrantAt);
  nextAvailable.setTime(nextAvailable.getTime() + 24 * 60 * 60 * 1000); // +24 hours
  return nextAvailable;
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
    let appUser = await prisma.appUser.findUnique({
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

    // Daily token grant logic
    const dailyGrantEnabled = auth.app.dailyTokenGrant > 0;
    let dailyGrantedNow = false;
    let dailyGrantAmount = 0;
    
    if (dailyGrantEnabled && isDailyGrantEligible(appUser.lastDailyGrantAt)) {
      // User is eligible for daily grant - grant tokens
      dailyGrantAmount = auth.app.dailyTokenGrant;
      const now = new Date();
      const expiresAt = calculateExpirationDate(auth.app.tokenExpirationDays);
      
      // Use transaction for atomic update
      await prisma.$transaction(async (tx) => {
        // Update user's token balance and lastDailyGrantAt
        appUser = await tx.appUser.update({
          where: { id: appUser!.id },
          data: {
            tokenBalance: { increment: dailyGrantAmount },
            lastDailyGrantAt: now,
          },
        });
        
        // Create ledger entry for audit
        await tx.tokenLedgerEntry.create({
          data: {
            appUserId: appUser.id,
            amount: dailyGrantAmount,
            balanceAfter: appUser.tokenBalance,
            type: TokenEntryType.GRANT,
            description: "Daily token grant",
            idempotencyKey: `daily_${appUser.id}_${now.toISOString().split("T")[0]}`,
            expiresAt,
          },
        });
      });
      
      dailyGrantedNow = true;
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

    // Build response
    const response: Record<string, unknown> = {
      external_id: appUser.externalId,
      token_balance: balanceInfo.effectiveBalance,
      total_jobs: totalJobs,
      successful_jobs: successfulJobs,
      is_active: appUser.isActive,
      metadata: appUser.metadata,
      created_at: appUser.createdAt.toISOString(),
    };
    
    // Include daily_grant info if the feature is enabled
    if (dailyGrantEnabled) {
      response.daily_grant = {
        enabled: true,
        amount: auth.app.dailyTokenGrant,
        granted_now: dailyGrantedNow,
        tokens_granted: dailyGrantedNow ? dailyGrantAmount : 0,
        next_available_at: dailyGrantedNow 
          ? getNextDailyGrantTime(appUser.lastDailyGrantAt)?.toISOString()
          : (isDailyGrantEligible(appUser.lastDailyGrantAt) 
              ? new Date().toISOString() 
              : getNextDailyGrantTime(appUser.lastDailyGrantAt)?.toISOString()),
      };
    }

    return NextResponse.json(response);
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





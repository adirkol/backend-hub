import { NextRequest, NextResponse } from "next/server";
import { validateApiRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { TokenEntryType } from "@prisma/client";
import { calculateExpirationDate } from "@/lib/tokens";

const CreateUserSchema = z.object({
  external_id: z.string().min(1).max(255),
  metadata: z.record(z.string(), z.unknown()).optional(),
  // Optional: Initial tokens from the client-side system
  // Used when syncing tokens for users created via RevenueCat webhook
  initial_tokens: z.number().int().min(0).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Authenticate request (app only, no user required for registration)
    const auth = await validateApiRequest(req, { requireUser: false });
    if (!auth.success || !auth.app) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { 
          error: "Invalid request body", 
          details: parsed.error.issues.map(i => i.message) 
        },
        { status: 400 }
      );
    }

    const { external_id, metadata, initial_tokens } = parsed.data;

    // Check if user already exists
    const existingUser = await prisma.appUser.findUnique({
      where: {
        appId_externalId: {
          appId: auth.app.id,
          externalId: external_id,
        },
      },
    });

    if (existingUser) {
      // User exists - check if they need token sync
      if (existingUser.needsTokenSync && initial_tokens !== undefined) {
        // This user was created via RevenueCat webhook and needs token sync
        // Combine their AI Hub balance with client-side tokens
        const syncedBalance = existingUser.tokenBalance + initial_tokens;
        
        const updatedUser = await prisma.$transaction(async (tx) => {
          // Update user with synced balance and clear the flag
          const user = await tx.appUser.update({
            where: { id: existingUser.id },
            data: {
              tokenBalance: syncedBalance,
              needsTokenSync: false,
              metadata: metadata || existingUser.metadata,
            },
          });

          // Log the token sync
          if (initial_tokens > 0) {
            const expiresAt = calculateExpirationDate(auth.app.tokenExpirationDays);
            await tx.tokenLedgerEntry.create({
              data: {
                appUserId: existingUser.id,
                amount: initial_tokens,
                balanceAfter: syncedBalance,
                type: TokenEntryType.GRANT,
                description: "Token sync from client-side system",
                idempotencyKey: `sync_${existingUser.id}_${Date.now()}`,
                expiresAt,
              },
            });
          }

          return user;
        });

        return NextResponse.json({
          success: true,
          created: false,
          synced: true,
          user: {
            external_id: updatedUser.externalId,
            token_balance: updatedUser.tokenBalance,
            is_active: updatedUser.isActive,
            metadata: updatedUser.metadata,
            created_at: updatedUser.createdAt.toISOString(),
          },
        });
      }

      // Return existing user (idempotent - no error)
      return NextResponse.json({
        success: true,
        created: false,
        synced: false,
        user: {
          external_id: existingUser.externalId,
          token_balance: existingUser.tokenBalance,
          is_active: existingUser.isActive,
          metadata: existingUser.metadata,
          created_at: existingUser.createdAt.toISOString(),
        },
      });
    }

    // Create new user with default token grant from app settings
    // Plus any initial_tokens passed in (for migrating users)
    const welcomeTokens = auth.app.defaultTokenGrant;
    const additionalTokens = initial_tokens ?? 0;
    const totalTokens = welcomeTokens + additionalTokens;

    const newUser = await prisma.appUser.create({
      data: {
        appId: auth.app.id,
        externalId: external_id,
        tokenBalance: totalTokens,
        metadata: metadata || null,
        needsTokenSync: false,
      },
    });

    // Create ledger entries for both welcome tokens and initial tokens
    const expiresAt = calculateExpirationDate(auth.app.tokenExpirationDays);
    
    if (welcomeTokens > 0) {
      await prisma.tokenLedgerEntry.create({
        data: {
          appUserId: newUser.id,
          amount: welcomeTokens,
          balanceAfter: welcomeTokens,
          type: TokenEntryType.GRANT,
          description: "Welcome bonus - new user registration",
          idempotencyKey: `welcome_${newUser.id}`,
          expiresAt,
        },
      });
    }

    if (additionalTokens > 0) {
      await prisma.tokenLedgerEntry.create({
        data: {
          appUserId: newUser.id,
          amount: additionalTokens,
          balanceAfter: totalTokens,
          type: TokenEntryType.GRANT,
          description: "Initial tokens from client-side system",
          idempotencyKey: `initial_${newUser.id}`,
          expiresAt,
        },
      });
    }

    return NextResponse.json({
      success: true,
      created: true,
      synced: false,
      user: {
        external_id: newUser.externalId,
        token_balance: newUser.tokenBalance,
        is_active: newUser.isActive,
        metadata: newUser.metadata,
        created_at: newUser.createdAt.toISOString(),
      },
    }, { status: 201 });

  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}



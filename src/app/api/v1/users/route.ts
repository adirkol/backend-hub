import { NextRequest, NextResponse } from "next/server";
import { validateApiRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const CreateUserSchema = z.object({
  external_id: z.string().min(1).max(255),
  metadata: z.record(z.unknown()).optional(),
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

    const { external_id, metadata } = parsed.data;

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
      // Return existing user (idempotent - no error)
      return NextResponse.json({
        success: true,
        created: false,
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
    const newUser = await prisma.appUser.create({
      data: {
        appId: auth.app.id,
        externalId: external_id,
        tokenBalance: auth.app.defaultTokenGrant,
        metadata: metadata || null,
      },
    });

    // If there's a default token grant, create a ledger entry
    if (auth.app.defaultTokenGrant > 0) {
      await prisma.tokenLedgerEntry.create({
        data: {
          appUserId: newUser.id,
          amount: auth.app.defaultTokenGrant,
          balanceAfter: auth.app.defaultTokenGrant,
          type: "GRANT",
          description: "Welcome bonus - new user registration",
          idempotencyKey: `welcome_${newUser.id}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      created: true,
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



import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/apps/[id]/products/sync
 * 
 * Scans historical RevenueCat VIRTUAL_CURRENCY_TRANSACTION events
 * and auto-populates missing product → token mappings.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify app exists
    const app = await prisma.app.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    // Get all existing product configs for this app
    const existingConfigs = await prisma.productTokenConfig.findMany({
      where: { appId: id },
      select: { productId: true },
    });
    const existingProductIds = new Set(existingConfigs.map(c => c.productId));

    // Find all unique VIRTUAL_CURRENCY_TRANSACTION events with token amounts
    // Group by productId and get the most recent token amount for each
    const tokenEvents = await prisma.revenueCatEvent.findMany({
      where: {
        appId: id,
        eventType: "VIRTUAL_CURRENCY_TRANSACTION",
        productId: { not: null },
        tokenAmount: { not: null, gt: 0 },
      },
      select: {
        productId: true,
        tokenAmount: true,
        eventTimestampMs: true,
      },
      orderBy: {
        eventTimestampMs: "desc",
      },
    });

    // Build a map of productId → most recent tokenAmount
    const productTokenMap = new Map<string, number>();
    for (const event of tokenEvents) {
      if (event.productId && event.tokenAmount !== null) {
        // Only set if not already set (since we're sorted desc, first is most recent)
        if (!productTokenMap.has(event.productId)) {
          productTokenMap.set(event.productId, event.tokenAmount);
        }
      }
    }

    // Create missing product configs
    const newProducts: { productId: string; tokenAmount: number }[] = [];
    const updatedProducts: { productId: string; tokenAmount: number }[] = [];

    for (const [productId, tokenAmount] of productTokenMap) {
      if (!existingProductIds.has(productId)) {
        newProducts.push({ productId, tokenAmount });
      }
    }

    // Batch upsert all new products
    if (newProducts.length > 0) {
      await prisma.$transaction(
        newProducts.map(p =>
          prisma.productTokenConfig.upsert({
            where: {
              appId_productId: {
                appId: id,
                productId: p.productId,
              },
            },
            update: {
              tokenAmount: p.tokenAmount,
              lastUpdatedBy: "sync",
            },
            create: {
              appId: id,
              productId: p.productId,
              tokenAmount: p.tokenAmount,
              lastUpdatedBy: "sync",
            },
          })
        )
      );
    }

    // Also check for products in purchase events that might not have token transactions
    // (e.g., subscriptions that grant tokens but the token event wasn't captured)
    const purchaseProducts = await prisma.revenueCatEvent.findMany({
      where: {
        appId: id,
        eventType: { in: ["INITIAL_PURCHASE", "RENEWAL", "NON_RENEWING_PURCHASE"] },
        productId: { not: null },
      },
      select: {
        productId: true,
      },
      distinct: ["productId"],
    });

    // Find products that appear in purchases but not in our mapping
    const unmappedPurchaseProducts: string[] = [];
    for (const event of purchaseProducts) {
      if (event.productId && !existingProductIds.has(event.productId) && !productTokenMap.has(event.productId)) {
        unmappedPurchaseProducts.push(event.productId);
      }
    }

    return NextResponse.json({
      success: true,
      synced: newProducts.length,
      newProducts: newProducts.map(p => ({ productId: p.productId, tokenAmount: p.tokenAmount })),
      unmappedPurchaseProducts, // Products found in purchases but without token amounts
      totalInHistory: productTokenMap.size,
      message: newProducts.length > 0 
        ? `Synced ${newProducts.length} product(s) from history`
        : "All products already synced",
    });
  } catch (error) {
    console.error("Product sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync products" },
      { status: 500 }
    );
  }
}

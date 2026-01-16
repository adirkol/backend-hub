import { NextRequest, NextResponse } from "next/server";
import { validateApiRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/v1/products
 * 
 * Returns the product → token mapping for the authenticated app.
 * iOS apps can use this to know how many tokens each product grants
 * for optimistic UI updates after purchase.
 * 
 * Response:
 * {
 *   "products": {
 *     "AIMusic.Weekly.10USD": 50,
 *     "AIMusicGenerator.Tokens.100": 100,
 *     ...
 *   }
 * }
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate request (app only, no user required)
    const auth = await validateApiRequest(req, { requireUser: false });
    if (!auth.success || !auth.app) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    // Fetch all active product configs for this app
    const productConfigs = await prisma.productTokenConfig.findMany({
      where: {
        appId: auth.app.id,
        isActive: true,
      },
      select: {
        productId: true,
        tokenAmount: true,
      },
    });

    // Convert to simple key-value map
    const products: Record<string, number> = {};
    for (const config of productConfigs) {
      products[config.productId] = config.tokenAmount;
    }

    return NextResponse.json({
      products,
      count: productConfigs.length,
    });
  } catch (error) {
    console.error("Products fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

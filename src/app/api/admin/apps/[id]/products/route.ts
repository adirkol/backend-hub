import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/apps/[id]/products - List all product configs
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const products = await prisma.productTokenConfig.findMany({
      where: { appId: id },
      orderBy: { productId: "asc" },
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error("Products fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

// Schema for creating/updating product config
const ProductConfigSchema = z.object({
  productId: z.string().min(1),
  tokenAmount: z.number().int().min(0),
  displayName: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

// POST /api/admin/apps/[id]/products - Create or update product config
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const validation = ProductConfigSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { productId, tokenAmount, displayName, isActive } = validation.data;

    // Upsert the product config
    const product = await prisma.productTokenConfig.upsert({
      where: {
        appId_productId: {
          appId: id,
          productId,
        },
      },
      update: {
        tokenAmount,
        displayName,
        isActive,
        lastUpdatedBy: "admin",
      },
      create: {
        appId: id,
        productId,
        tokenAmount,
        displayName,
        isActive,
        lastUpdatedBy: "admin",
      },
    });

    return NextResponse.json({ product });
  } catch (error) {
    console.error("Product save error:", error);
    return NextResponse.json(
      { error: "Failed to save product" },
      { status: 500 }
    );
  }
}

// Bulk update schema
const BulkUpdateSchema = z.object({
  products: z.array(ProductConfigSchema),
});

// PUT /api/admin/apps/[id]/products - Bulk update products
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const validation = BulkUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { products } = validation.data;

    // Use transaction for bulk upsert
    const results = await prisma.$transaction(
      products.map((p) =>
        prisma.productTokenConfig.upsert({
          where: {
            appId_productId: {
              appId: id,
              productId: p.productId,
            },
          },
          update: {
            tokenAmount: p.tokenAmount,
            displayName: p.displayName,
            isActive: p.isActive ?? true,
            lastUpdatedBy: "admin",
          },
          create: {
            appId: id,
            productId: p.productId,
            tokenAmount: p.tokenAmount,
            displayName: p.displayName,
            isActive: p.isActive ?? true,
            lastUpdatedBy: "admin",
          },
        })
      )
    );

    return NextResponse.json({ products: results });
  } catch (error) {
    console.error("Bulk update error:", error);
    return NextResponse.json(
      { error: "Failed to update products" },
      { status: 500 }
    );
  }
}

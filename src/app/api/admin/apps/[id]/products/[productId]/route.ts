import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string; productId: string }>;
}

// DELETE /api/admin/apps/[id]/products/[productId] - Delete product config
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, productId } = await params;

    // Decode the productId (it's URL encoded)
    const decodedProductId = decodeURIComponent(productId);

    await prisma.productTokenConfig.delete({
      where: {
        appId_productId: {
          appId: id,
          productId: decodedProductId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Product delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 }
    );
  }
}

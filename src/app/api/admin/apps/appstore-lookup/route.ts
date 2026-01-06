import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Apple iTunes Lookup API response types
interface iTunesResult {
  trackId: number;
  trackName: string;
  bundleId: string;
  sellerName: string;
  description: string;
  artworkUrl60: string;
  artworkUrl100: string;
  artworkUrl512: string;
  trackViewUrl: string;
  primaryGenreName: string;
  averageUserRating?: number;
  userRatingCount?: number;
}

interface iTunesResponse {
  resultCount: number;
  results: iTunesResult[];
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "App Store URL is required" },
        { status: 400 }
      );
    }

    // Extract app ID from App Store URL
    // Format: https://apps.apple.com/us/app/app-name/id123456789
    const appIdMatch = url.match(/\/id(\d+)/);
    if (!appIdMatch) {
      return NextResponse.json(
        { error: "Invalid App Store URL. Could not extract app ID." },
        { status: 400 }
      );
    }

    const appId = appIdMatch[1];

    // Use iTunes Lookup API
    const lookupUrl = `https://itunes.apple.com/lookup?id=${appId}`;
    const response = await fetch(lookupUrl);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch app info from App Store" },
        { status: 502 }
      );
    }

    const data: iTunesResponse = await response.json();

    if (data.resultCount === 0 || !data.results[0]) {
      return NextResponse.json(
        { error: "App not found in App Store" },
        { status: 404 }
      );
    }

    const app = data.results[0];

    // Generate a slug from the app name
    const slug = app.trackName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Get the highest resolution artwork
    const iconUrl = app.artworkUrl512 || app.artworkUrl100 || app.artworkUrl60;

    return NextResponse.json({
      success: true,
      app: {
        name: app.trackName,
        slug: slug,
        description: app.description?.substring(0, 500) || "",
        iconUrl: iconUrl,
        bundleId: app.bundleId,
        appStoreUrl: app.trackViewUrl,
        developer: app.sellerName,
        category: app.primaryGenreName,
        rating: app.averageUserRating,
        ratingCount: app.userRatingCount,
      },
    });
  } catch (error) {
    console.error("App Store lookup error:", error);
    return NextResponse.json(
      { error: "Failed to lookup app" },
      { status: 500 }
    );
  }
}



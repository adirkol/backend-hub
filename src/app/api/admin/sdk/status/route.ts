import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Get SDK files recursively
function getSDKFiles(dir: string, basePath: string = ""): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".git" && entry.name !== ".build") {
        files.push(...getSDKFiles(path.join(dir, entry.name), relativePath));
      }
    } else if (entry.name.endsWith(".swift") || entry.name === "Package.swift" || entry.name === "README.md") {
      files.push(relativePath);
    }
  }
  
  return files;
}

// Get changed files since last publish using git
function getChangedFiles(sdkPath: string, lastCommitSha: string | null): string[] {
  if (!lastCommitSha) {
    // No previous publish, all files are "new"
    return getSDKFiles(sdkPath);
  }
  
  try {
    // First check if the commit SHA exists in this repo
    try {
      execSync(`git cat-file -t ${lastCommitSha}`, { cwd: process.cwd(), encoding: "utf-8" });
    } catch {
      // Commit doesn't exist in source repo (might be from distribution repo)
      // Treat as if all files are changed
      return getSDKFiles(sdkPath);
    }
    
    const result = execSync(
      `git diff --name-only ${lastCommitSha} HEAD -- packages/ios-sdk/`,
      { cwd: process.cwd(), encoding: "utf-8" }
    );
    
    return result
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(f => f.replace("packages/ios-sdk/", ""));
  } catch {
    // If git diff fails for any other reason, show all files as changed
    // (better to show false positives than miss real changes)
    return getSDKFiles(sdkPath);
  }
}

// Increment version based on type
function incrementVersion(version: string, type: "patch" | "minor" | "major" = "patch"): string {
  const [major, minor, patch] = version.split(".").map(Number);
  
  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

export async function GET() {
  try {
    // Verify admin session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get latest publish
    const latestPublish = await prisma.sDKPublish.findFirst({
      where: { status: "SUCCESS" },
      orderBy: { createdAt: "desc" },
    });

    // Get publish history (last 20)
    const publishHistory = await prisma.sDKPublish.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Get SDK files from filesystem
    const sdkPath = path.join(process.cwd(), "packages/ios-sdk");
    let sdkFiles: string[] = [];
    let hasChanges = false;
    let changedFiles: string[] = [];

    if (fs.existsSync(sdkPath)) {
      sdkFiles = getSDKFiles(sdkPath);
      changedFiles = getChangedFiles(sdkPath, latestPublish?.commitSha || null);
      hasChanges = changedFiles.length > 0;
    }

    // Suggest next version
    const latestVersion = latestPublish?.version || "0.0.0";
    const suggestedVersion = incrementVersion(latestVersion);

    return NextResponse.json({
      latestVersion: latestPublish?.version || null,
      latestPublish,
      publishHistory,
      sdkFiles,
      hasChanges,
      changedFiles,
      suggestedVersion,
    });
  } catch (error) {
    console.error("SDK status error:", error);
    return NextResponse.json(
      { error: "Failed to get SDK status" },
      { status: 500 }
    );
  }
}

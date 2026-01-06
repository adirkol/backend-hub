import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Layers } from "lucide-react";
import { ModelEditForm } from "./model-edit-form";

interface Props {
  params: Promise<{ id: string }>;
}

async function getModel(id: string) {
  const model = await prisma.aIModel.findUnique({
    where: { id },
    include: {
      providerConfigs: {
        include: {
          provider: true,
        },
        orderBy: { priority: "asc" },
      },
      appTokenConfigs: {
        include: {
          app: { select: { id: true, name: true, slug: true } },
        },
      },
      _count: { select: { jobs: true } },
    },
  });

  if (!model) return null;

  // Get all available providers
  const allProviders = await prisma.aIProvider.findMany({
    where: { isEnabled: true },
    orderBy: { displayName: "asc" },
  });

  // Get all apps for token override configuration
  const apps = await prisma.app.findMany({
    where: { isEnabled: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });

  return { model, allProviders, apps };
}

export default async function ModelEditPage({ params }: Props) {
  const { id } = await params;
  const data = await getModel(id);

  if (!data) {
    notFound();
  }

  const { model, allProviders, apps } = data;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Header */}
      <div>
        <Link
          href="/admin/models"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: "#71717a",
            fontSize: "14px",
            textDecoration: "none",
            marginBottom: "16px",
          }}
        >
          <ArrowLeft style={{ width: "16px", height: "16px" }} />
          Back to Models
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(124, 58, 237, 0.3) 100%)",
            border: "1px solid rgba(139, 92, 246, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Layers style={{ width: "28px", height: "28px", color: "#a78bfa" }} />
          </div>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa", letterSpacing: "-0.02em" }}>
              {model.displayName}
            </h1>
            <p style={{ color: "#71717a", fontSize: "14px", fontFamily: "monospace" }}>
              {model.name} • {model._count.jobs.toLocaleString()} jobs
            </p>
          </div>
        </div>
      </div>

      {/* Edit Form with Draggable Providers */}
      <ModelEditForm 
        model={model} 
        allProviders={allProviders} 
        apps={apps}
      />
    </div>
  );
}


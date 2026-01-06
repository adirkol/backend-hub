import { prisma } from "@/lib/db";
import { Activity } from "lucide-react";
import { HealthcheckClient } from "./healthcheck-client";

async function getModelsWithProviders() {
  const models = await prisma.aIModel.findMany({
    where: { isEnabled: true },
    orderBy: { displayName: "asc" },
    include: {
      providerConfigs: {
        where: { isEnabled: true },
        include: {
          provider: true,
        },
        orderBy: { priority: "asc" },
      },
    },
  });

  // Get all providers for reference
  const providers = await prisma.aIProvider.findMany({
    where: { isEnabled: true },
    orderBy: { displayName: "asc" },
  });

  return { models, providers };
}

export default async function HealthcheckPage() {
  const { models, providers } = await getModelsWithProviders();

  // Transform data for client component
  const healthcheckData = models.map((model) => ({
    id: model.id,
    name: model.name,
    displayName: model.displayName,
    modelFamily: model.modelFamily,
    providerConfigs: model.providerConfigs.map((config) => ({
      id: config.id,
      providerModelId: config.providerModelId,
      priority: config.priority,
      provider: {
        id: config.provider.id,
        name: config.provider.name,
        displayName: config.provider.displayName,
        baseUrl: config.provider.baseUrl,
      },
    })),
  }));

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.3) 100%)",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Activity style={{ width: "28px", height: "28px", color: "#34d399" }} />
          </div>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#fafafa", letterSpacing: "-0.02em" }}>
              Model Healthcheck
            </h1>
            <p style={{ color: "#71717a", fontSize: "14px", marginTop: "4px" }}>
              Test API endpoints for all AI models across providers
            </p>
          </div>
        </div>
        <div style={{
          padding: "10px 16px",
          background: "rgba(24, 24, 27, 0.6)",
          border: "1px solid rgba(63, 63, 70, 0.4)",
          borderRadius: "10px",
          fontSize: "13px",
          color: "#a1a1aa",
        }}>
          {models.length} models • {providers.length} providers
        </div>
      </div>

      {/* Healthcheck Interface */}
      <HealthcheckClient models={healthcheckData} />
    </div>
  );
}





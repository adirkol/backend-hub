import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmails = process.env.ADMIN_EMAILS;

  if (!adminEmails) {
    console.error("❌ ADMIN_EMAILS environment variable is required (comma-separated list)");
    process.exit(1);
  }

  console.log("🌱 Seeding database...\n");

  // Parse comma-separated emails and create admin users
  const emails = adminEmails.split(",").map((e) => e.trim()).filter(Boolean);
  const createdAdmins: string[] = [];

  for (const email of emails) {
    const adminUser = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: "Admin",
        role: "SUPER_ADMIN",
      },
    });
    createdAdmins.push(adminUser.email);
  }

  console.log(`✅ Admin users created/verified: ${createdAdmins.join(", ")}`);

  // Create sample AI providers
  const defapi = await prisma.aIProvider.upsert({
    where: { name: "defapi" },
    update: {},
    create: {
      name: "defapi",
      displayName: "DefAPI",
      isEnabled: true,
      apiKeyEnvVar: "DEFAPI_API_KEY",
      baseUrl: "https://api.defapi.org",
    },
  });

  const replicate = await prisma.aIProvider.upsert({
    where: { name: "replicate" },
    update: {},
    create: {
      name: "replicate",
      displayName: "Replicate",
      isEnabled: true,
      apiKeyEnvVar: "REPLICATE_API_TOKEN",
      baseUrl: "https://api.replicate.com",
    },
  });

  const openai = await prisma.aIProvider.upsert({
    where: { name: "openai" },
    update: {},
    create: {
      name: "openai",
      displayName: "OpenAI",
      isEnabled: true,
      apiKeyEnvVar: "OPENAI_API_KEY",
      baseUrl: "https://api.openai.com",
    },
  });

  console.log(`✅ AI Providers created: ${defapi.displayName}, ${replicate.displayName}, ${openai.displayName}`);

  // Create sample AI models
  const fluxDev = await prisma.aIModel.upsert({
    where: { name: "flux-dev" },
    update: {},
    create: {
      name: "flux-dev",
      displayName: "FLUX.1 Dev",
      modelFamily: "flux",
      description: "High-quality image generation model with excellent prompt following",
      tokenCost: 10,
      supportsImages: true,
      supportsPrompt: true,
      maxInputImages: 0,
      supportedAspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
      isEnabled: true,
    },
  });

  const fluxSchnell = await prisma.aIModel.upsert({
    where: { name: "flux-schnell" },
    update: {},
    create: {
      name: "flux-schnell",
      displayName: "FLUX.1 Schnell",
      modelFamily: "flux",
      description: "Fast image generation model for quick iterations",
      tokenCost: 5,
      supportsImages: true,
      supportsPrompt: true,
      maxInputImages: 0,
      supportedAspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
      isEnabled: true,
    },
  });

  // Create openai/gpt-image-1.5 model
  const gptImage = await prisma.aIModel.upsert({
    where: { name: "gpt-image-1.5" },
    update: {},
    create: {
      name: "gpt-image-1.5",
      displayName: "GPT Image 1.5",
      modelFamily: "openai",
      description: "OpenAI's GPT-based image generation model with high quality outputs",
      tokenCost: 15,
      supportsImages: true,
      supportsPrompt: true,
      maxInputImages: 4,
      supportedAspectRatios: ["1:1", "3:2", "2:3"],
      isEnabled: true,
    },
  });

  // Create google/nano-banana model
  const nanoBanana = await prisma.aIModel.upsert({
    where: { name: "nano-banana" },
    update: {},
    create: {
      name: "nano-banana",
      displayName: "Nano Banana",
      modelFamily: "google",
      description: "Google's efficient image generation model with broad aspect ratio support",
      tokenCost: 8,
      supportsImages: true,
      supportsPrompt: true,
      maxInputImages: 4,
      supportedAspectRatios: ["match_input_image", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
      isEnabled: true,
    },
  });

  // Create prunaai/p-image-edit model
  const pImageEdit = await prisma.aIModel.upsert({
    where: { name: "p-image-edit" },
    update: {},
    create: {
      name: "p-image-edit",
      displayName: "P-Image Edit",
      modelFamily: "pruna",
      description: "Sub 1 second multi-image editing model by Pruna AI. Excellent for fast, precise image editing with text rendering support.",
      tokenCost: 5,
      supportsImages: true,
      supportsPrompt: true,
      maxInputImages: 10, // Multi-image editing support
      supportedAspectRatios: ["match_input_image", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"],
      isEnabled: true,
    },
  });

  console.log(`✅ AI Models created: ${fluxDev.displayName}, ${fluxSchnell.displayName}, ${gptImage.displayName}, ${nanoBanana.displayName}, ${pImageEdit.displayName}`);

  // Create model provider configs
  await prisma.modelProviderConfig.upsert({
    where: {
      modelId_providerId: {
        modelId: fluxDev.id,
        providerId: defapi.id,
      },
    },
    update: {},
    create: {
      modelId: fluxDev.id,
      providerId: defapi.id,
      priority: 1,
      isEnabled: true,
      providerModelId: "black-forest-labs/flux-dev",
      config: {},
    },
  });

  await prisma.modelProviderConfig.upsert({
    where: {
      modelId_providerId: {
        modelId: fluxDev.id,
        providerId: replicate.id,
      },
    },
    update: {},
    create: {
      modelId: fluxDev.id,
      providerId: replicate.id,
      priority: 2,
      isEnabled: true,
      providerModelId: "black-forest-labs/flux-dev",
      config: {},
    },
  });

  await prisma.modelProviderConfig.upsert({
    where: {
      modelId_providerId: {
        modelId: fluxSchnell.id,
        providerId: replicate.id,
      },
    },
    update: {},
    create: {
      modelId: fluxSchnell.id,
      providerId: replicate.id,
      priority: 1,
      isEnabled: true,
      providerModelId: "black-forest-labs/flux-schnell",
      config: {},
    },
  });

  // Create provider configs for gpt-image-1.5 (DefAPI primary, Replicate fallback)
  await prisma.modelProviderConfig.upsert({
    where: {
      modelId_providerId: {
        modelId: gptImage.id,
        providerId: defapi.id,
      },
    },
    update: {},
    create: {
      modelId: gptImage.id,
      providerId: defapi.id,
      priority: 1,
      isEnabled: true,
      providerModelId: "openai/gpt-image-1.5",
      config: {
        aspect_ratio_map: {
          "4:3": "3:2",
          "3:4": "2:3",
          "16:9": "3:2",
          "9:16": "2:3",
        },
      },
    },
  });

  await prisma.modelProviderConfig.upsert({
    where: {
      modelId_providerId: {
        modelId: gptImage.id,
        providerId: replicate.id,
      },
    },
    update: {},
    create: {
      modelId: gptImage.id,
      providerId: replicate.id,
      priority: 2,
      isEnabled: true,
      providerModelId: "openai/gpt-image-1.5",
      config: {},
    },
  });

  // Create provider configs for nano-banana (Replicate primary, DefAPI fallback)
  await prisma.modelProviderConfig.upsert({
    where: {
      modelId_providerId: {
        modelId: nanoBanana.id,
        providerId: replicate.id,
      },
    },
    update: {},
    create: {
      modelId: nanoBanana.id,
      providerId: replicate.id,
      priority: 1,
      isEnabled: true,
      providerModelId: "google/nano-banana",
      config: {},
    },
  });

  await prisma.modelProviderConfig.upsert({
    where: {
      modelId_providerId: {
        modelId: nanoBanana.id,
        providerId: defapi.id,
      },
    },
    update: {},
    create: {
      modelId: nanoBanana.id,
      providerId: defapi.id,
      priority: 2,
      isEnabled: true,
      providerModelId: "google/nano-banana",
      config: {},
    },
  });

  // Create provider config for p-image-edit (Replicate only)
  await prisma.modelProviderConfig.upsert({
    where: {
      modelId_providerId: {
        modelId: pImageEdit.id,
        providerId: replicate.id,
      },
    },
    update: {},
    create: {
      modelId: pImageEdit.id,
      providerId: replicate.id,
      priority: 1,
      isEnabled: true,
      providerModelId: "prunaai/p-image-edit",
      config: {
        turbo: true, // Fast mode enabled by default
        disable_safety_checker: false, // Safety checker enabled by default
      },
    },
  });

  console.log("✅ Model provider configurations created");

  console.log("\n🎉 Seeding complete!");
  console.log(`\n📧 You can now login at /admin/login with: ${createdAdmins.join(" or ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

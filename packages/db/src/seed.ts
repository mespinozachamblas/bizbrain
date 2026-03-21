import { researchStreamIds } from "@bizbrain/core";
import { db } from "./index";

async function main() {
  const ownerEmail = (process.env.OWNER_EMAIL ?? "owner@example.com").trim().toLowerCase();
  const opportunityRecipients = parseDigestRecipients(process.env.DIGEST_RECIPIENTS, ownerEmail);
  const socialRecipients = parseDigestRecipients(process.env.SOCIAL_DIGEST_RECIPIENTS, ownerEmail);

  await ensureResearchStreams();
  await ensureCopyFrameworks();
  await ensureStyleProfiles();
  await ensureTopics();

  await syncDigestRecipients({
    researchStreamId: researchStreamIds.opportunity,
    ownerEmail,
    recipients: opportunityRecipients
  });

  await syncDigestRecipients({
    researchStreamId: researchStreamIds.socialMedia,
    ownerEmail,
    recipients: socialRecipients
  });

  await db.sourceConfig.upsert({
    where: { id: "seed-reddit-source-config" },
    update: {
      researchStreamIdsJson: [researchStreamIds.opportunity, researchStreamIds.socialMedia],
      topicIdsJson: ["topic-property-management", "topic-fintech-ops", "topic-founder-automation"],
      sourceType: "reddit",
      enabled: true,
      nicheModes: ["property-management", "fintech", "finance-product"],
      configJson: {
        mode: "live",
        sampleSize: 2,
        subredditList: ["landlord", "realestateinvesting", "smallbusiness", "fintech"],
        keywords: ["maintenance", "cashflow", "reserve", "workflow"],
        exclusions: ["job post", "promo"]
      }
    },
    create: {
      id: "seed-reddit-source-config",
      researchStreamIdsJson: [researchStreamIds.opportunity, researchStreamIds.socialMedia],
      topicIdsJson: ["topic-property-management", "topic-fintech-ops", "topic-founder-automation"],
      sourceType: "reddit",
      enabled: true,
      nicheModes: ["property-management", "fintech", "finance-product"],
      configJson: {
        mode: "live",
        sampleSize: 2,
        subredditList: ["landlord", "realestateinvesting", "smallbusiness", "fintech"],
        keywords: ["maintenance", "cashflow", "reserve", "workflow"],
        exclusions: ["job post", "promo"]
      }
    }
  });

  await db.sourceConfig.upsert({
    where: { id: "seed-google-trends-source-config" },
    update: {
      researchStreamIdsJson: [researchStreamIds.opportunity, researchStreamIds.socialMedia],
      topicIdsJson: ["topic-property-management", "topic-fintech-ops", "topic-founder-automation"],
      sourceType: "google-trends",
      enabled: true,
      nicheModes: ["property-management", "fintech", "finance-product"],
      configJson: {
        mode: "live",
        sampleSize: 3,
        geo: "US",
        keywords: [
          "fintech",
          "payment",
          "payments",
          "invoice",
          "invoicing",
          "accounts payable",
          "accounts receivable",
          "cash flow",
          "cashflow",
          "mortgage",
          "rent",
          "rental",
          "landlord",
          "property management",
          "proptech",
          "treasury",
          "bookkeeping",
          "accounting",
          "expense management",
          "lease"
        ]
      }
    },
    create: {
      id: "seed-google-trends-source-config",
      researchStreamIdsJson: [researchStreamIds.opportunity, researchStreamIds.socialMedia],
      topicIdsJson: ["topic-property-management", "topic-fintech-ops", "topic-founder-automation"],
      sourceType: "google-trends",
      enabled: true,
      nicheModes: ["property-management", "fintech", "finance-product"],
      configJson: {
        mode: "live",
        sampleSize: 3,
        geo: "US",
        keywords: [
          "fintech",
          "payment",
          "payments",
          "invoice",
          "invoicing",
          "accounts payable",
          "accounts receivable",
          "cash flow",
          "cashflow",
          "mortgage",
          "rent",
          "rental",
          "landlord",
          "property management",
          "proptech",
          "treasury",
          "bookkeeping",
          "accounting",
          "expense management",
          "lease"
        ]
      }
    }
  });

  await db.sourceConfig.upsert({
    where: { id: "seed-hacker-news-source-config" },
    update: {
      researchStreamIdsJson: [researchStreamIds.opportunity, researchStreamIds.socialMedia],
      topicIdsJson: ["topic-fintech-ops", "topic-founder-automation"],
      sourceType: "hacker-news",
      enabled: true,
      nicheModes: ["property-management", "fintech", "finance-product", "automation"],
      configJson: {
        mode: "live",
        sampleSize: 5,
        storyTypes: ["askstories", "showstories", "topstories"],
        keywords: [
          "fintech",
          "payment",
          "payments",
          "invoice",
          "invoicing",
          "cash flow",
          "cashflow",
          "accounting",
          "bookkeeping",
          "mortgage",
          "rent",
          "rental",
          "landlord",
          "property management",
          "proptech",
          "automation",
          "workflow",
          "saas",
          "ops",
          "operator"
        ]
      }
    },
    create: {
      id: "seed-hacker-news-source-config",
      researchStreamIdsJson: [researchStreamIds.opportunity, researchStreamIds.socialMedia],
      topicIdsJson: ["topic-fintech-ops", "topic-founder-automation"],
      sourceType: "hacker-news",
      enabled: true,
      nicheModes: ["property-management", "fintech", "finance-product", "automation"],
      configJson: {
        mode: "live",
        sampleSize: 5,
        storyTypes: ["askstories", "showstories", "topstories"],
        keywords: [
          "fintech",
          "payment",
          "payments",
          "invoice",
          "invoicing",
          "cash flow",
          "cashflow",
          "accounting",
          "bookkeeping",
          "mortgage",
          "rent",
          "rental",
          "landlord",
          "property management",
          "proptech",
          "automation",
          "workflow",
          "saas",
          "ops",
          "operator"
        ]
      }
    }
  });

  await db.sourceConfig.upsert({
    where: { id: "seed-product-hunt-source-config" },
    update: {
      researchStreamIdsJson: [researchStreamIds.opportunity, researchStreamIds.socialMedia],
      topicIdsJson: ["topic-fintech-ops", "topic-founder-automation"],
      sourceType: "product-hunt",
      enabled: true,
      nicheModes: ["property-management", "fintech", "finance-product", "automation"],
      configJson: {
        mode: process.env.PRODUCT_HUNT_ACCESS_TOKEN ? "live" : "sample",
        sampleSize: 5,
        productTopics: [
          "fintech",
          "payments",
          "finance",
          "accounting",
          "bookkeeping",
          "productivity",
          "saas",
          "automation",
          "property management",
          "real estate"
        ],
        keywords: [
          "fintech",
          "payment",
          "payments",
          "finance",
          "accounting",
          "bookkeeping",
          "cash flow",
          "mortgage",
          "rent",
          "landlord",
          "property management",
          "automation",
          "workflow",
          "saas"
        ]
      }
    },
    create: {
      id: "seed-product-hunt-source-config",
      researchStreamIdsJson: [researchStreamIds.opportunity, researchStreamIds.socialMedia],
      topicIdsJson: ["topic-fintech-ops", "topic-founder-automation"],
      sourceType: "product-hunt",
      enabled: true,
      nicheModes: ["property-management", "fintech", "finance-product", "automation"],
      configJson: {
        mode: process.env.PRODUCT_HUNT_ACCESS_TOKEN ? "live" : "sample",
        sampleSize: 5,
        productTopics: [
          "fintech",
          "payments",
          "finance",
          "accounting",
          "bookkeeping",
          "productivity",
          "saas",
          "automation",
          "property management",
          "real estate"
        ],
        keywords: [
          "fintech",
          "payment",
          "payments",
          "finance",
          "accounting",
          "bookkeeping",
          "cash flow",
          "mortgage",
          "rent",
          "landlord",
          "property management",
          "automation",
          "workflow",
          "saas"
        ]
      }
    }
  });

  console.log("BizBrain seed complete");
  console.log(`Owner recipient: ${ownerEmail}`);
  console.log(`Opportunity recipients ensured: ${opportunityRecipients.length}`);
  console.log(`Social recipients ensured: ${socialRecipients.length}`);
  console.log("Default reddit source config ensured: seed-reddit-source-config");
  console.log("Default Google Trends source config ensured: seed-google-trends-source-config");
  console.log("Default Hacker News source config ensured: seed-hacker-news-source-config");
  console.log("Default Product Hunt source config ensured: seed-product-hunt-source-config");
}

function parseDigestRecipients(input: string | undefined, ownerEmail: string) {
  const recipients = (input ?? ownerEmail)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.toLowerCase());

  return [...new Set([ownerEmail, ...recipients])];
}

async function ensureResearchStreams() {
  await db.researchStream.upsert({
    where: { id: researchStreamIds.opportunity },
    update: {
      slug: "opportunity-research",
      name: "Opportunity Research",
      description: "Business opportunity discovery and validation ideas.",
      enabled: true,
      enabledChannelsJson: ["email"],
      deliveryType: "email",
      scheduleCron: "35 06 * * *",
      defaultAssetMode: "none"
    },
    create: {
      id: researchStreamIds.opportunity,
      slug: "opportunity-research",
      name: "Opportunity Research",
      description: "Business opportunity discovery and validation ideas.",
      enabled: true,
      enabledChannelsJson: ["email"],
      deliveryType: "email",
      scheduleCron: "35 06 * * *",
      defaultAssetMode: "none"
    }
  });

  await db.researchStream.upsert({
    where: { id: researchStreamIds.socialMedia },
    update: {
      slug: "social-media-research",
      name: "Social Media Research",
      description: "Research-backed social media draft ideas for LinkedIn and X.",
      enabled: true,
      enabledChannelsJson: ["linkedin", "x"],
      deliveryType: "email",
      scheduleCron: "50 06 * * *",
      defaultAssetMode: "stock"
    },
    create: {
      id: researchStreamIds.socialMedia,
      slug: "social-media-research",
      name: "Social Media Research",
      description: "Research-backed social media draft ideas for LinkedIn and X.",
      enabled: true,
      enabledChannelsJson: ["linkedin", "x"],
      deliveryType: "email",
      scheduleCron: "50 06 * * *",
      defaultAssetMode: "stock"
    }
  });
}

async function ensureCopyFrameworks() {
  const frameworks = [
    {
      id: "framework-aida",
      slug: "aida",
      name: "AIDA",
      description: "Attention, Interest, Desire, Action.",
      structureJson: ["attention", "interest", "desire", "action"]
    },
    {
      id: "framework-pas",
      slug: "pas",
      name: "PAS",
      description: "Problem, Agitation, Solution.",
      structureJson: ["problem", "agitation", "solution"]
    },
    {
      id: "framework-bab",
      slug: "bab",
      name: "BAB",
      description: "Before, After, Bridge.",
      structureJson: ["before", "after", "bridge"]
    }
  ];

  for (const framework of frameworks) {
    await db.copyFramework.upsert({
      where: { id: framework.id },
      update: framework,
      create: framework
    });
  }
}

async function ensureStyleProfiles() {
  const profiles = [
    {
      id: "style-russell-brunson-inspired",
      slug: "russell-brunson-inspired",
      name: "Russell Brunson Inspired",
      description: "Offer-led, funnel-aware, direct-response framing.",
      inspirationSummary: "Direct-response and funnel-centric positioning without imitation.",
      styleTraitsJson: ["hook-first", "offer-led", "clear CTA"],
      guardrailsJson: ["no hype beyond evidence", "no literal impersonation"]
    },
    {
      id: "style-david-ogilvy-inspired",
      slug: "david-ogilvy-inspired",
      name: "David Ogilvy Inspired",
      description: "Clarity-led, benefit-aware, proof-conscious framing.",
      inspirationSummary: "Clear, elegant, proof-aware marketing voice without imitation.",
      styleTraitsJson: ["clarity", "proof", "plainspoken authority"],
      guardrailsJson: ["no literal impersonation", "keep claims evidence-backed"]
    },
    {
      id: "style-founder-educator",
      slug: "founder-educator",
      name: "Founder Educator",
      description: "Teaching-oriented founder/operator voice.",
      inspirationSummary: "Practical, educational, useful-to-operators framing.",
      styleTraitsJson: ["educational", "specific", "operator-first"],
      guardrailsJson: ["avoid fluff", "stay grounded in examples"]
    }
  ];

  for (const profile of profiles) {
    await db.styleProfile.upsert({
      where: { id: profile.id },
      update: profile,
      create: profile
    });
  }
}

async function ensureTopics() {
  const topics = [
    {
      id: "topic-property-management",
      researchStreamId: researchStreamIds.opportunity,
      slug: "property-management",
      name: "Property Management",
      description: "Landlord and property-management workflow pain points.",
      enabledChannelsJson: ["email"],
      keywordsJson: ["landlord", "tenant", "maintenance", "rent", "lease"],
      exclusionsJson: ["job post", "promo"],
      sourcePreferencesJson: ["reddit", "google-trends"],
      defaultAssetMode: "none"
    },
    {
      id: "topic-fintech-ops",
      researchStreamId: researchStreamIds.opportunity,
      slug: "fintech-operations",
      name: "Fintech Operations",
      description: "Payments, cashflow, finance tooling, and operational workflow ideas.",
      enabledChannelsJson: ["email"],
      keywordsJson: ["fintech", "payments", "invoice", "cash flow", "treasury"],
      exclusionsJson: ["job post", "promo"],
      sourcePreferencesJson: ["reddit", "product-hunt", "hacker-news"],
      defaultAssetMode: "none"
    },
    {
      id: "topic-founder-automation",
      researchStreamId: researchStreamIds.opportunity,
      slug: "founder-automation",
      name: "Founder Automation",
      description: "Automation and founder-ops workflow ideas.",
      enabledChannelsJson: ["email"],
      keywordsJson: ["automation", "workflow", "operator", "ops", "saas"],
      exclusionsJson: ["job post"],
      sourcePreferencesJson: ["hacker-news", "product-hunt", "reddit"],
      defaultAssetMode: "none"
    },
    {
      id: "topic-linkedin-founder-content",
      researchStreamId: researchStreamIds.socialMedia,
      slug: "linkedin-founder-content",
      name: "LinkedIn Founder Content",
      description: "Founder-led educational and opinion content for LinkedIn.",
      enabledChannelsJson: ["linkedin"],
      keywordsJson: ["founder", "operator", "growth", "workflow", "trend"],
      exclusionsJson: ["job post"],
      sourcePreferencesJson: ["reddit", "product-hunt", "hacker-news"],
      defaultCopyFrameworkId: "framework-aida",
      defaultStyleProfileId: "style-founder-educator",
      defaultAssetMode: "stock"
    },
    {
      id: "topic-x-operator-content",
      researchStreamId: researchStreamIds.socialMedia,
      slug: "x-operator-content",
      name: "X Operator Content",
      description: "Short-form hot takes, threads, and operator commentary for X.",
      enabledChannelsJson: ["x"],
      keywordsJson: ["operator", "fintech", "automation", "distribution", "trend"],
      exclusionsJson: ["job post"],
      sourcePreferencesJson: ["hacker-news", "product-hunt", "reddit"],
      defaultCopyFrameworkId: "framework-pas",
      defaultStyleProfileId: "style-russell-brunson-inspired",
      defaultAssetMode: "ai-generated"
    }
  ];

  for (const topic of topics) {
    await db.topic.upsert({
      where: {
        researchStreamId_slug: {
          researchStreamId: topic.researchStreamId,
          slug: topic.slug
        }
      },
      update: topic,
      create: topic
    });
  }
}

async function syncDigestRecipients(input: {
  researchStreamId: string;
  ownerEmail: string;
  recipients: string[];
}) {
  await db.digestRecipient.updateMany({
    where: {
      researchStreamId: input.researchStreamId,
      isOwnerDefault: true,
      email: { not: input.ownerEmail }
    },
    data: {
      isOwnerDefault: false
    }
  });

  for (const recipient of input.recipients) {
    const normalizedRecipient = recipient.trim().toLowerCase();

    await db.digestRecipient.upsert({
      where: {
        researchStreamId_email: {
          researchStreamId: input.researchStreamId,
          email: normalizedRecipient
        }
      },
      update: {
        enabled: true,
        isOwnerDefault: normalizedRecipient === input.ownerEmail
      },
      create: {
        researchStreamId: input.researchStreamId,
        email: normalizedRecipient,
        enabled: true,
        isOwnerDefault: normalizedRecipient === input.ownerEmail
      }
    });
  }

  if (input.ownerEmail !== "owner@example.com") {
    await db.digestRecipient.updateMany({
      where: {
        researchStreamId: input.researchStreamId,
        email: "owner@example.com"
      },
      data: {
        enabled: false,
        isOwnerDefault: false
      }
    });
  }
}

main()
  .catch((error) => {
    console.error("BizBrain seed failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });

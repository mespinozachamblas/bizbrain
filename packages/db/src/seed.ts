import { db } from "./index";

async function main() {
  const ownerEmail = (process.env.OWNER_EMAIL ?? "owner@example.com").trim().toLowerCase();
  const digestRecipients = parseDigestRecipients(process.env.DIGEST_RECIPIENTS, ownerEmail);

  await db.digestRecipient.updateMany({
    where: {
      isOwnerDefault: true,
      email: { not: ownerEmail }
    },
    data: {
      isOwnerDefault: false
    }
  });

  await db.digestRecipient.upsert({
    where: { email: ownerEmail },
    update: {
      enabled: true,
      isOwnerDefault: true
    },
    create: {
      email: ownerEmail,
      enabled: true,
      isOwnerDefault: true
    }
  });

  for (const recipient of digestRecipients) {
    const normalizedRecipient = recipient.trim().toLowerCase();

    await db.digestRecipient.upsert({
      where: { email: normalizedRecipient },
      update: {
        enabled: true,
        isOwnerDefault: normalizedRecipient === ownerEmail
      },
      create: {
        email: normalizedRecipient,
        enabled: true,
        isOwnerDefault: normalizedRecipient === ownerEmail
      }
    });
  }

  if (ownerEmail !== "owner@example.com") {
    await db.digestRecipient.updateMany({
      where: { email: "owner@example.com" },
      data: {
        enabled: false,
        isOwnerDefault: false
      }
    });
  }

  await db.sourceConfig.upsert({
    where: { id: "seed-reddit-source-config" },
    update: {
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

  console.log("BizBrain seed complete");
  console.log(`Owner recipient: ${ownerEmail}`);
  console.log(`Total digest recipients ensured: ${digestRecipients.length}`);
  console.log("Default reddit source config ensured: seed-reddit-source-config");
  console.log("Default Google Trends source config ensured: seed-google-trends-source-config");
}

function parseDigestRecipients(input: string | undefined, ownerEmail: string) {
  const recipients = (input ?? ownerEmail)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.toLowerCase());

  return [...new Set([ownerEmail, ...recipients])];
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

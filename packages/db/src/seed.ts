import { db } from "./index";

async function main() {
  const ownerEmail = process.env.OWNER_EMAIL ?? "owner@example.com";
  const digestRecipients = parseDigestRecipients(process.env.DIGEST_RECIPIENTS, ownerEmail);

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
    await db.digestRecipient.upsert({
      where: { email: recipient },
      update: {
        enabled: true,
        isOwnerDefault: recipient === ownerEmail
      },
      create: {
        email: recipient,
        enabled: true,
        isOwnerDefault: recipient === ownerEmail
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
        sampleSize: 2,
        subredditList: ["landlord", "realestateinvesting", "smallbusiness", "fintech"],
        keywords: ["maintenance", "cashflow", "reserve", "workflow"],
        exclusions: ["job post", "promo"]
      }
    }
  });

  console.log("BizBrain seed complete");
  console.log(`Owner recipient: ${ownerEmail}`);
  console.log(`Total digest recipients ensured: ${digestRecipients.length}`);
  console.log("Default reddit source config ensured: seed-reddit-source-config");
}

function parseDigestRecipients(input: string | undefined, ownerEmail: string) {
  const recipients = (input ?? ownerEmail)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

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

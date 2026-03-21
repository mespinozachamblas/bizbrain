import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../packages/db/src";

type ResearchStreamRow = {
  Name: string;
  Slug: string;
  Description: string;
  Channels: string;
  Schedule: string;
  "Asset mode": string;
  "Delivery type": string;
  Enabled: string;
};

type TopicRow = {
  "Research stream": string;
  Name: string;
  Slug: string;
  Channels: string;
  Description: string;
  Keywords: string;
  Exclusions: string;
  "Source preferences": string;
  "Default framework": string;
  "Default style": string;
  "Asset mode": string;
  Enabled: string;
};

async function main() {
  const streamsPath = process.argv[2] ?? "/Users/maxespinoza/Downloads/bizbrain-research-streams.csv";
  const topicsPath = process.argv[3] ?? "/Users/maxespinoza/Downloads/bizbrain-topics.csv";

  const [streamRows, topicRows] = await Promise.all([
    readCsv<ResearchStreamRow>(streamsPath),
    readCsv<TopicRow>(topicsPath)
  ]);

  const frameworkByName = new Map(
    (await db.copyFramework.findMany({ select: { id: true, name: true } })).map((framework) => [framework.name.toLowerCase(), framework.id])
  );
  const styleByName = new Map(
    (await db.styleProfile.findMany({ select: { id: true, name: true } })).map((profile) => [profile.name.toLowerCase(), profile.id])
  );
  const streamIdByName = new Map<string, string>();

  for (const row of streamRows) {
    const slug = row.Slug.trim();
    const existing = await db.researchStream.findUnique({
      where: { slug },
      select: { id: true, defaultCopyFrameworkId: true, defaultStyleProfileId: true }
    });
    const id = existing?.id ?? `stream-${slug}`;

    await db.researchStream.upsert({
      where: { slug },
      update: {
        name: row.Name.trim(),
        description: readOptionalText(row.Description),
        enabled: parseYesNo(row.Enabled),
        enabledChannelsJson: parseList(row.Channels),
        deliveryType: readOptionalText(row["Delivery type"]) ?? "email",
        scheduleCron: readOptionalText(row.Schedule),
        defaultAssetMode: readOptionalText(row["Asset mode"]),
        defaultCopyFrameworkId: existing?.defaultCopyFrameworkId ?? null,
        defaultStyleProfileId: existing?.defaultStyleProfileId ?? null
      },
      create: {
        id,
        slug,
        name: row.Name.trim(),
        description: readOptionalText(row.Description),
        enabled: parseYesNo(row.Enabled),
        enabledChannelsJson: parseList(row.Channels),
        deliveryType: readOptionalText(row["Delivery type"]) ?? "email",
        scheduleCron: readOptionalText(row.Schedule),
        defaultAssetMode: readOptionalText(row["Asset mode"])
      }
    });

    streamIdByName.set(normalizeKey(row.Name), id);
  }

  for (const row of topicRows) {
    const researchStreamId = streamIdByName.get(normalizeKey(row["Research stream"]));

    if (!researchStreamId) {
      throw new Error(`Unknown research stream in topics CSV: ${row["Research stream"]}`);
    }

    const slug = row.Slug.trim();
    const frameworkId = resolveLookupId(frameworkByName, row["Default framework"]);
    const styleProfileId = resolveLookupId(styleByName, row["Default style"]);
    const existing = await db.topic.findUnique({
      where: {
        researchStreamId_slug: {
          researchStreamId,
          slug
        }
      },
      select: { id: true }
    });

    await db.topic.upsert({
      where: {
        researchStreamId_slug: {
          researchStreamId,
          slug
        }
      },
      update: {
        name: row.Name.trim(),
        description: readOptionalText(row.Description),
        enabled: parseYesNo(row.Enabled),
        enabledChannelsJson: parseList(row.Channels),
        keywordsJson: parseList(row.Keywords),
        exclusionsJson: parseList(row.Exclusions),
        sourcePreferencesJson: parseList(row["Source preferences"]),
        defaultCopyFrameworkId: frameworkId,
        defaultStyleProfileId: styleProfileId,
        defaultAssetMode: readOptionalText(row["Asset mode"])
      },
      create: {
        id: existing?.id ?? `topic-${researchStreamId.replace(/^stream-/, "")}-${slug}`,
        researchStreamId,
        slug,
        name: row.Name.trim(),
        description: readOptionalText(row.Description),
        enabled: parseYesNo(row.Enabled),
        enabledChannelsJson: parseList(row.Channels),
        keywordsJson: parseList(row.Keywords),
        exclusionsJson: parseList(row.Exclusions),
        sourcePreferencesJson: parseList(row["Source preferences"]),
        defaultCopyFrameworkId: frameworkId,
        defaultStyleProfileId: styleProfileId,
        defaultAssetMode: readOptionalText(row["Asset mode"])
      }
    });
  }

  console.log(`Imported ${streamRows.length} research stream(s) from ${path.basename(streamsPath)}.`);
  console.log(`Imported ${topicRows.length} topic(s) from ${path.basename(topicsPath)}.`);
}

function resolveLookupId(lookup: Map<string, string>, value: string) {
  const normalized = normalizeKey(value);

  if (!normalized || normalized === "use stream default") {
    return null;
  }

  return lookup.get(normalized) ?? null;
}

async function readCsv<T extends Record<string, string>>(filePath: string) {
  const raw = await fs.readFile(filePath, "utf8");
  const rows = parseCsv(raw);
  const [header, ...dataRows] = rows;

  if (!header || header.length === 0) {
    throw new Error(`CSV is missing a header row: ${filePath}`);
  }

  return dataRows
    .filter((row) => row.some((value) => value.trim().length > 0))
    .map((row) => {
      const record: Record<string, string> = {};

      for (let index = 0; index < header.length; index += 1) {
        record[header[index] ?? `column-${index}`] = row[index] ?? "";
      }

      return record as T;
    });
}

function parseCsv(input: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const nextCharacter = input[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

function parseList(input: string) {
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseYesNo(input: string) {
  return normalizeKey(input) === "yes";
}

function readOptionalText(input: string) {
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeKey(input: string) {
  return input.trim().toLowerCase();
}

main()
  .catch((error) => {
    console.error("Research config import failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });

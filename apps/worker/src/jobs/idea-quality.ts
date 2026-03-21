type SourceAttributionInput = Array<{
  rawSignal: {
    sourceType: string;
    title: string | null;
    sourceUrl: string | null;
  };
}>;

export function buildSourceAttribution(clusterMemberships: SourceAttributionInput) {
  const grouped = new Map<
    string,
    {
      signalCount: number;
      sampleTitles: string[];
      sampleUrls: string[];
    }
  >();

  for (const membership of clusterMemberships) {
    const sourceType = membership.rawSignal.sourceType;
    const entry = grouped.get(sourceType) ?? {
      signalCount: 0,
      sampleTitles: [],
      sampleUrls: []
    };

    entry.signalCount += 1;

    if (membership.rawSignal.title && entry.sampleTitles.length < 3 && !entry.sampleTitles.includes(membership.rawSignal.title)) {
      entry.sampleTitles.push(membership.rawSignal.title);
    }

    if (membership.rawSignal.sourceUrl && entry.sampleUrls.length < 3 && !entry.sampleUrls.includes(membership.rawSignal.sourceUrl)) {
      entry.sampleUrls.push(membership.rawSignal.sourceUrl);
    }

    grouped.set(sourceType, entry);
  }

  return Array.from(grouped.entries())
    .map(([sourceType, value]) => ({
      sourceType,
      signalCount: value.signalCount,
      sampleTitles: value.sampleTitles,
      sampleUrls: value.sampleUrls
    }))
    .sort((left, right) => right.signalCount - left.signalCount || left.sourceType.localeCompare(right.sourceType));
}

export function inferFallbackQuality(input: {
  category: string;
  businessType: string;
  targetCustomer: string;
  problemSummary: string;
  solutionConcept: string;
  monetizationAngle: string;
  signalCount: number;
  sourceAttribution: Array<{
    sourceType: string;
    signalCount: number;
    sampleTitles: string[];
    sampleUrls: string[];
  }>;
}) {
  let qualityScore = 1.5;
  const reasons: string[] = [];

  if (input.businessType.trim()) {
    qualityScore += 1;
    reasons.push("business model is explicit");
  }

  if (input.targetCustomer.trim() && input.targetCustomer !== "Founder / operator") {
    qualityScore += 0.75;
    reasons.push("buyer is named");
  }

  if (isSpecificIdeaText(input.problemSummary)) {
    qualityScore += 1.75;
    reasons.push("problem statement is specific");
  }

  if (isSpecificIdeaText(input.solutionConcept) && !/build a lightweight/i.test(input.solutionConcept)) {
    qualityScore += 1.75;
    reasons.push("solution concept is concrete");
  }

  if (isSpecificIdeaText(input.monetizationAngle) && !/subscription saas with premium workflow automation/i.test(input.monetizationAngle)) {
    qualityScore += 1.25;
    reasons.push("monetization path is clear");
  }

  if (input.signalCount >= 2) {
    qualityScore += 1.25;
    reasons.push("supported by repeated signals");
  } else if (input.signalCount === 1) {
    qualityScore += 0.25;
  }

  if (input.sourceAttribution.length >= 2) {
    qualityScore += 1;
    reasons.push("supported across multiple sources");
  } else if (input.sourceAttribution.length === 1) {
    qualityScore += 0.25;
  }

  if (input.category !== "general") {
    qualityScore += 0.5;
  }

  const normalizedScore = Math.round(Math.min(10, qualityScore) * 10) / 10;
  const qualityReason =
    reasons.length > 0
      ? `Fallback quality score ${normalizedScore}/10 because ${reasons.slice(0, 3).join(", ")}.`
      : `Fallback quality score ${normalizedScore}/10 based on limited specificity in the current evidence.`;

  return {
    qualityScore: normalizedScore,
    qualityReason
  };
}

function isSpecificIdeaText(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length < 40) {
    return false;
  }

  if (/^recurring\s+/i.test(normalized)) {
    return false;
  }

  if (/around\s+[a-z]{2,12}\.?$/i.test(normalized)) {
    return false;
  }

  return true;
}

import type { NetworkSnapshot, ISPProvider, Link, LinkType } from "@/types/telemetry";

/**
 * Aggregates all links from the snapshot into ISPProvider objects,
 * one per unique provider name.
 */
export function extractISPProviders(snapshot: NetworkSnapshot): ISPProvider[] {
  type Acc = Record<
    string,
    {
      name: string;
      linkTypes: Set<LinkType>;
      siteNames: Set<string>;
      links: (Link & { siteName: string })[];
    }
  >;

  const acc: Acc = {};

  for (const site of snapshot.sites) {
    for (const link of site.links) {
      const key = link.provider.toLowerCase().replace(/\s+/g, "-");
      if (!acc[key]) {
        acc[key] = {
          name: link.provider,
          linkTypes: new Set(),
          siteNames: new Set(),
          links: [],
        };
      }
      acc[key].linkTypes.add(link.type);
      acc[key].siteNames.add(site.name);
      acc[key].links.push({ ...link, siteName: site.name });
    }
  }

  return Object.entries(acc).map(([id, data]) => {
    const allLinks = data.links;
    const activeLinks = allLinks.filter((l) => l.status === "active");
    const failedLinks = allLinks.filter((l) => l.status === "failed");

    const totalBw = allLinks.reduce((s, l) => s + l.bandwidthMbps, 0);
    const currentUsage = activeLinks.reduce((s, l) => s + l.usageMbps, 0);
    const avgLatency =
      activeLinks.length > 0
        ? activeLinks.reduce((s, l) => s + l.latencyMs, 0) / activeLinks.length
        : 0;
    const avgUptime =
      allLinks.length > 0
        ? allLinks.reduce((s, l) => s + l.uptimePercent, 0) / allLinks.length
        : 100;

    // Health: penalise failed links and high saturation
    const failedPenalty = (failedLinks.length / allLinks.length) * 40;
    const saturation = totalBw > 0 ? currentUsage / totalBw : 0;
    const satPenalty = saturation > 0.85 ? (saturation - 0.85) * 60 : 0;
    const healthScore = Math.round(
      Math.min(100, Math.max(0, avgUptime - failedPenalty - satPenalty))
    );

    return {
      id,
      name: data.name,
      linkTypes: Array.from(data.linkTypes),
      siteNames: Array.from(data.siteNames),
      healthScore,
      avgLatencyMs: parseFloat(avgLatency.toFixed(1)),
      totalBandwidthMbps: totalBw,
      currentUsageMbps: parseFloat(currentUsage.toFixed(1)),
      avgUptimePercent: parseFloat(avgUptime.toFixed(2)),
      failedLinks: failedLinks.length,
      activeLinks: activeLinks.length,
      claimStatus: "idle" as const,
    };
  });
}

export function ispHealthTone(
  score: number
): "green" | "amber" | "red" {
  if (score >= 90) return "green";
  if (score >= 65) return "amber";
  return "red";
}

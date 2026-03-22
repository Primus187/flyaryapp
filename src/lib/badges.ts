export type BadgeCategory = "flights" | "time" | "altitude" | "distance" | "sites" | "records" | "seasonal";
export type BadgeTier = "bronze" | "silver" | "gold";

export interface BadgeDefinition {
  key: string;
  category: BadgeCategory;
  tier: BadgeTier;
  threshold: number;
  thresholdUnit: string; // for display: "flights", "h", "hm", "km", "sites"
  icon: string; // lucide icon name
}

export const BADGE_CATEGORY_COLORS: Record<BadgeCategory, { bg: string; border: string; text: string }> = {
  flights: { bg: "hsl(210, 70%, 50%)", border: "hsl(210, 70%, 40%)", text: "hsl(210, 70%, 95%)" },
  time: { bg: "hsl(160, 60%, 42%)", border: "hsl(160, 60%, 32%)", text: "hsl(160, 60%, 95%)" },
  altitude: { bg: "hsl(280, 55%, 50%)", border: "hsl(280, 55%, 40%)", text: "hsl(280, 55%, 95%)" },
  distance: { bg: "hsl(25, 80%, 50%)", border: "hsl(25, 80%, 40%)", text: "hsl(25, 80%, 95%)" },
  sites: { bg: "hsl(340, 60%, 50%)", border: "hsl(340, 60%, 40%)", text: "hsl(340, 60%, 95%)" },
  records: { bg: "hsl(45, 90%, 48%)", border: "hsl(45, 90%, 38%)", text: "hsl(45, 90%, 15%)" },
  seasonal: { bg: "hsl(140, 65%, 45%)", border: "hsl(140, 65%, 35%)", text: "hsl(140, 65%, 95%)" },
};

export const BADGE_TIER_BORDER: Record<BadgeTier, string> = {
  bronze: "hsl(30, 50%, 55%)",
  silver: "hsl(0, 0%, 72%)",
  gold: "hsl(45, 90%, 50%)",
};

export const BADGES: BadgeDefinition[] = [
  // Flights
  { key: "first_flight", category: "flights", tier: "bronze", threshold: 1, thresholdUnit: "", icon: "Plane" },
  { key: "weekend_warrior", category: "flights", tier: "bronze", threshold: 10, thresholdUnit: "", icon: "Plane" },
  { key: "frequent_flyer", category: "flights", tier: "silver", threshold: 50, thresholdUnit: "", icon: "Plane" },
  { key: "century_pilot", category: "flights", tier: "silver", threshold: 100, thresholdUnit: "", icon: "Plane" },
  { key: "sky_addict", category: "flights", tier: "gold", threshold: 250, thresholdUnit: "", icon: "Plane" },
  // Time
  { key: "airborne", category: "time", tier: "bronze", threshold: 1, thresholdUnit: "h", icon: "Clock" },
  { key: "day_tripper", category: "time", tier: "bronze", threshold: 10, thresholdUnit: "h", icon: "Clock" },
  { key: "marathon_pilot", category: "time", tier: "silver", threshold: 50, thresholdUnit: "h", icon: "Clock" },
  { key: "time_lord", category: "time", tier: "silver", threshold: 100, thresholdUnit: "h", icon: "Clock" },
  { key: "eternal_wings", category: "time", tier: "gold", threshold: 500, thresholdUnit: "h", icon: "Clock" },
  // Altitude
  { key: "climber", category: "altitude", tier: "bronze", threshold: 1000, thresholdUnit: "hm", icon: "Mountain" },
  { key: "cloud_surfer", category: "altitude", tier: "silver", threshold: 10000, thresholdUnit: "hm", icon: "Mountain" },
  { key: "eagle_eye", category: "altitude", tier: "silver", threshold: 50000, thresholdUnit: "hm", icon: "Mountain" },
  { key: "stratosphere", category: "altitude", tier: "gold", threshold: 100000, thresholdUnit: "hm", icon: "Mountain" },
  // Distance
  { key: "explorer", category: "distance", tier: "bronze", threshold: 50, thresholdUnit: "km", icon: "Map" },
  { key: "cross_country", category: "distance", tier: "silver", threshold: 200, thresholdUnit: "km", icon: "Map" },
  { key: "long_distance", category: "distance", tier: "silver", threshold: 500, thresholdUnit: "km", icon: "Map" },
  { key: "globe_trotter", category: "distance", tier: "gold", threshold: 1000, thresholdUnit: "km", icon: "Map" },
  // Sites
  { key: "trailblazer", category: "sites", tier: "bronze", threshold: 5, thresholdUnit: "", icon: "MapPin" },
  { key: "nomad", category: "sites", tier: "silver", threshold: 15, thresholdUnit: "", icon: "MapPin" },
  { key: "world_pilot", category: "sites", tier: "gold", threshold: 30, thresholdUnit: "", icon: "MapPin" },
  // Records
  { key: "thermik_king", category: "records", tier: "gold", threshold: 120, thresholdUnit: "min", icon: "Flame" },
  { key: "xc_beast", category: "records", tier: "gold", threshold: 50, thresholdUnit: "km", icon: "Zap" },
  { key: "high_flyer", category: "records", tier: "gold", threshold: 2000, thresholdUnit: "hm", icon: "ArrowUp" },
  // Seasonal
  { key: "summer_pilot_2025", category: "seasonal", tier: "gold", threshold: 20, thresholdUnit: "☀️", icon: "Sun" },
  { key: "summer_pilot_2026", category: "seasonal", tier: "gold", threshold: 20, thresholdUnit: "☀️", icon: "Sun" },
  { key: "winter_eagle_2025", category: "seasonal", tier: "silver", threshold: 10, thresholdUnit: "❄️", icon: "Snowflake" },
  { key: "winter_eagle_2026", category: "seasonal", tier: "silver", threshold: 10, thresholdUnit: "❄️", icon: "Snowflake" },
  { key: "year_round_2024", category: "seasonal", tier: "gold", threshold: 12, thresholdUnit: "mo", icon: "Calendar" },
  { key: "year_round_2025", category: "seasonal", tier: "gold", threshold: 12, thresholdUnit: "mo", icon: "Calendar" },
  { key: "year_round_2026", category: "seasonal", tier: "gold", threshold: 12, thresholdUnit: "mo", icon: "Calendar" },
];

export function getBadgeDefinition(key: string): BadgeDefinition | undefined {
  return BADGES.find(b => b.key === key);
}

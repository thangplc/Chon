import type { PurposeId, VibeDimension, VibeScores } from "./explore-contract";

export type PurposePreference = Readonly<{
  targets: VibeScores;
  weights: Readonly<Record<VibeDimension, number>>;
}>;

/**
 * Default ranking preferences for each product purpose.
 *
 * Weights are expressed as percentages and intentionally live beside the
 * target scores so a future explainable-ranking UI can show the same source
 * of truth without duplicating ranking rules.
 */
export const purposePreferences = {
  business_meeting: {
    targets: {
      crowd: 2,
      lighting: 2,
      noise: 1,
      privacy: 5,
      socialEnergy: 2,
      workability: 5,
    },
    weights: {
      crowd: 5,
      lighting: 10,
      noise: 20,
      privacy: 30,
      socialEnergy: 10,
      workability: 25,
    },
  },
  date: {
    targets: {
      crowd: 3,
      lighting: 5,
      noise: 2,
      privacy: 5,
      socialEnergy: 3,
      workability: 1,
    },
    weights: {
      crowd: 10,
      lighting: 20,
      noise: 15,
      privacy: 25,
      socialEnergy: 20,
      workability: 10,
    },
  },
  friends: {
    targets: {
      crowd: 4,
      lighting: 4,
      noise: 4,
      privacy: 2,
      socialEnergy: 5,
      workability: 1,
    },
    weights: {
      crowd: 25,
      lighting: 15,
      noise: 15,
      privacy: 10,
      socialEnergy: 30,
      workability: 5,
    },
  },
  late_night: {
    targets: {
      crowd: 3,
      lighting: 4,
      noise: 3,
      privacy: 3,
      socialEnergy: 4,
      workability: 1,
    },
    weights: {
      crowd: 15,
      lighting: 20,
      noise: 20,
      privacy: 10,
      socialEnergy: 25,
      workability: 10,
    },
  },
  relax: {
    targets: {
      crowd: 2,
      lighting: 3,
      noise: 1,
      privacy: 4,
      socialEnergy: 1,
      workability: 2,
    },
    weights: {
      crowd: 15,
      lighting: 10,
      noise: 30,
      privacy: 20,
      socialEnergy: 20,
      workability: 5,
    },
  },
  solo: {
    targets: {
      crowd: 2,
      lighting: 3,
      noise: 2,
      privacy: 4,
      socialEnergy: 2,
      workability: 3,
    },
    weights: {
      crowd: 15,
      lighting: 10,
      noise: 20,
      privacy: 25,
      socialEnergy: 10,
      workability: 20,
    },
  },
  study: {
    targets: {
      crowd: 2,
      lighting: 1,
      noise: 1,
      privacy: 4,
      socialEnergy: 1,
      workability: 5,
    },
    weights: {
      crowd: 10,
      lighting: 10,
      noise: 25,
      privacy: 20,
      socialEnergy: 5,
      workability: 30,
    },
  },
  work: {
    targets: {
      crowd: 2,
      lighting: 2,
      noise: 1,
      privacy: 4,
      socialEnergy: 1,
      workability: 5,
    },
    weights: {
      crowd: 10,
      lighting: 10,
      noise: 25,
      privacy: 15,
      socialEnergy: 10,
      workability: 30,
    },
  },
} satisfies Readonly<Record<PurposeId, PurposePreference>>;

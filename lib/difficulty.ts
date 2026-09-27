import type { Difficulty } from "./types";

/**
 * 难度段位表，rank 越大越难。
 * 配色定义在 app/globals.css 的 .tier-* 里。
 */
export interface DifficultyTier {
  id: Difficulty;
  label: string;
  rank: number;
  className: string;
}

export const DIFFICULTY_TIERS: DifficultyTier[] = [
  { id: "newbie", label: "Newbie", rank: 1, className: "tier-newbie" },
  { id: "pupil", label: "Pupil", rank: 2, className: "tier-pupil" },
  { id: "specialist", label: "Specialist", rank: 3, className: "tier-specialist" },
  { id: "expert", label: "Expert", rank: 4, className: "tier-expert" },
  {
    id: "candidate_master",
    label: "Candidate Master",
    rank: 5,
    className: "tier-candidate-master",
  },
  { id: "master", label: "Master", rank: 6, className: "tier-master" },
  {
    id: "international_master",
    label: "International Master",
    rank: 7,
    className: "tier-international-master",
  },
  { id: "grandmaster", label: "Grandmaster", rank: 8, className: "tier-grandmaster" },
  {
    id: "international_grandmaster",
    label: "International Grandmaster",
    rank: 9,
    className: "tier-international-grandmaster",
  },
  {
    id: "legendary_grandmaster",
    label: "Legendary Grandmaster",
    rank: 10,
    className: "tier-legendary-grandmaster",
  },
];

const TIER_BY_ID = new Map<Difficulty, DifficultyTier>(
  DIFFICULTY_TIERS.map((tier) => [tier.id, tier]),
);

export function difficultyTier(id: Difficulty): DifficultyTier {
  return TIER_BY_ID.get(id) ?? DIFFICULTY_TIERS[0];
}
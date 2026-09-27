import { difficultyTier } from "@/lib/difficulty";
import type { Difficulty } from "@/lib/types";

/** 难度段位徽标，配色与段位表见 lib/difficulty.ts / app/globals.css */
export function DifficultyBadge({
  difficulty,
  size = "sm",
}: {
  difficulty: Difficulty;
  size?: "sm" | "lg";
}) {
  const tier = difficultyTier(difficulty);
  return (
    <span
      className={`inline-flex items-center justify-center font-semibold rounded-md border tracking-tight transition-colors ${
        tier.className
      } ${
        size === "lg"
          ? "px-3 py-1 text-sm"
          : "px-2.5 py-0.5 text-xs leading-normal"
      }`}
      title={`难度段位 ${tier.rank}/10 · ${tier.label}`}
    >
      {tier.label}
    </span>
  );
}
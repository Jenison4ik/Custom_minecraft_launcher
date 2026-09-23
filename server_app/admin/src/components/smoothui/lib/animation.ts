export const SPRING_DEFAULT = {
  bounce: 0.1,
  duration: 0.25,
  type: "spring" as const,
};

/** Snappy spring for quick, no-overshoot transitions */
export const SPRING_SNAPPY = {
  bounce: 0,
  duration: 0.2,
  type: "spring" as const,
};

/** Ease-out curve for entering elements — cubic-bezier(.23, 1, .32, 1) */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Ease-in-out curve for moving elements — cubic-bezier(0.645, 0.045, 0.355, 1) */
export const EASE_IN_OUT = [0.645, 0.045, 0.355, 1] as const;

/** Instant transition for reduced-motion contexts */
export const DURATION_INSTANT = { duration: 0 };

/** Standard animation durations (seconds) */
export const DURATION = {
  complex: 0.4,
  default: 0.25,
  fast: 0.15,
  slow: 0.3,
} as const;

export type SpringConfig = typeof SPRING_DEFAULT;
export type EasingCurve = readonly [number, number, number, number];

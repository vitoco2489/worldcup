"use client";

import { AnimatePresence, motion } from "framer-motion";

type Props = {
  /** Increment after a successful save to replay the kick animation. */
  pulse: number;
};

export function FootballKick({ pulse }: Props) {
  return (
    <span className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      <AnimatePresence initial={false}>
        {pulse > 0 ? (
          <motion.span
            key={pulse}
            className="absolute bottom-2 right-4 text-2xl select-none will-change-transform"
            initial={{ opacity: 0, scale: 0.82, x: 0, y: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0.82, 1.14, 1.06, 0.92],
              x: [0, 16, 34],
              y: [0, -40, -86],
            }}
            transition={{ duration: 1.25, ease: [0.25, 0.9, 0.35, 1] }}
          >
            ⚽
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

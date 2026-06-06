"use client";

import { AnimatePresence, motion } from "framer-motion";

type Choice = "home" | "away" | "draw";

type Props = {
  pulse: number;
  choice: Choice;
  homeCode: string;
  awayCode: string;
};

const flagUrl = (code: string) => `https://flagcdn.com/w40/${code.toLowerCase()}.png`;

function isRealFlag(code: string): boolean {
  return !(code.length > 3 || /^[wl]?\d/i.test(code) || code === "tbd");
}

export function BetChoiceBurst({ pulse, choice, homeCode, awayCode }: Props) {
  const position =
    choice === "home" ? "left-[18%]" : choice === "draw" ? "left-1/2 -translate-x-1/2" : "right-[18%]";

  const showHomeFlag = choice === "home" && isRealFlag(homeCode);
  const showAwayFlag = choice === "away" && isRealFlag(awayCode);

  return (
    <span className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      <AnimatePresence initial={false}>
        {pulse > 0 ? (
          <motion.span
            key={pulse}
            className={`absolute bottom-16 flex flex-col items-center gap-0.5 ${position}`}
            initial={{ opacity: 0, scale: 0.5, y: 8 }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0.5, 1.2, 1.05, 0.85],
              y: [8, -28, -52, -68],
            }}
            transition={{ duration: 0.75, ease: [0.22, 0.95, 0.35, 1] }}
          >
            {choice === "draw" ? (
              <motion.span
                className="text-3xl select-none"
                animate={{ rotate: [0, -8, 8, -4, 0] }}
                transition={{ duration: 0.45, delay: 0.05 }}
              >
                🤝
              </motion.span>
            ) : showHomeFlag || showAwayFlag ? (
              <img
                src={flagUrl(showHomeFlag ? homeCode : awayCode)}
                alt=""
                className="h-9 w-12 rounded-sm object-cover shadow-lg ring-2 ring-white/25"
              />
            ) : (
              <span className="text-3xl select-none">⚽</span>
            )}
            {choice === "draw" ? (
              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-200/90">Empate</span>
            ) : null}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

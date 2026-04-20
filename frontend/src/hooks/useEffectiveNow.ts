"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchServerTime } from "@/lib/api";

/**
 * Tracks server time (including admin simulated clock) using skew vs local `Date.now()`.
 * Re-syncs periodically to limit drift when simulation is off.
 */
export function useEffectiveNow() {
  const [skewMs, setSkewMs] = useState(0);
  const [tick, setTick] = useState(0);
  const [isSimulated, setIsSimulated] = useState(false);

  const sync = useCallback(async () => {
    try {
      const t0 = Date.now();
      const { now, is_simulated } = await fetchServerTime();
      const t1 = Date.now();
      const serverMs = Date.parse(now);
      if (Number.isNaN(serverMs)) return;
      const rtt = t1 - t0;
      const estimateServerMs = serverMs + rtt / 2;
      setSkewMs(estimateServerMs - t1);
      setIsSimulated(is_simulated);
    } catch {
      setSkewMs(0);
      setIsSimulated(false);
    }
  }, []);

  useEffect(() => {
    void sync();
  }, [sync]);

  useEffect(() => {
    const i = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const i = setInterval(() => void sync(), 30_000);
    return () => clearInterval(i);
  }, [sync]);

  const effectiveNowMs = Date.now() + skewMs;
  return { effectiveNowMs, isSimulated, resync: sync };
}

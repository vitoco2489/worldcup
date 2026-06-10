"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MatchResultsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/?tab=resultados");
  }, [router]);
  return null;
}

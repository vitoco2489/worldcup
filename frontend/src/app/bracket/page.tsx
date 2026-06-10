"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BracketPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/?tab=cuadro");
  }, [router]);
  return null;
}

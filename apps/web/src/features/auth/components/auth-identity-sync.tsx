"use client";

import { useEffect } from "react";

export function AuthIdentitySync() {
  useEffect(() => {
    void fetch("/api/auth/me", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    }).catch(() => undefined);
  }, []);

  return null;
}

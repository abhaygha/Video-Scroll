import { Suspense } from "react";
import { ConnectionsClient } from "./ConnectionsClient";

export default function ConnectionsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-2xl px-4 py-10 text-sm text-zinc-500">
          Loading…
        </main>
      }
    >
      <ConnectionsClient />
    </Suspense>
  );
}

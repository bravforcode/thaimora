import { Explorer } from "@/components/explorer";
import { Suspense } from "react";
import { snapshots } from "@/lib/snapshot";
export const metadata = {
  alternates: { canonical: "/", languages: { en: "/", th: "/th/" } },
};
export default function Home() {
  return (
    <Suspense
      fallback={
        <main id="main" className="map-loading">
          Loading property explorer…
        </main>
      }
    >
      <Explorer initialProperties={snapshots()} />
    </Suspense>
  );
}

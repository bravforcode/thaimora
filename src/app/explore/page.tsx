import { Explorer } from "@/components/explorer";
import { Suspense } from "react";
import { snapshots } from "@/lib/snapshot";
export const metadata = {
  alternates: { canonical: "/explore/", languages: { en: "/explore/", th: "/th/explore/" } },
};
export default function Home() {
  return (
    <Suspense
      fallback={
        <main id="main" className="map-loading">
          Loading property search…
        </main>
      }
    >
      <Explorer initialProperties={snapshots()} />
    </Suspense>
  );
}

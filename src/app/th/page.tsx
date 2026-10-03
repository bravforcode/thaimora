import { Explorer } from "@/components/explorer";
import { Suspense } from "react";
import { snapshots } from "@/lib/snapshot";
export const metadata = {
  title: "ค้นหาที่ที่ใช่ในประเทศไทย",
  description: "ค้นหาบ้านและอสังหาริมทรัพย์ในภูเก็ตจากแผนที่",
  alternates: { canonical: "/th/", languages: { en: "/", th: "/th/" } },
};
export default function Page() {
  return (
    <Suspense
      fallback={
        <main id="main" className="map-loading" lang="th">
          กำลังโหลดแผนที่…
        </main>
      }
    >
      <Explorer initialProperties={snapshots()} />
    </Suspense>
  );
}

import { PhuketDashboard } from "@/components/phuket-dashboard";
import { homeListings } from "@/lib/snapshot";

export const metadata = {
  title: "แดชบอร์ดเจ้าของและนายหน้า",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <PhuketDashboard listings={homeListings()} />;
}

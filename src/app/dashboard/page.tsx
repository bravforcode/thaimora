import { PhuketDashboard } from "@/components/phuket-dashboard";
import { homeListings } from "@/lib/snapshot";

export const metadata = {
  title: "Owner and agent dashboard",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <PhuketDashboard listings={homeListings()} />;
}

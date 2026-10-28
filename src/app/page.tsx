import { PhuketHome } from "@/components/phuket-home";
import { homeListings } from "@/lib/snapshot";

export const metadata = {
  alternates: { canonical: "/", languages: { en: "/", th: "/th/" } },
};

export default function Home() {
  return <PhuketHome listings={homeListings()} />;
}

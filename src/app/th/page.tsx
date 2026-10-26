import { PhuketHome } from "@/components/phuket-home";
import { homeListings } from "@/lib/snapshot";

export const metadata = {
  title: "หาที่ใช่ในภูเก็ต",
  description: "ค้นหาบ้านและอสังหาริมทรัพย์ในภูเก็ตจากแผนที่ตามพื้นที่",
  alternates: { canonical: "/th/", languages: { en: "/", th: "/th/" } },
};

export default function Page() {
  return <PhuketHome listings={homeListings()} />;
}

import { Admin } from "@/components/admin";
import { snapshots } from "@/lib/snapshot";
export const metadata = {
  title: "การจัดการอสังหาริมทรัพย์",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Admin
      initialProperties={
        process.env.NEXT_PUBLIC_DATA_MODE === "live" ? [] : snapshots()
      }
    />
  );
}

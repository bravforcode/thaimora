import { Admin } from "@/components/admin";
import { snapshots } from "@/lib/snapshot";
export const metadata = {
  title: "Staff property desk",
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

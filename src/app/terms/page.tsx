import { ContentPage } from "@/components/content-page";
import { approvedLegal } from "@/lib/legal";
export const metadata = {
  title: "Terms & property disclaimer",
  alternates: {
    canonical: "/terms/",
    languages: { en: "/terms/", th: "/th/terms/" },
  },
};
export default function Page() {
  return <ContentPage kind="terms" approvedCopy={approvedLegal("terms")} />;
}

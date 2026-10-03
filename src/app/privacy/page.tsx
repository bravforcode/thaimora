import { ContentPage } from "@/components/content-page";
import { approvedLegal } from "@/lib/legal";
export const metadata = {
  title: "Privacy",
  alternates: {
    canonical: "/privacy/",
    languages: { en: "/privacy/", th: "/th/privacy/" },
  },
};
export default function Page() {
  return <ContentPage kind="privacy" approvedCopy={approvedLegal("privacy")} />;
}

import { ContentPage } from "@/components/content-page";
export const metadata = {
  title: "เครดิตภาพ",
  alternates: {
    canonical: "/th/credits/",
    languages: { en: "/credits/", th: "/th/credits/" },
  },
};
export default function Page() {
  return <ContentPage kind="credits" />;
}

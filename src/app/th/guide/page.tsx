import { ContentPage } from "@/components/content-page";
export const metadata = {
  title: "สำรวจภูเก็ต",
  alternates: {
    canonical: "/th/guide/",
    languages: { en: "/guide/", th: "/th/guide/" },
  },
};
export default function Page() {
  return <ContentPage kind="guide" />;
}

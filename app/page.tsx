import BrowsePage from "@/components/BrowsePage";

const PAGE_TITLE =
  "CruxMath: AMC and AIME Problems with Hint Based Solutions and Progress Tracking";
const PAGE_DESCRIPTION =
  "Practice AMC and AIME problems with hint-based solutions, then track your progress by topic and difficulty.";

export const metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  openGraph: { title: PAGE_TITLE, description: PAGE_DESCRIPTION },
  twitter: { title: PAGE_TITLE, description: PAGE_DESCRIPTION },
};

// Facet lists change only when content is reseeded.
export const revalidate = 3600;

export default function Home() {
  return <BrowsePage />;
}

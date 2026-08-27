import type { Metadata } from "next";
import BrowsePage from "@/components/BrowsePage";

export const metadata: Metadata = {
  title: "AIME Practice Problems with Hints",
  description:
    "Practice AIME problems with progressive hints that help you find the key idea without giving away the solution.",
  alternates: { canonical: "/aime" },
  openGraph: {
    title: "AIME Practice Problems with Hints",
    description:
      "Practice AIME problems with progressive hints that help you find the key idea without giving away the solution.",
    url: "/aime",
  },
  twitter: {
    title: "AIME Practice Problems with Hints",
    description:
      "Practice AIME problems with progressive hints that help you find the key idea without giving away the solution.",
  },
};

export default function AimePage() {
  return (
    <BrowsePage
      initialType="AIME"
      title="AIME Practice Problems with Hints"
      description="Practice AIME problems by year, topic, and difficulty. Reveal only the next useful idea when you need it."
    />
  );
}

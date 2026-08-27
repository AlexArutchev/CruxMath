import type { Metadata } from "next";
import BrowsePage from "@/components/BrowsePage";

export const metadata: Metadata = {
  title: "AMC 12 Practice Problems with Hints",
  description:
    "Practice AMC 12 problems with progressive hints that help you find the key idea without giving away the solution.",
  alternates: { canonical: "/amc-12" },
  openGraph: {
    title: "AMC 12 Practice Problems with Hints",
    description:
      "Practice AMC 12 problems with progressive hints that help you find the key idea without giving away the solution.",
    url: "/amc-12",
  },
  twitter: {
    title: "AMC 12 Practice Problems with Hints",
    description:
      "Practice AMC 12 problems with progressive hints that help you find the key idea without giving away the solution.",
  },
};

export default function Amc12Page() {
  return (
    <BrowsePage
      initialType="AMC 12"
      title="AMC 12 Practice Problems with Hints"
      description="Practice AMC 12 problems by year, topic, and difficulty. Reveal only the next useful idea when you need it."
    />
  );
}

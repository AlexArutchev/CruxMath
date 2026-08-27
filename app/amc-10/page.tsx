import type { Metadata } from "next";
import BrowsePage from "@/components/BrowsePage";

export const metadata: Metadata = {
  title: "AMC 10 Practice Problems with Hints",
  description:
    "Practice AMC 10 problems with progressive hints that help you find the key idea without giving away the solution.",
  alternates: { canonical: "/amc-10" },
  openGraph: {
    title: "AMC 10 Practice Problems with Hints",
    description:
      "Practice AMC 10 problems with progressive hints that help you find the key idea without giving away the solution.",
    url: "/amc-10",
  },
  twitter: {
    title: "AMC 10 Practice Problems with Hints",
    description:
      "Practice AMC 10 problems with progressive hints that help you find the key idea without giving away the solution.",
  },
};

export default function Amc10Page() {
  return (
    <BrowsePage
      initialType="AMC 10"
      title="AMC 10 Practice Problems with Hints"
      description="Practice AMC 10 problems by year, topic, and difficulty. Reveal only the next useful idea when you need it."
    />
  );
}

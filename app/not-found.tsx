import Link from "next/link";
import Header from "@/components/Header";

export default function NotFound() {
  return (
    <>
      <Header active="library" />
      <div className="col">
        <p className="stmt">That problem is not in the corpus.</p>
        <p className="lfoot">
          <Link href="/">Back to the library</Link>
        </p>
      </div>
    </>
  );
}

import Header from "@/components/Header";
import ProgressSkeleton from "@/components/ProgressSkeleton";

/**
 * Painted the instant PROGRESS is clicked, while the server fetches archive
 * totals. Without this the browser sits on the previous page for the whole
 * round trip.
 */
export default function Loading() {
  return (
    <>
      <Header active="progress" />
      <ProgressSkeleton />
    </>
  );
}

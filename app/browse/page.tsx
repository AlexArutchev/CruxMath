import { redirect } from "next/navigation";

// Preserve existing shared links while concentrating indexing signals on `/`.
export default function BrowseRedirect() {
  redirect("/");
}

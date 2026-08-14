import { redirect } from "next/navigation";

// Tracker is the core of the app — send the root there.
export default function Home() {
  redirect("/tracker");
}

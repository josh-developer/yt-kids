import type { Metadata } from "next";
import { KidsTubeApp } from "./kids-tube-app";

export const metadata: Metadata = {
  title: "KidTube",
  description:
    "A parent-curated YouTube-style video room for kids.",
};

export default function Home() {
  return <KidsTubeApp />;
}

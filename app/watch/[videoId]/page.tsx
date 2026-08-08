import type { Metadata } from "next";
import { KidsTubeApp } from "../../kids-tube-app";

export const metadata: Metadata = {
  title: "Watch | KidTube",
  description: "Watch a parent-approved KidTube video.",
};

export default async function WatchPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  return <KidsTubeApp initialRoute={{ view: "watch", videoId }} />;
}

import type { Metadata } from "next";
import { KidsTubeApp } from "../kids-tube-app";

export const metadata: Metadata = {
  title: "Parent settings | KidTube",
  description: "Manage the parent-approved KidTube video library.",
};

export default function SettingsPage() {
  return <KidsTubeApp initialRoute={{ view: "settings" }} />;
}

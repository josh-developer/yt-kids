import type { LibraryController } from "@/entities/library";
import { SettingsPanel } from "@/widgets/settings-panel";

export function SettingsPage({
  libraryController,
}: {
  libraryController: LibraryController;
}) {
  return <SettingsPanel libraryController={libraryController} />;
}

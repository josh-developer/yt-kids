import { registerRootComponent } from "expo";
import App from "./App";

// `registerRootComponent` is `AppRegistry.registerComponent` plus the bits Expo
// needs to attach in a dev client, so it is the entry point either way.
registerRootComponent(App);

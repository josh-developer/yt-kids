import createMiddleware from "next-intl/middleware";
import { routing } from "./routing";

export const internationalizationMiddleware = createMiddleware(routing);

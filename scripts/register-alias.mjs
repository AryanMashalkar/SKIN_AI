// Registers the "@/..." alias resolver for test runs.
import { register } from "node:module";
register("./alias-hooks.mjs", import.meta.url);

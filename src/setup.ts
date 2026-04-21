#!/usr/bin/env node
import { runSetup } from "./auth.js";

runSetup().catch((e) => {
  console.error(e);
  process.exit(1);
});

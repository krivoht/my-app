import { defineConfig } from "vite";

// Relativní cesty, aby aplikace fungovala na https://<uživatel>.github.io/<repozitář>/
export default defineConfig({
  base: "./",
});

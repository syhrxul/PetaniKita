import { defineConfig } from "prisma/config";

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? "mysql://root:arul@100.107.202.80:3306/harvestos",
  },
});

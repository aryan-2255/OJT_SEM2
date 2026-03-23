const env = require("./config/env");
const prisma = require("./lib/prisma");
const app = require("./app");

const server = app.listen(env.port, () => {
  console.log(`Backend running on http://localhost:${env.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down server...`);

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

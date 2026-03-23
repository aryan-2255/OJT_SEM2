const bcrypt = require("bcryptjs");
const { PrismaClient, Role } = require("@prisma/client");

require("dotenv").config();

const prisma = new PrismaClient();

async function main() {
  const name = process.env.ADMIN_NAME || "System Admin";
  const email = process.env.ADMIN_EMAIL || "admin@hospital.com";
  const password = process.env.ADMIN_PASSWORD || "Admin@123";

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password: hashedPassword,
      role: Role.ADMIN,
    },
    create: {
      name,
      email,
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  console.log(`Admin user ready: ${email}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


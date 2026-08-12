import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const adapter = new PrismaMariaDb({
  host: '100.107.202.80',
  port: 3306,
  user: 'root',
  password: 'arul',
  database: 'harvestos',
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const result = await prisma.$queryRaw`SHOW TABLES`;
  console.log('Tables:', result);
  
  const count = await prisma.$queryRaw`SELECT COUNT(*) as count FROM users`;
  console.log('User count:', count);
  
  const users = await prisma.$queryRaw`SELECT id, name, phone_number FROM users LIMIT 5`;
  console.log('Users:', users);
  
  await prisma.$disconnect();
}
main();

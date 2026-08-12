import { prisma } from "../lib/prisma";
import { getDistanceKm, findFarmersNearUmkm } from "../lib/spatial";

async function main() {
  console.log("=== PetaniKita DB Connection Test ===\n");

  // 1. Test koneksi
  await prisma.$connect();
  console.log("[1] Koneksi MariaDB: OK");

  // 2. Seed dummy data (idempotent)
  await prisma.user.deleteMany({
    where: { phone_number: { in: ["081111111111", "082222222222"] } },
  });

  const petani = await prisma.user.create({
    data: {
      username: "pakbudi" + Date.now(),
      name: "Pak Budi (Sleman)",
      phone_number: "081111111111",
      role: "PETANI",
      latitude: -7.7558,   // Sleman
      longitude: 110.4052,
    },
  });

  const umkm = await prisma.user.create({
    data: {
      username: "busari" + Date.now(),
      name: "Bu Sari (Kota Jogja)",
      phone_number: "082222222222",
      role: "UMKM",
      latitude: -7.8014,   // Yogyakarta Kota
      longitude: 110.3644,
    },
  });

  console.log("[2] Seed data:");
  console.log(`    Petani → id=${petani.id}, (${petani.latitude}, ${petani.longitude})`);
  console.log(`    UMKM   → id=${umkm.id}, (${umkm.latitude}, ${umkm.longitude})`);

  // 3. ST_Distance_Sphere
  const distKm = await getDistanceKm(
    prisma,
    petani.latitude ?? -7.7558, petani.longitude ?? 110.4052,
    umkm.latitude ?? -7.7558,   umkm.longitude ?? 110.4052
  );

  console.log(`\n[3] ST_Distance_Sphere (Sleman → Kota Jogja): ${Number(distKm).toFixed(3)} km`);

  if (Number(distKm) > 50) {
    throw new Error(`Jarak tidak masuk akal: ${distKm} km — periksa koordinat!`);
  }

  // 4. Radius query <= 25km
  const nearby = await findFarmersNearUmkm(prisma, umkm.latitude ?? -7.7558, umkm.longitude ?? 110.4052, 25);

  console.log(`[4] Petani dalam radius 25km: ${nearby.length} ditemukan`);
  nearby.forEach((f) =>
    console.log(`    - ${f.name}: ${Number(f.distance_km).toFixed(3)} km`)
  );

  // 5. Cleanup
  await prisma.user.deleteMany({
    where: { phone_number: { in: ["081111111111", "082222222222"] } },
  });
  console.log("\n[5] Cleanup dummy data: OK");

  console.log("\n✓ MariaDB Spatial Connection Successful!");
}

main()
  .catch((e) => {
    console.error("\n[FAILED]", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

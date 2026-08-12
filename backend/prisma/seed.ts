import { prisma } from "../src/lib/prisma.js";

async function main() {
  console.log("=== Seeding MariaDB PetaniKita Data ===");

  // 1. Clear existing seed data
  await prisma.priceHistory.deleteMany({});
  await prisma.harvestEvent.deleteMany({});
  await prisma.farmCrop.deleteMany({});
  await prisma.umkmOrder.deleteMany({});
  await prisma.user.deleteMany({
    where: { phone_number: { in: ["081234567891", "081234567892", "081234567893", "081234567894"] } },
  });

  // 2. Seed Users
  const petani = await prisma.user.create({
    data: {
      name: "Pak Budi",
      phone_number: "081234567891",
      role: "PETANI",
      latitude: -7.7558,
      longitude: 110.4052,
    },
  });

  const umkm = await prisma.user.create({
    data: {
      name: "Warung Makan Bu Ambo",
      phone_number: "081234567892",
      role: "UMKM",
      latitude: -7.8014,
      longitude: 110.3644,
    },
  });

  const tengkulak = await prisma.user.create({
    data: {
      name: "Mas Joko (Kolektor)",
      phone_number: "081234567893",
      role: "TENGKULAK",
      latitude: -7.7812,
      longitude: 110.3789,
    },
  });

  const superadmin = await prisma.user.create({
    data: {
      name: "Admin Pemda DIY",
      phone_number: "081234567894",
      role: "SUPERADMIN",
      latitude: -7.7956,
      longitude: 110.3695,
    },
  });

  console.log("✓ Users seeded: Petani, UMKM, Tengkulak, Superadmin");

  // 3. Seed FarmCrops & HarvestEvents
  const crop1 = await prisma.farmCrop.create({
    data: {
      user_id: petani.id,
      crop_type: "Cabai Rawit Merah",
      area_size_m2: 500,
      latitude: -7.7558,
      longitude: 110.4052,
    },
  });

  const crop2 = await prisma.farmCrop.create({
    data: {
      user_id: petani.id,
      crop_type: "Bawang Merah",
      area_size_m2: 800,
      latitude: -7.7560,
      longitude: 110.4060,
    },
  });

  await prisma.harvestEvent.createMany({
    data: [
      { crop_id: crop1.id, est_harvest_date: new Date("2026-08-10"), est_yield_kg: 150, status: "AVAILABLE" },
      { crop_id: crop2.id, est_harvest_date: new Date("2026-08-15"), est_yield_kg: 200, status: "LOCKED_ESCROW" },
      { crop_id: crop1.id, est_harvest_date: new Date("2026-08-20"), est_yield_kg: 100, status: "SOLD" },
    ],
  });

  console.log("✓ FarmCrops & HarvestEvents seeded");

  // 4. Seed PriceHistory
  await prisma.priceHistory.createMany({
    data: [
      { commodity: "Cabai Rawit Merah", farmer_price: 28000, umkm_price: 34000, hap_price: 32000, trend: "UP" },
      { commodity: "Bawang Merah", farmer_price: 24000, umkm_price: 38000, hap_price: 30000, trend: "DOWN" },
      { commodity: "Tomat Segar", farmer_price: 12000, umkm_price: 16000, hap_price: 15000, trend: "STABLE" },
      { commodity: "Cabai Merah Keriting", farmer_price: 30000, umkm_price: 36000, hap_price: 35000, trend: "UP" },
      { commodity: "Bawang Putih", farmer_price: 35000, umkm_price: 42000, hap_price: 40000, trend: "STABLE" },
    ],
  });

  console.log("✓ PriceHistory seeded (5 commodities)");

  // 5. Seed UmkmOrders
  await prisma.umkmOrder.createMany({
    data: [
      { umkm_user_id: umkm.id, total_amount: 420000, status: "COMPLETED" },
      { umkm_user_id: umkm.id, total_amount: 440000, status: "IN_TRANSIT" },
      { umkm_user_id: umkm.id, total_amount: 96000, status: "PENDING_DP" },
    ],
  });

  console.log("✓ UmkmOrders seeded");
  console.log("\n=== SEED COMPLETED SUCCESSFULLY ===");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

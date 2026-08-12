import { PrismaClient } from "@prisma/client";

/**
 * Hitung jarak antara dua titik koordinat menggunakan ST_Distance_Sphere MariaDB.
 * Return: jarak dalam kilometer.
 * Note: POINT(lon, lat) — MariaDB pakai X=longitude, Y=latitude
 */
export async function getDistanceKm(
  prisma: PrismaClient,
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): Promise<number> {
  const result = await prisma.$queryRawUnsafe<{ distance_km: number }[]>(
    `SELECT ST_Distance_Sphere(
       POINT(?, ?),
       POINT(?, ?)
     ) / 1000 AS distance_km`,
    lon1, lat1, lon2, lat2
  );
  return result[0].distance_km;
}

/**
 * Cari semua Petani dalam radius <= maxKm dari titik UMKM.
 */
export async function findFarmersNearUmkm(
  prisma: PrismaClient,
  umkmLat: number,
  umkmLon: number,
  maxKm = 25
): Promise<{ id: number; name: string; distance_km: number }[]> {
  return prisma.$queryRawUnsafe<{ id: number; name: string; distance_km: number }[]>(
    `SELECT
       u.id,
       u.name,
       ST_Distance_Sphere(POINT(u.longitude, u.latitude), POINT(?, ?)) / 1000 AS distance_km
     FROM users u
     WHERE u.role = 'PETANI'
       AND ST_Distance_Sphere(POINT(u.longitude, u.latitude), POINT(?, ?)) / 1000 <= ?
     ORDER BY distance_km ASC`,
    umkmLon, umkmLat,
    umkmLon, umkmLat,
    maxKm
  );
}

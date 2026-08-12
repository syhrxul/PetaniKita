/**
 * Reverse Geocoding Utility di Backend
 * Mengubah koordinat (Lat, Lng) menjadi Nama Kabupaten/Kota via OpenStreetMap Nominatim API
 */
export async function resolveRegionName(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      {
        headers: { "User-Agent": "PetaniKita-Backend/1.0" },
      }
    );
    if (!response.ok) return "Kabupaten Sleman";
    const data: any = await response.json();
    const addr = data.address || {};
    const region =
      addr.city ||
      addr.regency ||
      addr.county ||
      addr.state_district ||
      addr.town ||
      "Kabupaten Sleman";
    return region;
  } catch (error) {
    console.error("Gagal reverse geocode di backend:", error);
    return "Kabupaten Sleman";
  }
}

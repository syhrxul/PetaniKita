export async function getRegionFromCoordinates(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { "User-Agent": "PetaniKita Agritech App" } }
    );
    if (!res.ok) return "Kabupaten Sleman";
    const data = await res.json();
    const address = data.address ?? {};
    const region =
      address.city ||
      address.regency ||
      address.county ||
      address.state_district ||
      address.town ||
      "Kabupaten Sleman";
    return region;
  } catch (error) {
    console.error("Gagal reverse geocoding:", error);
    return "Kabupaten Sleman";
  }
}

"use client";

import React, { useState, useEffect } from "react";
import { MapPin, Navigation, Search, CheckCircle2, Loader2 } from "lucide-react";

interface GeolocationInputProps {
  initialLatitude?: number | string;
  initialLongitude?: number | string;
  initialRegionName?: string;
  onChange: (data: { latitude: number; longitude: number; regionName: string }) => void;
}

export default function GeolocationInput({
  initialLatitude = "",
  initialLongitude = "",
  initialRegionName = "",
  onChange,
}: GeolocationInputProps) {
  const [lat, setLat] = useState<string>(String(initialLatitude));
  const [lng, setLng] = useState<string>(String(initialLongitude));
  const [regionName, setRegionName] = useState<string>(initialRegionName);
  const [fullAddress, setFullAddress] = useState<string>("");
  const [loadingGeo, setLoadingGeo] = useState<boolean>(false);
  const [loadingAddress, setLoadingAddress] = useState<boolean>(false);

  useEffect(() => {
    if (initialLatitude !== undefined && initialLatitude !== null) setLat(String(initialLatitude));
    if (initialLongitude !== undefined && initialLongitude !== null) setLng(String(initialLongitude));
    if (initialRegionName) setRegionName(initialRegionName);
  }, [initialLatitude, initialLongitude, initialRegionName]);

  // Reverse Geocoding via OpenStreetMap
  const resolveCoordinates = async (latitudeNum: number, longitudeNum: number) => {
    setLoadingAddress(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitudeNum}&lon=${longitudeNum}&zoom=18&addressdetails=1`,
        { headers: { "User-Agent": "PetaniKita-Agritech/1.0" } }
      );
      const data = await response.json();

      if (data && data.address) {
        const addr = data.address;

        // Dapatkan Alamat Lengkap untuk Preview Visual User
        const displayAddress = data.display_name || "Alamat tidak ditemukan";
        setFullAddress(displayAddress);

        // Ekstrak HANYA Nama Kabupaten / Kota / Region
        const extractedRegion =
          addr.city ||
          addr.regency ||
          addr.county ||
          addr.state_district ||
          addr.town ||
          "Kabupaten Sleman";

        setRegionName(extractedRegion);

        // Kembalikan data ke Form Induk (Hanya regionName, lat, long yang diteruskan)
        onChange({
          latitude: latitudeNum,
          longitude: longitudeNum,
          regionName: extractedRegion,
        });
      }
    } catch (err) {
      console.error("Gagal reverse geocoding:", err);
      setFullAddress("Gagal memuat preview alamat. Periksa koneksi internet.");
    } finally {
      setLoadingAddress(false);
    }
  };

  // Handler Auto-Detect Browser Geolocation
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Browser Anda tidak mendukung Geolocation.");
      return;
    }

    setLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitudeNum = position.coords.latitude;
        const longitudeNum = position.coords.longitude;
        setLat(String(latitudeNum));
        setLng(String(longitudeNum));
        setLoadingGeo(false);
        resolveCoordinates(latitudeNum, longitudeNum);
      },
      () => {
        setLoadingGeo(false);
        alert("Gagal mengambil lokasi GPS. Silakan masukkan koordinat secara manual.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Handler Cek Alamat Manual
  const handleCheckAddress = () => {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      alert("Masukkan Latitude dan Longitude yang valid!");
      return;
    }

    resolveCoordinates(parsedLat, parsedLng);
  };

  return (
    <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
      <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
        <MapPin className="w-4 h-4 text-emerald-600" />
        <span>Lokasi Geospasial &amp; Wilayah</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            Latitude
          </label>
          <input
            type="text"
            value={lat}
            onChange={(e) => {
              setLat(e.target.value);
              setFullAddress(""); // Reset preview jika angka diubah manual
            }}
            placeholder="Contoh: -7.389103"
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            Longitude
          </label>
          <input
            type="text"
            value={lng}
            onChange={(e) => {
              setLng(e.target.value);
              setFullAddress(""); // Reset preview jika angka diubah manual
            }}
            placeholder="Contoh: 109.361091"
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          disabled={loadingGeo}
          className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-emerald-50 text-emerald-700 font-semibold text-xs py-3 px-4 rounded-xl border border-emerald-300 transition shadow-xs disabled:opacity-50 min-h-[44px]"
        >
          {loadingGeo ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Navigation className="w-4 h-4 shrink-0" />}
          <span>Dapatkan Lokasi Saat Ini</span>
        </button>

        <button
          type="button"
          onClick={handleCheckAddress}
          disabled={loadingAddress || !lat || !lng}
          className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-3 px-4 rounded-xl transition shadow-xs disabled:opacity-50 min-h-[44px]"
        >
          {loadingAddress ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Search className="w-4 h-4 shrink-0" />}
          <span>Cek &amp; Preview Alamat</span>
        </button>
      </div>

      {(fullAddress || regionName) && (
        <div className="mt-3 p-4 bg-white rounded-xl border border-emerald-200 shadow-xs space-y-2">
          {fullAddress && (
            <div className="flex items-start gap-2 text-xs text-slate-700">
              <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 block mb-0.5">Alamat Terdeteksi:</span>
                <span className="text-slate-600 leading-relaxed">{fullAddress}</span>
              </div>
            </div>
          )}

          {regionName && (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200/80">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Wilayah Terdaftar:{regionName}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

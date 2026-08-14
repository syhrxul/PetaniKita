"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSession, clearSession, getCurrentUser, UserRole } from "@/lib/api";
import { Sprout, ShoppingBag, TrendingUp, Handshake } from "lucide-react";
import ResponsiveSidebar from "@/components/ResponsiveSidebar";

const NAV: Record<UserRole, { label: string; href: string; icon: any }[]> = {
  PETANI:     [
    { label: "Input & Stok Panen", href: "/farmer/input", icon: Sprout },
    { label: "Pesanan Masuk", href: "/farmer/orders", icon: ShoppingBag },
    { label: "Penawaran & Nego", href: "/farmer/negotiations", icon: Handshake },
    { label: "Harga Pasar", href: "/farmer/prices", icon: TrendingUp },
  ],
  UMKM:       [],
  SUPERADMIN: [],
};

export default function FarmerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [name, setName] = useState("");
  const [region, setRegion] = useState("Kabupaten Sleman");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) { router.replace("/auth/login"); return; }
    if (session.role !== "PETANI") { router.replace("/dashboard/superadmin"); return; }

    setName(session.username);

    getCurrentUser()
      .then(u => {
        if (u.username) setName(u.username);
        if (u.regionName) setRegion(u.regionName);
      })
      .catch(() => {})
      .finally(() => setMounted(true));
  }, [router]);

  if (!mounted) return null;

  function logout() {
    clearSession();
    router.replace("/auth/login");
  }

  const navItems = NAV.PETANI;

  return (
    <div className="min-h-screen bg-slate-50">
      <ResponsiveSidebar
        items={navItems}
        roleLabel="Petani"
        userName={name}
        userSubtitle={region}
        onLogout={logout}
      />

      {/* Konten: diberi offset kiri di desktop & offset atas di mobile */}
      <main className="md:pl-64 pt-16 md:pt-0">
        <div className="p-4 sm:p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}

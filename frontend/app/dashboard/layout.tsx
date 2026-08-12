"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSession, clearSession, UserRole } from "@/lib/api";
import { LayoutDashboard, ShoppingBag, Receipt, Wallet, Store, Activity, AlertTriangle, Database, HandCoins, ShieldCheck } from "lucide-react";
import ResponsiveSidebar from "@/components/ResponsiveSidebar";

const NAV: Record<UserRole, { label: string; href: string; icon: any }[]> = {
  PETANI:     [{ label: "Dashboard", href: "/farmer/input", icon: LayoutDashboard }],
  UMKM:       [
    { label: "Restock & Matching", href: "/dashboard/procurement", icon: ShoppingBag },
    { label: "Riwayat Transaksi", href: "/dashboard/procurement/history", icon: Receipt },
    { label: "Pembukuan Kas", href: "/dashboard/procurement/ledger", icon: Wallet },
    { label: "Profil Usaha", href: "/dashboard/procurement/profile", icon: Store },
  ],
  SUPERADMIN: [
    { label: "Panel Superadmin", href: "/superadmin/dashboard?tab=USERS", icon: ShieldCheck },
    { label: "Command Center", href: "/dashboard/superadmin", icon: Activity },
    { label: "Aspirasi Petani", href: "/dashboard/superadmin/proposals", icon: HandCoins },
    { label: "Alert & Intervensi", href: "/dashboard/superadmin/alerts", icon: AlertTriangle },
    { label: "Data Master Regional", href: "/dashboard/superadmin/data", icon: Database },
  ],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<UserRole>("UMKM");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) { router.replace("/auth/login"); return; }
    setUsername(session.username);
    setRole(session.role);
    setMounted(true);
  }, [router]);

  if (!mounted) return null;

  function logout() {
    clearSession();
    router.replace("/auth/login");
  }

  const navItems = NAV[role] ?? [];
  const badgeStyle = role === "UMKM" ? "bg-teal-500/10 text-teal-400 border-teal-500/20"
    : "bg-purple-500/10 text-purple-400 border-purple-500/20";

  return (
    <div className="min-h-screen bg-slate-50">
      <ResponsiveSidebar
        items={navItems}
        roleLabel={role}
        badgeLabel={role === "UMKM" ? "UMKM / RESTO" : "SUPERADMIN"}
        userName={username}
        userSubtitle={role === "UMKM" ? "Mitra Terverifikasi" : "Administrator"}
        onLogout={logout}
        theme="slate"
      />

      <main className="md:pl-64 pt-16 md:pt-0">
        <div className="p-4 sm:p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}

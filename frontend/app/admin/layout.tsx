"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, clearSession, roleRedirect, UserRole } from "@/lib/api";
import { ShieldAlert, Activity, Users, TrendingUp, MapPin, Megaphone } from "lucide-react";
import ResponsiveSidebar from "@/components/ResponsiveSidebar";

const NAV = [
  { label: "Audit Log Aktivitas", href: "/admin?tab=logs", icon: Activity },
  { label: "Manajemen User", href: "/admin?tab=users", icon: Users },
  { label: "Kontrol Harga Regional", href: "/admin?tab=prices", icon: TrendingUp },
  { label: "Radar Geospasial", href: "/admin?tab=radar", icon: MapPin },
  { label: "WA Broadcast Engine", href: "/admin?tab=broadcast", icon: Megaphone },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"CHECKING" | "DENIED" | "ALLOWED">("CHECKING");
  const [username, setUsername] = useState("");

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/auth/login");
      return;
    }
    if (session.role !== "SUPERADMIN") {
      setState("DENIED");
      const target = roleRedirect(session.role as UserRole) || "/auth/login";
      const t = setTimeout(() => router.replace(target), 2200);
      return () => clearTimeout(t);
    }
    setUsername(session.username);
    setState("ALLOWED");
  }, [router]);

  function logout() {
    clearSession();
    router.replace("/auth/login");
  }

  if (state === "CHECKING") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-sm font-medium">Memverifikasi kredensial Superadmin…</p>
        </div>
      </div>
    );
  }

  if (state === "DENIED") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-rose-600" strokeWidth={2} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Akses Ditolak (403)</h1>
          <p className="text-sm text-slate-600">
            Panel ini khusus untuk akun dengan peran{" "}
            <span className="font-bold text-rose-600">SUPERADMIN</span>. Anda akan dialihkan kembali ke
            dashboard Anda.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <ResponsiveSidebar
        items={NAV}
        roleLabel="Superadmin"
        badgeLabel="SUPERADMIN"
        userName={username}
        userSubtitle="Administrator Sistem"
        onLogout={logout}
      />

      <main className="md:pl-64 pt-16 md:pt-0">
        <div className="p-4 sm:p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}

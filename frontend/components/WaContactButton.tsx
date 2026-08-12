import React from "react";
import { MessageCircle } from "lucide-react";

interface Props {
  phone: string;
  name: string;
  label?: string;
  message?: string;
}

export function sanitizeToWa62(phone: string): string {
  return (phone || "").replace(/\D/g, "").replace(/^0/, "62");
}

export default function WaContactButton({ phone, name, label, message }: Props) {
  const sanitizedPhone = sanitizeToWa62(phone);
  if (!sanitizedPhone) return null;

  const text =
    message || `Halo ${name}, saya dari PetaniKita ingin berkoordinasi mengenai transaksi panen.`;
  const waUrl = `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(text)}`;

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-2 rounded-xl transition shadow-sm"
    >
      <MessageCircle className="w-4 h-4" />
      <span>{label || `Hubungi ${name}`}</span>
    </a>
  );
}

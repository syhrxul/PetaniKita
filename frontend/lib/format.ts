export function formatRupiah(value: number | null | undefined): string {
  const n = Math.round(Number(value) || 0);
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export function formatCompactRupiah(value: number | null | undefined): string {
  const n = Number(value) || 0;
  const abs = Math.abs(n);

  if (abs >= 1e12)
    return `Rp ${(n / 1e12).toLocaleString("id-ID", { maximumFractionDigits: 1 })} T`;
  if (abs >= 1e9)
    return `Rp ${(n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  if (abs >= 1e6)
    return `Rp ${(n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} Jt`;
  if (abs >= 1e3)
    return `Rp ${Math.round(n / 1e3).toLocaleString("id-ID")} Rb`;
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

export function formatKg(value: number | null | undefined): string {
  return `${Math.round(Number(value) || 0).toLocaleString("id-ID")} Kg`;
}
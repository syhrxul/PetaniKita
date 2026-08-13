export type UserRole = "PETANI" | "UMKM" | "SUPERADMIN";

export type OrderStatus =
  | "PENDING_FARMER_CONFIRMATION"
  | "WAITING_FARMER_NEGO_APPROVAL"
  | "ACCEPTED"
  | "REJECTED"
  | "COMPLETED";

export type DeliveryMethod = "DIANTAR_PETANI" | "COD_AMBIL_SENDIRI";

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  token: string;
}

export interface PriceRecord {
  id: number;
  commodity: string;
  farmer_price: number;
  prev_price: number;
  umkm_price: number;
  hap_price: number;
  trend: "UP" | "DOWN" | "STABLE";
  diff?: number;
  diffPct?: number;
}

export interface PriceResponse {
  status: "MariaDB_Cache_12H" | "Live_AI_Fetch" | "Data_Terverifikasi_12H";
  regionName: string;
  updated_at: string;
  prices: PriceRecord[];
}

export interface HarvestRecord {
  id: number;
  crop: string;
  date: string;
  kg: number;
  status: "AVAILABLE" | "LOCKED_ESCROW" | "SOLD";
  pricePerKg?: number | null;
  uploadedAt?: string;
  harvestDate?: string;
  deliveryReadyDate?: string | null;
}

export interface OrderRecord {
  id: number;
  umkm_user_id: number;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
}

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || 
  "https://xc4v9xjv-4000.asse.devtunnels.ms"
).replace(/\/+$/, "");

const API_BASE = API_BASE_URL;

const SESSION_DURATION_DAYS = 7;
const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("harvest_token");
}

export function saveSession(user: AuthUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("harvest_token", user.token);
  localStorage.setItem("harvest_user", JSON.stringify(user));
  localStorage.setItem("harvest_session_time", String(Date.now()));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("harvest_token");
  localStorage.removeItem("harvest_user");
  localStorage.removeItem("harvest_session_time");
}

/**
 * Ambil session user. Return null jika tidak ada session atau sudah expired (7 hari).
 */
export function getSession(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("harvest_user");
  if (!raw) return null;

  // Cek expiry 7 hari
  const sessionTime = localStorage.getItem("harvest_session_time");
  if (sessionTime) {
    const elapsed = Date.now() - Number(sessionTime);
    if (elapsed > SESSION_DURATION_MS) {
      clearSession();
      return null;
    }
  }

  try { return JSON.parse(raw) as AuthUser; } catch { return null; }
}

/** Cek apakah user masih login (session valid, belum expired 7 hari). */
export function isLoggedIn(): boolean {
  return getSession() !== null;
}

export function roleRedirect(role: UserRole): string {
  const map: Record<UserRole, string> = {
    PETANI:      "/farmer/input",
    UMKM:        "/dashboard/procurement",
    SUPERADMIN:  "/superadmin/dashboard?tab=USERS",
  };
  return map[role];
}

async function fetcher<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const fullUrl = path.startsWith("http") ? path : `${API_BASE}/${path.replace(/^\/+/, "")}`;
  const res = await fetch(fullUrl, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    ...init,
  });
  if (!res.ok) {
    console.error(`❌ [API FETCH ERROR ${res.status}] Failed URL: ${fullUrl} | Status: ${res.status}`);
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err?.message ?? `Request failed with status ${res.status}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export async function registerDirect(payload: any): Promise<{ success: boolean; message: string; data?: any; errorType?: string }> {
  return fetcher("/api/v1/auth/register-direct", { method: "POST", body: JSON.stringify(payload) });
}

export async function requestOtp(payload: { phone: string }, signal?: AbortSignal): Promise<{ success: boolean; message: string; data?: { phone: string; otpCode?: string; expiresAt?: string; waToken?: string; waLink?: string; waSent?: boolean } }> {
  return fetcher("/api/v1/auth/request-otp", { method: "POST", body: JSON.stringify(payload), signal });
}

// Real-time username availability check
export async function checkUsername(username: string): Promise<{ available: boolean; suggestions: string[] }> {
  return fetcher(`/api/v1/auth/check-username?username=${encodeURIComponent(username)}`);
}

// Real-time phone availability check
export async function checkPhone(phone: string): Promise<{ available: boolean; registered: boolean }> {
  return fetcher(`/api/v1/auth/check-phone?phone=${encodeURIComponent(phone)}`);
}

export async function verifyOtp(payload: { phone: string; otpCode: string }): Promise<{ success: boolean; message: string }> {
  return fetcher("/api/v1/auth/verify-otp", { method: "POST", body: JSON.stringify(payload) });
}

export async function registerUser(payload: any): Promise<AuthUser> {
  // Gunakan endpoint OTP jika ada otpCode
  const endpoint = payload.otpCode ? "/api/v1/auth/register-otp" : "/api/auth/register";
  return fetcher<AuthUser>(endpoint, { method: "POST", body: JSON.stringify(payload) });
}

export async function loginUser(payload: unknown): Promise<AuthUser> {
  return fetcher<AuthUser>("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
}

export async function getCurrentUser(): Promise<AuthUser & { regionName?: string; latitude?: number; longitude?: number }> {
  return fetcher("/api/v1/auth/me");
}

export async function getLastFarmProfile(): Promise<{
  latitude: number | null;
  longitude: number | null;
  regionName: string | null;
  areaSizeM2: number | null;
  cropType: string | null;
}> {
  return fetcher("/api/v1/user/last-farm");
}

export async function getRegionalPrices(regionName?: string): Promise<PriceResponse> {
  const query = regionName ? `?region=${encodeURIComponent(regionName)}` : "";
  return fetcher<PriceResponse>(`/api/v1/prices/regional${query}`);
}

export async function proposePrice(payload: {
  user_id: number;
  regionName: string;
  commodity: string;
  proposed_price: number;
  reason?: string;
}): Promise<{ id: number; message: string }> {
  return fetcher("/api/v1/prices/propose", { method: "POST", body: JSON.stringify(payload) });
}

export async function getPriceProposals(): Promise<{
  summary?: {
    regionName: string;
    commodity: string;
    currentPrice: number;
    totalFarmers: number;
    avgProposedPrice: number;
    reasons: string[];
  };
  proposals: any[];
  aiAnalysis?: {
    recommendedPrice: number;
    rationale: string;
    impactLevel: "LOW" | "MEDIUM" | "HIGH";
  };
}> {
  return fetcher("/api/v1/prices/proposals");
}

export async function overridePrice(payload: {
  regionName: string;
  commodity: string;
  overridePrice: number;
  isCustomLocked: boolean;
  lockUntil?: string;
}): Promise<{ message: string }> {
  return fetcher("/api/v1/prices/override", { method: "POST", body: JSON.stringify(payload) });
}

// AI PRICE SCRAPING API
export async function scrapePriceAI(commodity: string, region: string): Promise<{
  success: boolean;
  message: string;
  data?: { commodity: string; regionName: string; farmerPrice: number; umkmPrice: number; hapPrice: number; trend: string; source: string };
}> {
  return fetcher(`/api/v1/prices/scrape?commodity=${encodeURIComponent(commodity)}&region=${encodeURIComponent(region)}`);
}

export async function scrapeBatchPrices(payload: { commodities: string[]; regionName: string }): Promise<{
  success: boolean;
  message: string;
  data?: Array<{ commodity: string; regionName: string; farmerPrice: number; umkmPrice: number; hapPrice: number; trend: string; source: string }>;
}> {
  return fetcher("/api/v1/prices/scrape-batch", { method: "POST", body: JSON.stringify(payload) });
}

export async function getMultiRegionPrices(commodity: string): Promise<{
  success: boolean;
  commodity: string;
  totalRegions: number;
  data: Array<{ regionName: string; farmerPrice: number; umkmPrice: number; hapPrice: number; trend: string; updatedAt: string }>;
}> {
  return fetcher(`/api/v1/prices/multi-region?commodity=${encodeURIComponent(commodity)}`);
}

export async function getPricesByRegion(regionName: string): Promise<{
  success: boolean;
  regionName: string;
  totalCommodities: number;
  data: Array<{ commodity: string; farmerPrice: number; umkmPrice: number; hapPrice: number; trend: string; updatedAt: string }>;
}> {
  return fetcher(`/api/v1/prices/region/${encodeURIComponent(regionName)}`);
}

export async function getUserHarvests(userId: number): Promise<HarvestRecord[]> {
  return fetcher<HarvestRecord[]>(`/api/v1/harvest/user/${userId}`);
}

export async function submitHarvest(data: unknown): Promise<{ id: number }> {
  return fetcher("/api/harvest", { method: "POST", body: JSON.stringify(data) });
}

export async function getProcurementDashboardStats(umkmId: number): Promise<{
  weeklyDemandKg: number;
  activeEscrowOrders: number;
  totalCostSavings: number;
  monthlyExpenses: number;
  totalKgThisWeek?: number;
  activeOrdersCount?: number;
  totalSaved?: number;
  totalSpentThisMonth?: number;
  aiStatus?: {
    isReady: boolean;
    daysActive: number;
    daysRemaining: number;
    totalTransactions: number;
  };
}> {
  const res = await fetcher<{ success: boolean; data: any }>(`/api/v1/procurement/dashboard-stats?umkmId=${umkmId}`);
  return res.data;
}

export async function getProcurementRecommendations(umkmId?: number): Promise<any[]> {
  const query = umkmId ? `?umkmId=${umkmId}` : "";
  const res = await fetcher<{ success: boolean; data: any[] }>(`/api/v1/procurement/recommendations${query}`);
  return res.data;
}

export async function getProcurementSuppliers(umkmId: number): Promise<any[]> {
  const res = await fetcher<{ success: boolean; data: any[] }>(`/api/v1/procurement/suppliers?umkmId=${umkmId}`);
  return res.data;
}

export async function getUmkmOrders(umkmId: number): Promise<OrderRecord[]> {
  return fetcher<OrderRecord[]>(`/api/v1/procurement/history?umkmId=${umkmId}`);
}

export async function getFarmerOrders(farmerId: number): Promise<any[]> {
  return fetcher<any[]>(`/api/v1/orders/farmer/${farmerId}`);
}

export async function markOrderReady(orderId: number): Promise<{ message: string }> {
  return fetcher(`/api/v1/orders/${orderId}/ready`, { method: "POST" });
}

export async function getUserProfile(): Promise<any> {
  return fetcher("/api/v1/user/profile");
}

export async function updateUserProfile(payload: any): Promise<{ message: string; user: any }> {
  return fetcher("/api/v1/user/profile", { method: "PUT", body: JSON.stringify(payload) });
}

export async function getProcurementLedger(userId: number): Promise<{
  totalAmountRp: number;
  totalAutoRp: number;
  totalManualRp: number;
  entries: any[];
}> {
  return fetcher(`/api/v1/procurement/ledger/${userId}`);
}

export async function addManualLedger(payload: any): Promise<{ message: string; entry: any }> {
  return fetcher("/api/v1/procurement/ledger", { method: "POST", body: JSON.stringify(payload) });
}

export interface P2POrderPayload {
  harvestEventId: number;
  quantityKg: number;
  umkmUserId: number;
  deliveryMethod: DeliveryMethod;
  proposedPricePerKg?: number;
  negoReason?: string;
}

export interface P2PQuote {
  commodity: string;
  farmerName: string;
  farmerPhone: string;
  availableKg: number;
  originalPricePerKg: number;
  pricePerKg: number;
  isNego: boolean;
  quantityKg: number;
  distanceKm: number;
  deliveryMethod: DeliveryMethod;
  deliveryFee: number;
  foodTotalPrice: number;
  grandTotal: number;
}

/** Estimasi transparan sebelum checkout (ongkir, jarak, total) */
export async function quoteProcurementOrder(
  payload: P2POrderPayload
): Promise<{ success: boolean; data: P2PQuote }> {
  return fetcher("/api/v1/procurement/quote", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Checkout Direct P2P — kirim ke Petani untuk konfirmasi / persetujuan nego */
export async function checkoutProcurementOrder(
  payload: P2POrderPayload
): Promise<{ success: boolean; message: string; data?: any }> {
  return fetcher("/api/v1/procurement/checkout", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Petani menyetujui / menolak pesanan lewat Web */
export async function farmerRespondToOrder(
  orderId: number,
  action: "ACCEPT" | "REJECT",
  rejectionReason?: string
): Promise<{ success: boolean; message: string; data?: any }> {
  return fetcher(`/api/v1/orders/${orderId}/farmer-respond`, {
    method: "PATCH",
    body: JSON.stringify({ action, rejectionReason }),
  });
}

export async function deleteManualLedger(entryId: number): Promise<{ message: string }> {
  return fetcher(`/api/v1/procurement/ledger/${entryId}`, { method: "DELETE" });
}

// ORDER EDIT API

export async function updateOrderUmkm(payload: {
  orderId: number;
  quantityKg?: number;
  paymentMethod?: string;
  isSelfPickup?: boolean;
}): Promise<{ success: boolean; message: string; data?: any }> {
  return fetcher(`/api/v1/orders/${payload.orderId}/umkm-update`, {
    method: "PATCH",
    body: JSON.stringify({ quantityKg: payload.quantityKg, paymentMethod: payload.paymentMethod, isSelfPickup: payload.isSelfPickup }),
  });
}

// NEGOTIATION API
export async function submitNegotiation(payload: {
  harvest_event_id: number;
  buyer_name: string;
  buyer_phone: string;
  commodity: string;
  quantity_kg: number;
  normal_price: number;
  proposed_price: number;
  reason?: string;
}): Promise<{ success: boolean; message: string; data?: any }> {
  return fetcher("/api/v1/public/negotiate", { method: "POST", body: JSON.stringify(payload) });
}

export type NegoSource = "UMKM_ORDER" | "PUBLIC_OFFER";

export interface FarmerNegotiation {
  id: string;
  source: NegoSource;
  rawId: number;
  isNego: boolean;
  status: OrderStatus;
  commodityName: string;
  quantityKg: number;
  pricePerKg: number;
  originalPricePerKg: number;
  negoReason: string | null;
  rejectionReason: string | null;
  buyerName: string;
  buyerPhone: string;
  buyerRegion: string | null;
  buyerWaUrl: string;
  deliveryMethod: string | null;
  deliveryFee: number | null;
  grandTotal: number;
  createdAt: string;
}

/** Semua penawaran masuk (Web UMKM + WA Bot + Marketplace publik) */
export async function getFarmerNegotiations(farmerId: number): Promise<{
  success: boolean;
  summary: { total: number; pending: number; negoCount: number };
  data: FarmerNegotiation[];
}> {
  return fetcher(`/api/v1/farmer/negotiations?farmerId=${farmerId}`);
}

/** Setujui / tolak penawaran (id berformat "ORDER-1" atau "OFFER-1") */
export async function decideNegotiation(
  id: string,
  action: "ACCEPT" | "REJECT",
  rejectionReason?: string
): Promise<{ success: boolean; message: string; data?: any }> {
  return fetcher(`/api/v1/farmer/negotiations/${id}/decide`, {
    method: "POST",
    body: JSON.stringify({ action, rejectionReason }),
  });
}

export async function lockOrderEscrow(harvestEventId: number, amountKg: number): Promise<{ order_id: number }> {
  return fetcher("/api/orders/lock", {
    method: "POST",
    body: JSON.stringify({ harvest_event_id: harvestEventId, amount_kg: amountKg }),
  });
}

// ============================================================
// SUPERADMIN PANEL API
// ============================================================

export type AuditModule = "AUTH" | "HARVEST" | "ORDER" | "LOCATION" | "PRICE_ENGINE" | "ADMIN" | "SYSTEM";

export interface AuditLogRecord {
  id: string;
  userId: string | null;
  role: string | null;
  actorPhone: string | null;
  actorName: string | null;
  action: string;
  module: AuditModule;
  description: string | null;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  createdAtWib: string;
}

export interface AdminUserRecord {
  id: number;
  name: string;
  phone_number: string;
  waUrl: string;
  role: UserRole;
  business_type: string | null;
  is_active: boolean;
  hasPassword: boolean;
  latitude: number;
  longitude: number;
  regionName: string | null;
  mapsUrl: string;
  totalCrops: number;
  totalOrders: number;
  created_at: string;
  createdAtWib: string;
}

export interface RegionalPriceCommodity {
  commodity: string;
  lowestPrice: number;
  highestPrice: number;
  avgPrice: number;
  refFarmerPrice: number;
  umkmPrice: number;
  hapPrice: number;
  trend: "UP" | "DOWN" | "STABLE";
  totalListings: number;
  totalStockKg: number;
  totalFarmers: number;
  source: "HARVEST_REAL" | "AI_PRICE_ENGINE";
  updatedAt: string;
}

export interface RegionalPriceRegion {
  regionName: string;
  totalCommodities: number;
  avgRegionPrice: number;
  totalStockKg: number;
  commodities: RegionalPriceCommodity[];
}

export interface AdminOrderRecord {
  id: number;
  status: OrderStatus;
  commodity: string;
  quantityKg: number;
  pricePerKg: number;
  originalPricePerKg: number;
  isNego: boolean;
  negoReason: string | null;
  rejectionReason: string | null;
  grandTotal: number;
  deliveryMethod: string;
  deliveryFee: number;
  distanceKm: number;
  buyerName: string;
  buyerPhone: string;
  buyerRegion: string;
  farmerName: string;
  farmerPhone: string;
  farmerRegion: string;
  created_at: string;
  createdAtWib: string;
}

export interface GeoRadarRegion {
  regionName: string;
  farmers: number;
  umkm: number;
  totalPartners: number;
  totalOrders: number;
  totalValue: number;
  avgDistanceKm: number;
  densityScore: number;
  balance: "SURPLUS_PETANI" | "DEFISIT_PETANI" | "SEIMBANG";
  centerLat: number | null;
  centerLng: number | null;
  inRadius100Km: boolean;
}

export interface GeoRadarPoint {
  id: number;
  name: string;
  role: UserRole;
  latitude: number;
  longitude: number;
  regionName: string | null;
  is_active: boolean;
  mapsUrl: string;
}

export async function getAdminStats(): Promise<{
  success: boolean;
  data: {
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    totalHarvests: number;
    totalOrders: number;
    logs24h: number;
    totalRegions: number;
    waConnected: boolean;
  };
}> {
  return fetcher("/api/v1/admin/stats");
}

export async function getAdminGeoRadar(): Promise<{
  success: boolean;
  totalRegions: number;
  summary: { totalFarmers: number; totalUmkm: number; avgDistanceKm: number };
  data: GeoRadarRegion[];
  points: GeoRadarPoint[];
}> {
  return fetcher("/api/v1/admin/geo-radar");
}

export interface BroadcastRecipient {
  name: string;
  phone: string;
  role: string;
  status: "PENDING" | "TYPING" | "SENT" | "FAILED";
  timestamp?: string;
  error?: string;
}

export interface BroadcastJob {
  jobId: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  totalRecipients: number;
  sent: number;
  failed: number;
  progress: number;
  recipients: BroadcastRecipient[];
  startedAt: string;
  completedAt?: string;
}

export async function sendAdminWaBroadcast(payload: {
  targetRole: "ALL" | "PETANI" | "UMKM";
  message: string;
  delay?: number;
  dryRun?: boolean;
}): Promise<{ success: boolean; message: string; data?: { jobId: string; totalRecipients: number; delay: number } }> {
  return fetcher("/api/v1/admin/broadcast-wa", { method: "POST", body: JSON.stringify(payload) });
}

export async function getAdminBroadcastProgress(jobId: string): Promise<{
  success: boolean;
  data: BroadcastJob;
}> {
  return fetcher(`/api/v1/admin/broadcast-progress/${jobId}`);
}

export type WaConnectionStatus = "DISCONNECTED" | "SCAN_QR_REQUIRED" | "CONNECTED";

export async function getAdminWaStatus(): Promise<{
  success: boolean;
  data: {
    status: WaConnectionStatus;
    qrCodeBase64: string | null;
    waConnected: boolean;
  };
}> {
  return fetcher("/api/v1/admin/wa-status");
}

export async function impersonateAdminUser(
  userId: number
): Promise<{ success: boolean; message: string; data: AuthUser & { regionName?: string } }> {
  return fetcher(`/api/v1/admin/users/${userId}/impersonate`, { method: "POST" });
}

export async function getAdminAuditLogs(params?: {
  module?: string;
  action?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  success: boolean;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  data: AuditLogRecord[];
}> {
  const q = new URLSearchParams();
  if (params?.module && params.module !== "ALL") q.set("module", params.module);
  if (params?.action && params.action !== "ALL") q.set("action", params.action);
  if (params?.search) q.set("search", params.search);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return fetcher(`/api/v1/admin/logs${qs ? `?${qs}` : ""}`);
}

export async function getAdminUsers(params?: {
  role?: string;
  status?: string;
  search?: string;
}): Promise<{
  success: boolean;
  total: number;
  summary: { farmers: number; umkm: number; superadmin: number; active: number; suspended: number };
  data: AdminUserRecord[];
}> {
  const q = new URLSearchParams();
  if (params?.role && params.role !== "ALL") q.set("role", params.role);
  if (params?.status && params.status !== "ALL") q.set("status", params.status);
  if (params?.search) q.set("search", params.search);
  const qs = q.toString();
  return fetcher(`/api/v1/admin/users${qs ? `?${qs}` : ""}`);
}

export async function createAdminUser(payload: {
  name: string;
  phone_number: string;
  role: UserRole;
  password?: string;
  business_type?: string;
  latitude?: number;
  longitude?: number;
  regionName?: string;
}): Promise<{ success: boolean; message: string; data?: any }> {
  return fetcher("/api/v1/admin/users", { method: "POST", body: JSON.stringify(payload) });
}

export async function toggleAdminUserStatus(
  userId: number,
  isActive?: boolean,
  reason?: string
): Promise<{ success: boolean; message: string; data?: any }> {
  return fetcher(`/api/v1/admin/users/${userId}/toggle-status`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: isActive, reason }),
  });
}

export async function updateAdminUserRole(
  userId: number,
  role: UserRole
): Promise<{ success: boolean; message: string; data?: any }> {
  return fetcher(`/api/v1/admin/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function resetAdminUserPassword(
  userId: number,
  newPassword?: string
): Promise<{ success: boolean; message: string; data: { id: number; temporaryPassword: string } }> {
  return fetcher(`/api/v1/admin/users/${userId}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ newPassword }),
  });
}

export async function getAdminRegionalPrices(): Promise<{
  success: boolean;
  totalRegions: number;
  updatedAt: string;
  data: RegionalPriceRegion[];
}> {
  return fetcher("/api/v1/admin/regional-prices");
}

export async function getAdminOrders(params?: { status?: string; search?: string }): Promise<{
  success: boolean;
  total: number;
  summary: {
    pending: number;
    nego: number;
    accepted: number;
    rejected: number;
    completed: number;
    totalValue: number;
  };
  data: AdminOrderRecord[];
}> {
  const q = new URLSearchParams();
  if (params?.status && params.status !== "ALL") q.set("status", params.status);
  if (params?.search) q.set("search", params.search);
  const qs = q.toString();
  return fetcher(`/api/v1/admin/orders${qs ? `?${qs}` : ""}`);
}

export async function updateLocationFromWa(payload: {
  token: string;
  latitude: number;
  longitude: number;
  regionName?: string;
  password?: string;
}): Promise<{ success: boolean; message: string; data?: { name: string; region: string; regionName?: string; phone?: string } }> {
  const path = payload.password ? "/api/v1/location/activate-wa-account" : "/api/v1/location/update-from-wa";
  return fetcher(path, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ============================================================
// SUPERADMIN EXTENDED API
// ============================================================

export async function getAllSuperadminUsers(): Promise<{ success: boolean; total: number; data: any[] }> {
  return fetcher("/api/v1/superadmin/users");
}

export async function manualResetPassword(userId: number, newPassword: string): Promise<{ success: boolean; message: string }> {
  return fetcher("/api/v1/superadmin/reset-password", { method: "POST", body: JSON.stringify({ userId, newPassword }) });
}

export async function promoteToSuperadmin(userId: number): Promise<{ success: boolean; message: string }> {
  return fetcher("/api/v1/superadmin/promote", { method: "POST", body: JSON.stringify({ userId }) });
}

export async function deleteUser(userId: number): Promise<{ success: boolean; message: string }> {
  return fetcher("/api/v1/superadmin/delete-user", { method: "POST", body: JSON.stringify({ userId }) });
}

export async function updateWaConfig(sendDelaySeconds: number, enableTypingEffect: boolean): Promise<{ success: boolean; message: string; data: any }> {
  return fetcher("/api/v1/superadmin/wa-config", { method: "POST", body: JSON.stringify({ sendDelaySeconds, enableTypingEffect }) });
}

export async function getWaLogs(): Promise<{ success: boolean; config: any; logs: any[] }> {
  return fetcher("/api/v1/superadmin/wa-logs");
}

// ============================================================
// SUPERADMIN SPRINT 13 API
// ============================================================

export async function getAuditLogs(): Promise<{ success: boolean; count: number; data: any[] }> {
  return fetcher("/api/v1/superadmin/audit-logs");
}

export async function getUsersManagement(): Promise<{ success: boolean; total: number; data: any[] }> {
  return fetcher("/api/v1/superadmin/users-management");
}

export async function resetUserPassword(userId: number, newPassword: string): Promise<{ success: boolean; message: string }> {
  return fetcher("/api/v1/superadmin/reset-password", { method: "POST", body: JSON.stringify({ userId, newPassword }) });
}

export async function promoteUserRole(userId: number, role: string): Promise<{ success: boolean; message: string }> {
  return fetcher("/api/v1/superadmin/promote-role", { method: "POST", body: JSON.stringify({ userId, role }) });
}

export async function deleteUserAccount(userId: number): Promise<{ success: boolean; message: string }> {
  return fetcher("/api/v1/superadmin/delete-user-account", { method: "POST", body: JSON.stringify({ userId }) });
}

export async function getRegionalPricesAndCommodities(): Promise<{ success: boolean; data: { prices: any[]; commodities: any[] } }> {
  return fetcher("/api/v1/superadmin/regional-prices");
}

export async function getGeospatialRadarData(): Promise<{ success: boolean; total: number; data: any[] }> {
  return fetcher("/api/v1/superadmin/geospatial");
}

export async function getWaEngineStatus(): Promise<{ success: boolean; engine: any; logs: any[] }> {
  return fetcher("/api/v1/superadmin/wa-status");
}

export async function updateWaSettings(sendDelaySeconds: number, enableTypingEffect: boolean): Promise<{ success: boolean; message: string; data: any }> {
  return fetcher("/api/v1/superadmin/wa-settings", { method: "POST", body: JSON.stringify({ sendDelaySeconds, enableTypingEffect }) });
}

export async function sendBroadcast(targetRole: string, message: string): Promise<{ success: boolean; message: string }> {
  return fetcher("/api/v1/superadmin/broadcast", { method: "POST", body: JSON.stringify({ targetRole, message }) });
}

const api = {
  get: async (url: string, config?: any) => ({ data: await fetcher<any>(url, { method: "GET", ...config }) }),
  post: async (url: string, body?: any, config?: any) => ({ data: await fetcher<any>(url, { method: "POST", body: JSON.stringify(body), ...config }) }),
  put: async (url: string, body?: any, config?: any) => ({ data: await fetcher<any>(url, { method: "PUT", body: JSON.stringify(body), ...config }) }),
  patch: async (url: string, body?: any, config?: any) => ({ data: await fetcher<any>(url, { method: "PATCH", body: JSON.stringify(body), ...config }) }),
  delete: async (url: string, config?: any) => ({ data: await fetcher<any>(url, { method: "DELETE", ...config }) }),
};

export default api;


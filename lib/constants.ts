export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Tender Finder";

export { STATES } from "./places";

export const LANGUAGES = [
  { code: "mr", label: "मराठी" },
  { code: "hi", label: "हिंदी" },
  { code: "en", label: "English" },
] as const;
export type Lang = "mr" | "hi" | "en";

export const LANG_NAME: Record<Lang, string> = { mr: "Marathi", hi: "Hindi", en: "English" };

export const BUSINESS_TYPES = [
  "Civil / road works contractor",
  "Electrical contractor",
  "Supplier (goods)",
  "Printing & stationery",
  "IT / computer / CCTV",
  "Services (security, cleaning, manpower)",
  "Furniture",
  "Medical / lab supplies",
  "Transport / logistics",
  "Other",
];

// Documents a business may already have
export const DOCUMENTS = [
  { id: "gst", label: "GST registration certificate" },
  { id: "pan", label: "PAN card (business)" },
  { id: "udyam", label: "Udyam / MSME certificate" },
  { id: "itr", label: "Income tax returns (last 3 years)" },
  { id: "ca_turnover", label: "CA-certified turnover certificate" },
  { id: "balance_sheet", label: "Audited balance sheets" },
  { id: "experience", label: "Work experience / completion certificates" },
  { id: "work_orders", label: "Past work orders" },
  { id: "contractor_reg", label: "Contractor registration (PWD / ZP / class licence)" },
  { id: "dsc", label: "Digital Signature Certificate (Class 3)" },
  { id: "bank_solvency", label: "Bank solvency certificate" },
  { id: "shop_act", label: "Shop Act / trade licence" },
  { id: "partnership", label: "Partnership deed / company registration" },
  { id: "epf_esic", label: "EPF and ESIC registration" },
  { id: "labour_licence", label: "Labour licence" },
  { id: "iso", label: "ISO / quality certificates" },
  { id: "oem_auth", label: "Manufacturer (OEM) authorisation letter" },
  { id: "cancelled_cheque", label: "Cancelled cheque / bank details" },
];

export const PLANS = [
  { name: "Starter", price: 499, points: ["1 state", "5 work keywords", "Daily email alerts", "AI summaries"] },
  { name: "Pro", price: 999, points: ["Any states, all India", "Unlimited keywords", "Eligibility check", "Bid preparation pack", "Deadline reminders"], featured: true },
  { name: "Business", price: 2499, points: ["Everything in Pro", "3 team members", "Priority support", "WhatsApp alerts (coming soon)"] },
];

export function rupees(n?: number | null) {
  if (n === null || n === undefined || isNaN(Number(n))) return "—";
  const v = Number(n);
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2).replace(/\.00$/, "")} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2).replace(/\.00$/, "")} lakh`;
  return `₹${v.toLocaleString("en-IN")}`;
}

export function daysLeft(iso?: string | null) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

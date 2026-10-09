// States and union territories of India
export const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

// Common alternative spellings, so the AI's answer lands on one standard name
const ALIASES: Record<string, string> = {
  "nct of delhi": "Delhi", "new delhi": "Delhi", "delhi ncr": "Delhi",
  orissa: "Odisha", pondicherry: "Puducherry", uttaranchal: "Uttarakhand",
  "j&k": "Jammu and Kashmir", "jammu & kashmir": "Jammu and Kashmir",
  "tamilnadu": "Tamil Nadu", "chhatisgarh": "Chhattisgarh",
  "andaman & nicobar islands": "Andaman and Nicobar Islands",
  "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
  "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
};

export function cleanState(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;
  if (ALIASES[s]) return ALIASES[s];
  const exact = STATES.find((x) => x.toLowerCase() === s);
  if (exact) return exact;
  const partial = STATES.find((x) => x.toLowerCase().includes(s) || s.includes(x.toLowerCase()));
  return partial || null;
}

export function cleanDistrict(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim().replace(/\s+/g, " ");
  if (!s || s.length < 2) return null;
  return s.slice(0, 60);
}

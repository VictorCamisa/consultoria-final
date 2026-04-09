import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeEmail(value?: string | null) {
  const email = (value ?? "").trim().toLowerCase();
  return email || null;
}

export function normalizePhone(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if (digits.length > 11) return `+${digits}`;
  return null;
}

export function normalizeWebsite(value?: string | null) {
  const website = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");

  return website || null;
}

export function buildLeadIdentityKey(input: {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
  city?: string | null;
  website?: string | null;
}) {
  const phone = normalizePhone(input.phone);
  if (phone) return `phone:${phone}`;

  const email = normalizeEmail(input.email);
  if (email) return `email:${email}`;

  const website = normalizeWebsite(input.website);
  if (website) return `site:${website}`;

  const name = normalizeText(input.name);
  const city = normalizeText(input.city);
  if (name && city) return `name:${name}|city:${city}`;
  if (name) return `name:${name}`;

  return null;
}

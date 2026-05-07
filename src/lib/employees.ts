import { supabase } from "@/integrations/supabase/client";

export type EmployeeRole = "เจ้าหน้าที่คลัง" | "เจ้าของโรงงาน" | "พนักงานทั่วไป";

export interface Employee {
  name: string;
  role: EmployeeRole;
}

export const hasFullAccess = (role: EmployeeRole | string | null | undefined) =>
  role === "เจ้าหน้าที่คลัง" || role === "เจ้าของโรงงาน";

let cache: Employee[] | null = null;
export async function fetchRoster(force = false): Promise<Employee[]> {
  if (cache && !force) return cache;
  const { data, error } = await supabase.functions.invoke("get-roster");
  if (error) throw error;
  cache = (data?.employees || []) as Employee[];
  return cache;
}

export async function findEmployee(name: string): Promise<Employee | undefined> {
  const trimmed = name.trim();
  const list = await fetchRoster();
  return list.find((e) => e.name === trimmed);
}

// Deterministic email from name (sha256 hex prefix) so the same name always
// resolves to the same Supabase auth user.
export async function nameToEmail(name: string): Promise<string> {
  // Encode name to handle Thai characters safely for email local part
  const cleanName = btoa(encodeURIComponent(name.trim()))
    .replace(/[+/=]/g, "")
    .toLowerCase()
    .slice(0, 20);
  return `emp_${cleanName}@spareparts-system.com`;
}

export const pinToPassword = (pin: string) => `Octo-pin-${pin}`;

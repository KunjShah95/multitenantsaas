// Role -> permissions mapping for Phase 02
// Keep simple; future phases expand per domain.
export type Role = "admin" | "rep" | "manager" | "finance" | "ops";

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: [
    "org:manage",
    "member:invite",
    "member:manage",
    "team:manage",
    "customer:manage",
    "quote:manage",
    "quote:approve",
    "inventory:manage",
    "order:manage",
    "billing:manage",
    "report:view",
  ],
  rep: ["customer:manage", "quote:create", "quote:submit", "order:view"],
  manager: ["team:view", "quote:read", "quote:approve:manager", "customer:read", "report:view"],
  finance: ["quote:approve:finance", "invoice:manage", "billing:manage", "report:view"],
  ops: ["inventory:manage", "warehouse:manage", "shipment:manage", "order:view"],
};

export function getPermissionsForRole(role: string): string[] {
  return ROLE_PERMISSIONS[role as Role] ?? [];
}

export function hasPermission(role: string, permission: string): boolean {
  const perms = getPermissionsForRole(role);
  return perms.includes(permission) || perms.includes("*") || perms.includes("org:manage");
}

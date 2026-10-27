import type { Permission, Role } from './types';

export const ALL_PERMISSIONS: Permission[] = [
  'dashboard:view',
  'registration:submit',
  'registration:review',
  'farmer:read',
  'farmer:create',
  'farmer:manage',
  'farmer:suspend',
  'farmer:self:manage',
  'holding:read',
  'holding:write',
  'catalogue:read',
  'catalogue:manage',
  'inventory:read',
  'inventory:write',
  'treatment:read',
  'treatment:write',
  'treatment:reverse',
  'tfi:read',
  'alert:read',
  'report:export',
  'audit:view',
  'map:view',
  'settings:manage',
  'backup:manage',
];

const CHAMBER_PERMISSIONS: Permission[] = [
  'dashboard:view',
  'farmer:read',
  'holding:read',
  'catalogue:read',
  'inventory:read',
  'treatment:read',
  'tfi:read',
  'alert:read',
  'report:export',
  'map:view',
];

const FARMER_PERMISSIONS: Permission[] = [
  'dashboard:view',
  'farmer:self:manage',
  'holding:read',
  'holding:write',
  'catalogue:read',
  'inventory:read',
  'inventory:write',
  'treatment:read',
  'treatment:write',
  'treatment:reverse',
  'tfi:read',
  'alert:read',
  'report:export',
  'map:view',
];

export interface RoleDefinition {
  role: Role;
  labelKey: string;
  descriptionKey: string;
  permissions: Permission[];
  demoNoticeKey: string;
}

export const ROLE_DEFINITIONS: Record<Role, RoleDefinition> = {
  DSA_ADMIN: {
    role: 'DSA_ADMIN',
    labelKey: 'role.DSA_ADMIN',
    descriptionKey: 'role.DSA_ADMIN_desc',
    permissions: ALL_PERMISSIONS,
    demoNoticeKey: 'role.DSA_ADMIN_notice',
  },
  CHAMBER_ADMIN: {
    role: 'CHAMBER_ADMIN',
    labelKey: 'role.CHAMBER_ADMIN',
    descriptionKey: 'role.CHAMBER_ADMIN_desc',
    permissions: CHAMBER_PERMISSIONS,
    demoNoticeKey: 'role.CHAMBER_ADMIN_notice',
  },
  FARMER: {
    role: 'FARMER',
    labelKey: 'role.FARMER',
    descriptionKey: 'role.FARMER_desc',
    permissions: FARMER_PERMISSIONS,
    demoNoticeKey: 'role.FARMER_notice',
  },
};

export function permissionsForRole(role: Role): Permission[] {
  return [...ROLE_DEFINITIONS[role].permissions];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_DEFINITIONS[role].permissions.includes(permission);
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function canAccessRoute(role: Role, required?: Permission | Permission[]): boolean {
  if (!required) return true;
  return Array.isArray(required) ? hasAnyPermission(role, required) : hasPermission(role, required);
}

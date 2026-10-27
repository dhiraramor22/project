import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS,
  canAccessRoute,
  hasAnyPermission,
  hasPermission,
  permissionsForRole,
} from '../../src/domain/permissions';

describe('centralized permissions', () => {
  it('grants the DSA administrator every declared permission', () => {
    expect(permissionsForRole('DSA_ADMIN').sort()).toEqual([...ALL_PERMISSIONS].sort());
    for (const permission of ALL_PERMISSIONS) {
      expect(hasPermission('DSA_ADMIN', permission)).toBe(true);
    }
  });

  it('keeps the Chamber administrator read-only and scoped away from administration', () => {
    const denied = [
      'registration:review',
      'farmer:create',
      'farmer:manage',
      'farmer:suspend',
      'holding:write',
      'catalogue:manage',
      'inventory:write',
      'treatment:write',
      'treatment:reverse',
      'audit:view',
      'settings:manage',
      'backup:manage',
    ] as const;
    for (const permission of denied) {
      expect(hasPermission('CHAMBER_ADMIN', permission)).toBe(false);
    }
    expect(hasPermission('CHAMBER_ADMIN', 'farmer:read')).toBe(true);
    expect(hasPermission('CHAMBER_ADMIN', 'holding:read')).toBe(true);
    expect(hasPermission('CHAMBER_ADMIN', 'inventory:read')).toBe(true);
    expect(hasPermission('CHAMBER_ADMIN', 'treatment:read')).toBe(true);
    expect(hasPermission('CHAMBER_ADMIN', 'tfi:read')).toBe(true);
    expect(hasPermission('CHAMBER_ADMIN', 'report:export')).toBe(true);
    expect(hasPermission('CHAMBER_ADMIN', 'map:view')).toBe(true);

    expect(hasPermission('CHAMBER_ADMIN', 'inventory:write')).toBe(false);
    expect(hasPermission('CHAMBER_ADMIN', 'treatment:write')).toBe(false);
    expect(hasPermission('CHAMBER_ADMIN', 'catalogue:manage')).toBe(false);
    expect(hasPermission('CHAMBER_ADMIN', 'settings:manage')).toBe(false);
    expect(hasPermission('CHAMBER_ADMIN', 'audit:view')).toBe(false);
    expect(hasPermission('CHAMBER_ADMIN', 'backup:manage')).toBe(false);
    expect(hasPermission('CHAMBER_ADMIN', 'registration:review')).toBe(false);
  });

  it('gives farmers their own record, holding and treatment workflows only', () => {
    expect(hasPermission('FARMER', 'farmer:self:manage')).toBe(true);
    expect(hasPermission('FARMER', 'holding:write')).toBe(true);
    expect(hasPermission('FARMER', 'inventory:write')).toBe(true);
    expect(hasPermission('FARMER', 'treatment:write')).toBe(true);
    expect(hasPermission('FARMER', 'treatment:reverse')).toBe(true);

    expect(hasPermission('FARMER', 'farmer:read')).toBe(false);
    expect(hasPermission('FARMER', 'farmer:create')).toBe(false);
    expect(hasPermission('FARMER', 'registration:review')).toBe(false);
    expect(hasPermission('FARMER', 'catalogue:manage')).toBe(false);
    expect(hasPermission('FARMER', 'audit:view')).toBe(false);
    expect(hasPermission('FARMER', 'settings:manage')).toBe(false);
    expect(hasPermission('FARMER', 'backup:manage')).toBe(false);
  });

  it('evaluates route guards and multi-permission checks', () => {
    expect(canAccessRoute('FARMER', undefined)).toBe(true);
    expect(canAccessRoute('FARMER', 'audit:view')).toBe(false);
    expect(canAccessRoute('FARMER', ['audit:view', 'treatment:write'])).toBe(true);
    expect(canAccessRoute('CHAMBER_ADMIN', ['settings:manage', 'report:export'])).toBe(true);
    expect(canAccessRoute('DSA_ADMIN', 'registration:review')).toBe(true);
    expect(hasAnyPermission('CHAMBER_ADMIN', ['inventory:write', 'inventory:read'])).toBe(true);
    expect(hasAnyPermission('CHAMBER_ADMIN', ['inventory:write', 'settings:manage'])).toBe(false);
  });

  it('returns copies so route code cannot mutate the central role matrix', () => {
    const permissions = permissionsForRole('FARMER');
    permissions.push('settings:manage');
    expect(hasPermission('FARMER', 'settings:manage')).toBe(false);
    expect(permissionsForRole('FARMER')).not.toContain('settings:manage');
  });
});

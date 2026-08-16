import { SetMetadata } from '@nestjs/common';

export type UserRoleName = 'student' | 'admin';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given roles (enforced by RolesGuard, after auth). */
export const Roles = (...roles: UserRoleName[]) => SetMetadata(ROLES_KEY, roles);

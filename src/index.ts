import type { RBACCache } from "./cache";
import type { RBACPersistence } from "./persistence";


export default class RBAC<
	const Roles extends string[],
	const Entities extends string[],
	const Permissions extends string[],
	const Scopes extends string[],
	const Grants extends string[],
	const SuperAdminRole extends Roles[number],
> {
	constructor(
		public config: {
			roles: Roles;
			superAdminRole: SuperAdminRole;
			entities: Entities;
			permissions: Permissions;
			grants: Grants;
			scopes: Scopes;
			rolePermissionMap: Record<Exclude<Roles[number], SuperAdminRole>, {
				permissions: `${Entities[number]}:${Permissions[number]}`[];
				scopedPermissions?: `${Entities[number]}:${Permissions[number]}:${Scopes[number]}`[];
				grants?: Grants[number][];
			}>
			entityScopeMap?: Record<Entities[number], {
				scope: Scopes[number];
				key: string; // e.g. createdBy, orgId, groupId
			}[]>;
		},
		private storage: {
			persistence: RBACPersistence;
			cache: RBACCache;
		}) { }

	public static async newRBAC<
		const Roles extends string[],
		const Entities extends string[],
		const Permissions extends string[],
		const Scopes extends string[],
		const Grants extends string[],
		const SuperAdminRole extends Roles[number],
	>(config: {
		roles: Roles;
		superAdminRole: SuperAdminRole;
		entities: Entities;
		permissions: Permissions;
		grants: Grants;
		scopes: Scopes;
		rolePermissionMap: Record<Exclude<Roles[number], SuperAdminRole>, {
			permissions: `${Entities[number]}:${Permissions[number]}`[];
			scopedPermissions?: `${Entities[number]}:${Permissions[number]}:${Scopes[number]}`[];
			grants?: Grants[number][];
		}>;
		entityScopeMap?: Record<Entities[number], {
			scope: Scopes[number];
			key: string; // e.g. createdBy, orgId, groupId
		}[]>;
	}, storage: {
		persistence: RBACPersistence;
		cache: RBACCache;
	}) {
		const rbac = new RBAC(config, storage);
		await rbac.sync();
		return rbac;
	}

	async sync() {
		const { roles, superAdminRole, entities, permissions, rolePermissionMap } = this.config;

		for (const role of roles) {
			await this.storage.persistence.upsertRole(role);
		}

		await this.storage.persistence.upsertRole(superAdminRole);

		for (const permission of permissions) {
			await this.storage.persistence.upsertPermission(permission);
		}

		for (const entity of entities) {
			await this.storage.persistence.upsertScope(entity);
		}

		for (const scope of this.config.scopes) {
			await this.storage.persistence.upsertScope(scope);
		}

		for (const grant of this.config.grants) {
			await this.storage.persistence.upsertGrant(grant);
		}

		type RolePermissionMap = typeof rolePermissionMap[keyof typeof rolePermissionMap];
		for (const [role, { permissions, scopedPermissions, grants }] of Object.entries(rolePermissionMap) as [Roles[number], RolePermissionMap][]) {
			for (const permission of permissions) {
				const [entity, perm] = permission.split(':') as [Entities[number], Permissions[number]];
				await this.grant(role as Roles[number], entity, perm);
			}
			for (const permission of scopedPermissions || []) {
				const [entity, perm, scope] = permission.split(':') as [Entities[number], Permissions[number], Scopes[number]];
				await this.storage.persistence.grantScopedPermission(role, {
					permission: perm,
					entity,
					scope
				});
			}
			for (const grant of grants || []) {
				await this.storage.persistence.giveRoleGrant(role, grant);
			}
		}

	}

	async can<P extends  `${Permissions[number]}:${Entities[number]}` | `${Permissions[number]}:${Entities[number]}:${Scopes[number]}`, Data extends Record<string, unknown>
	>(
		role: Roles[number],
		policy: P,
		scoped?: P extends `${Permissions[number]}:${Entities[number]}:${Scopes[number]}` ? {
			subject: string | number | string[] | number[];
			data: Data;
		} : never
	): Promise<boolean> {
		if (scoped) {
			const [permission, entity, scope] = policy.split(":") as [Permissions[number], Entities[number], Scopes[number]];
			const { subject, data } = scoped;
			const key = `${role}:${permission}:${entity}:${scope}:${Array.isArray(subject) ? subject.join(',') : subject}`;
			const cached = await this.storage.cache.get(key);
			if (cached) {
				return !!cached;
			}
			const entityScope = this.config.entityScopeMap?.[entity as Entities[number]];
			if (!entityScope) {
				console.warn(`Entity ${entity} does not have any scopes`);
				return false;
			}
			const permissions = await this.storage.persistence.getRoleScopedPolicies(role);
			const hasPermission = permissions.some(p => p.permission === permission && p.entity === entity && p.scope === scope);
			if (!hasPermission) {
				return false;
			}
			const keys = entityScope.filter(es => es.scope === scope && es.key in data).map(es => data[es.key]);
			if (!keys.length) {
				return false;
			}
			return Array.isArray(subject) ? subject.some(s => keys.includes(s)) : keys.includes(subject);
		}
		if (role === this.config.superAdminRole) return true;
		const policySplit = policy.split(':') as [Permissions[number], Entities[number]] | [Permissions[number], Entities[number], Scopes[number]];
		const [permission, entity] = policySplit as [Permissions[number], Entities[number]];
		const key = `${role}:${permission}:${entity}`;
		const cached = await this.storage.cache.get(key);
		if (cached) {
			return !!cached;
		}
		const permissions = await this.storage.persistence.getRolePolicies(role);
		const hasPermission = permissions.some(p => p.permission === permission && p.entity === entity);
		if (!hasPermission) {
			return false;
		}
		await this.storage.cache.set(key, 1);
		return true;
	}

	async hasGrant(role: Roles[number], grant: Grants[number]): Promise<boolean> {
		const key = `${role}:${grant}`;
		const cached = await this.storage.cache.get(key);
		if (cached) {
			return cached;
		}
		const grants = await this.storage.persistence.getRoleGrants(role);
		if (!grants.includes(grant)) {
			return false;
		}
		await this.storage.cache.set(key, 1);
		return true;
	}

	async grant(role: Roles[number], entity: Entities[number], permission: Permissions[number]): Promise<void> {
		await this.storage.persistence.upsertRole(role);
		await this.storage.persistence.upsertPermission(permission);
		await this.storage.persistence.grantRolePermission(role, {
			permission,
			entity
		});
		const key = `${role}:${permission}`;
		await this.storage.cache.set(key, 1);
	}

	async grantRole(subject: string | number, role: Roles[number]): Promise<void> {
		await this.storage.persistence.upsertRole(role);
		await this.storage.persistence.grantSubjectRole(subject, role);
		const key = `sub:${subject}:role:${role}`;
		await this.storage.cache.set(key, 1);
	}

	async revokeRole(subject: string | number, role: Roles[number]): Promise<void> {
		await this.storage.persistence.upsertRole(role);
		await this.storage.persistence.grantSubjectRole(subject, role);
		const key = `sub:${subject}:role:${role}`;
		await this.storage.cache.set(key, 0);
	}
}

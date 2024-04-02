import type { RBACPersistence } from "../persistence";

export class MemoryPersistence implements RBACPersistence {

	roles: string[] = [];
	permissions: string[] = [];
	scopes: string[] = [];
	grants: string[] = [];
	roleGrants: Record<string, string[]> = {};
	rolePermissions: Record<string, string[]> = {};
	subjectRoles: Record<string, string[]> = {};
	scopedRolePermissions: Record<string, string[]> = {};

	async upsertRole(role: string): Promise<string> {
		if (!this.roles.includes(role)) {
			this.roles.push(role);
		}
		return role;
	}

	async getRole(role: string): Promise<string> {
		return this.roles.includes(role) ? role : "";
	}

	async getActorRoles(actor: string | number): Promise<string[]> {
		return this.subjectRoles[actor] || [];
	}

	async getRolePermissions(role: string): Promise<string[]> {
		return this.rolePermissions[role] || [];
	}

	async grantRolePermission(role: string, {
		permission,
		entity
	}: {
		permission: string;
		entity: string;
	}): Promise<string> {
		if (!this.rolePermissions[role]) {
			this.rolePermissions[role] = [];
		}
		const key = `${permission}:${entity}`;
		if (!this.rolePermissions[role].includes(key)) {
			this.rolePermissions[role].push(key);
		}
		return permission;
	}

	async upsertPermission(permission: string): Promise<string> {
		if (!this.permissions.includes(permission)) {
			this.permissions.push(permission);
		}
		return permission;
	}

	async getPermission(permission: string): Promise<string> {
		return this.permissions.includes(permission) ? permission : "";
	}

	async grantSubjectRole(subject: string | number, role: string): Promise<string> {
		if (!this.subjectRoles[subject]) {
			this.subjectRoles[subject] = [];
		}
		if (!this.subjectRoles[subject].includes(role)) {
			this.subjectRoles[subject].push(role);
		}
		return role;
	}

	async getRoleGrants(role: string): Promise<string[]> {
		return this.roleGrants[role] || [];
	}
	async getRolePolicies(role: string): Promise<{ permission: string; entity: string; }[]> {
		const policies = this.rolePermissions[role] || [];
		return policies.map(key => {
			const [permission, entity] = key.split(':');
			return { permission, entity };	
		})
	}
	upsertScope(scope: string): Promise<string> {
		this.scopes.push(scope);
		return Promise.resolve(scope);
	}

	getScope(scope: string): Promise<string> {
		throw new Error("Method not implemented.");
	}

	upsertGrant(grant: string): Promise<string> {
		this.grants.push(grant);
		return Promise.resolve(grant);
	}

	getGrant(grant: string): Promise<string> {
		throw new Error("Method not implemented.");
	}

	async giveRoleGrant(role: string, grant: string): Promise<string> {
		if (!this.grants.includes(grant)) {
			throw new Error(`Grant ${grant} does not exist`);
		}
		if (!this.roleGrants[role]) {
			this.roleGrants[role] = [];
		}
		if (!this.roleGrants[role].includes(grant)) {
			this.roleGrants[role].push(grant);
		}
		return grant;
	}

	async grantScopedPermission(role: string, policy: { permission: string; entity: string; scope: string; }): Promise<string> {
		if (!this.scopedRolePermissions[role]) {
			this.scopedRolePermissions[role] = [];
		}
		const key = `${policy.permission}:${policy.entity}:${policy.scope}`;
		if (!this.scopedRolePermissions[role].includes(key)) {
			this.scopedRolePermissions[role].push(key);
		}
		return policy.permission;
	}
	async getRoleScopedPolicies(role: string): Promise<{ permission: string; entity: string; scope: string; }[]> {
		return this.scopedRolePermissions[role].map(key => {
			const [permission, entity, scope] = key.split(':');
			return { permission, entity, scope };	
		})
	}
}

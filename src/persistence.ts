export interface RBACPersistence {

	getActorRoles(actor: string | number): Promise<string[]>;

	getRolePolicies(role: string): Promise<{
		permission: string;
		entity: string;
	}[]>;	

	getRoleScopedPolicies(role: string): Promise<{
		permission: string;
		entity: string;
		scope: string;
	}[]>;

	getRoleGrants(role: string): Promise<string[]>;

	upsertRole(role: string): Promise<string>;

	getRole(role: string): Promise<string>;

	giveRoleGrant(role: string, grant: string): Promise<string>;

	grantRolePermission(role: string, policy: {
		permission: string;
		entity: string;
	}): Promise<string>;

	getPermission(permission: string): Promise<string>;
	upsertPermission(permission: string): Promise<string>;

	grantSubjectRole(subject: string | number, role: string): Promise<string>;

	upsertScope(scope: string): Promise<string>;
	getScope(scope: string): Promise<string>;

	upsertGrant(grant: string): Promise<string>;
	getGrant(grant: string): Promise<string>;

	grantScopedPermission(role: string, policy: {
		permission: string;
		entity: string;
		scope: string;
	}) : Promise<string>;


}

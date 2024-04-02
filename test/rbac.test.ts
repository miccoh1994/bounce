import { expect, describe, test, beforeAll } from 'bun:test';
import RBAC from '../src';
import { MemoryCache } from '../src/adapters/cache.memory';
import { MemoryPersistence } from '../src/adapters/persistence.memory';

let cache: MemoryCache;
let persistence: MemoryPersistence;
let rbac: RBAC<
	['admin', 'user', 'guest'],
	['user', 'post', 'post_draft'],
	['read', 'write', 'edit'],
	['self', 'org', 'group'],
	['register', 'forgot_password', 'reset_password'],
	'admin'
>;

const users = [
	{
		id: 1,
		role: 'user'
	},
	{
		id: 2,
		role: 'admin'
	},
	{
		id: 3,
		role: 'guest'
	},
	{
		id: 4,
		role: 'user'
	}
]
const userOrgs = [
	{
		userId: 1,
		orgId: 1
	},
	{
		userId: 1,
		orgId: 2
	},
	{
		userId: 2,
		orgId: 1,
	},
	{
		userId: 3,
		orgId: 2
	}
];

const posts = [
	{
		id: 1,
		createdBy: 1,
		orgId: 1,
	},
	{
		id: 2,
		createdBy: 1,
		orgId: 2,
	}	
]

beforeAll(async () => {
	cache = new MemoryCache();
	persistence = new MemoryPersistence();
	rbac = await RBAC.newRBAC({
		roles: ['admin', 'user', 'guest'],
		grants: ['register', 'forgot_password', 'reset_password'],
		permissions: ['read', 'write', 'edit'],
		entities: ['user', 'post', 'post_draft'],
		scopes: ['self', 'org', 'group'],
		rolePermissionMap: {	
			user: {
				permissions: ['post:read', 'post:write'],
				scopedPermissions: [
					'user:edit:self', 
					'post:edit:self', 
					'post:edit:org',
					'post_draft:read:org',
				],
			},
			guest: {
				permissions: ['post:read'],
				grants: ['register', 'forgot_password', 'reset_password']
			}
		},
		entityScopeMap: {
			post: [
				{
					scope: 'self',
					key: 'createdBy'
				},
				{
					scope: 'org',
					key: 'orgId'
				},
				{
					scope: 'group',
					key: 'groupId'
				}
			],
			post_draft: [
				{
					scope: 'self',
					key: 'createdBy',
				},
				{
					scope: 'org',
					key: 'orgId'
				}
			],
			user: [
				{
					scope: 'self',
					key: 'id'
				}
			]
		},
		superAdminRole: 'admin'
	}, { cache, persistence });
});

describe('RBAC', () => {
	test('user can read post', async () => {
		const result = await rbac.can('user', 'read:post');
		expect(result).toBe(true);
	});

	test('user can write user', async () => {
		const result = await rbac.can('user', 'write:user');
		expect(result).toBe(false);
	});
	
	test('admin can write user', async () => {
		const result = await rbac.can('admin', 'write:user');
		expect(result).toBe(true);
	});

	test('guest can register', async () => {
		const result = await rbac.hasGrant('guest', 'register');
		expect(result).toBe(true);
	});

	test('admin can\'t register', async () => {
		const result = await rbac.hasGrant('admin', 'register');
		expect(result).toBe(false);
	});


	test('user can edit self', async () => {
		const user = users.find(u => u.id === 1);
		if (!user) {
			throw new Error('User not found');
		}
		const result = await rbac.can('user', 'edit:user:self', {
			data: user,
			subject: 1
		});
		expect(result).toBe(true);
	});

	test('user can\'t edit other user', async () => {
		const user1 = users.find(u => u.id === 1);
		const user2 = users.find(u => u.id === 2);
		if (!user1 || !user2) {
			throw new Error('User not found');
		}
		const result = await rbac.can('user', 'edit:user:self', {
			data: user2,
			subject: 1
		});
		expect(result).toBe(false);
	})

	test('user can\'t read unpublished posts from another org', async () => {
		const publisher = users.find(u => u.id === 1);
		if (!publisher) throw new Error('Publisher not found');
		const post = posts.find(p => p.createdBy === 1 && p.orgId === 2);
		if (!post) throw new Error('Post not found');
		const reader = users.find(u => u.id === 2);
		if (!reader) throw new Error('Reader not found');
		const readerOrg = userOrgs.filter(uo => uo.userId === reader.id).map(uo => uo.orgId);
		const result = await rbac.can('user', 'read:post_draft:org', {
			data: post,
			subject: readerOrg
		});
		expect(result).toBe(false);
	});

	test('user can read unpublished posts from the same org', async () => {
		const publisher = users.find(u => u.id === 1);
		if (!publisher) throw new Error('Publisher not found');
		const post = posts.find(p => p.createdBy === 1 && p.orgId === 1);
		if (!post) throw new Error('Post not found');
		const reader = users.find(u => u.id === 2);
		if (!reader) throw new Error('Reader not found');
		const readerOrg = userOrgs.filter(uo => uo.userId === reader.id).map(uo => uo.orgId);
		const result = await rbac.can('user', 'read:post_draft:org', {
			data: post,
			subject: readerOrg 
		});
		expect(result).toBe(true);
	});
});


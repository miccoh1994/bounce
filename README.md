# Bounce

Bounce is a typescript library to assist with implementing Role Based Access Control and Role and Attribute Based Access Control in Bun or Node.
It provides typesafety and autocomplete for the permission system.

# Usage

```typescript
import BounceMemoryCache from '@miccoh/bounce/providers/memory.cache';
import BounceMemoryPersistence from '@miccoh/bounce/providers/memory.persistence';
import Bounce from '@miccoh/bounce';

const bounce = await Bounce.create(
    {
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
  },
  {
    persistence: new MyPersistenceProvider(),
    cache: new MyCacheProvider()
  }
);

/*
  Route Handler
*/

  // read posts
.get('/posts', ({ currentUser }: Context) => {
  if (!await bounce.can(currentUser.role, 'read:posts')) return 403;
  return 200;
})

  // edit user profile

.patch('/profile/:id', ({currentUser, params: { id }}: Context) => {
  const hasPermission = await bounce.can(currentUser.role, 'edit:users:self', {
    subject: {
      id
    },
    actor: currentUser.id
  });
  if (!hasPermission) return 403;
  return 200;
})

  // edit posts in organization
.patch(('/posts/:id', ({ currentUser, params: { id } }: Context)) => {
  const post = await getPost(id);
  const hasPermission = await bounce.can(currentUser.role, ['edit:posts:org', 'edit:posts:group'], {
    actor: [currentUser.orgIds, currentUser.groupIds],
    subject: post
  });
  if (!hasPermission) return 403;
  return 200;
})
```

# Custom Providers

You can implement the IBounceCache and IBouncePersistence interfaces and pass them to `Bounce.create(..., { cache: new CustomCache(), persistence: new CustomPersistence() })`

# Development

Install dependencies:

```bash
bun install
```

Run tests

```bash
bun test
```

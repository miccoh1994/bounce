import type { RBACCache } from "../cache";

export class MemoryCache implements RBACCache {
	cache: Record<string, any> = {};
	async set(key: string, value: any): Promise<void> {
		this.cache[key] = value;
	}
	async get(key: string): Promise<any> {
		return this.cache[key];
	}
}

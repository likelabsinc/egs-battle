import { Env } from '../../src/env/env';
import { Filter } from './lib/filter';
import { HiveFilter } from './lib/hive';
import { UserBlacklistFilter } from './lib/user-blacklist';
import { WordBlacklistFilter } from './lib/word-blacklist';

export class Moderation {
	private _filters: Filter[] | undefined;
	constructor(private _props: Moderation.ConstructorProps) {
		// @ts-ignore
		this._filters = this._props.filters.map((filter) => new filter(this._props.items, this._props.env));
	}

	public async shouldAllow(input: string, options: Filter.Options): Promise<boolean> {
		if (!this._filters) throw new Error('Moderation filters not initialized');
		for (const filter of this._filters) {
			if (!(await filter.shouldAllow(input, options))) return false;
		}
		return true;
	}
}

export namespace Moderation {
	export type Item = Filter.Item;
	export const Item = Filter.Item;
	export namespace Filters {
		export type UserBlacklist = UserBlacklistFilter;
		export const UserBlacklist = UserBlacklistFilter;
		export type Hive = HiveFilter;
		export const Hive = HiveFilter;
		export type WordBlacklist = WordBlacklistFilter;
		export const WordBlacklist = WordBlacklistFilter;
	}
	export interface ConstructorProps {
		filters: (typeof Filter)[];
		items: Filter.Item[];
		env: Env;
	}
}

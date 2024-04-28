import { Filter } from "./filter";

export class UserBlacklistFilter extends Filter {
    public async shouldAllow(input: string, options: Filter.Options): Promise<boolean> {
        if (options.userId == null) return true;
        const cachedResponse = await this._env.userBlacklist.get(options.userId);
        return cachedResponse !== 't';
    }
}
import { Filter } from "./filter";

const cacheExpirationSeconds = 60 * 60 * 24; // 1 day
const hiveUrl = 'https://api.thehive.ai/api/v2/task/sync';

export class HiveFilter extends Filter {
    private async _query(text: string): Promise<Hive.Response> {
        const response = await (await fetch(hiveUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Authorization': `token ${this._env.HIVE_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text_data: text }),
        })).json<any>();
        const classMap = new Map(response.status[0].response.output[0].classes.map(({ class: _class, score }: any) => [_class, score]));
        return new Hive.Response(classMap as Map<string, number>);
    }

    public async shouldAllow(input: string, options: Filter.Options): Promise<boolean> {
        const cacheKey = input.replace(/[^A-Za-z]/g, '').toLowerCase();
        const cachedResponse = await this._env.hiveCache.get(cacheKey);
        let hiveResponse;
        if (cachedResponse) {
            const classMap = new Map<string, number>(Object.entries(JSON.parse(cachedResponse)));
            hiveResponse = new Hive.Response(classMap);
        } else {
            hiveResponse = await this._query(input);
            await this._env.hiveCache.put(cacheKey, hiveResponse.toJson(), {
                expirationTtl: cacheExpirationSeconds,
            });
        }
        return !hiveResponse.hasAny(this._items);
    }
}

export namespace Hive {
    export class Response {
        constructor(
            private readonly _classMap: Map<string, number>,
        ) { }

        public has(key: string): boolean {
            return this._classMap.has(key) && this._classMap.get(key)! >= 2;
        }

        public hasAny(keys: string[]): boolean {
            return keys.some(key => this.has(key));
        }

        public toJson() {
            return JSON.stringify(Object.fromEntries(this._classMap.entries()));
        }
    }
}
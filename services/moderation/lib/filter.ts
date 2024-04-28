import { Env } from "../../../env/env";

export abstract class Filter {
    constructor(
        protected _items: Filter.Item[] = Filter.Item.All,
        protected _env: Env
    ) { }
    public abstract shouldAllow(input: string, options: Filter.Options): Promise<boolean>;
}

export namespace Filter {
    export enum Item {
        Sexual = 'sexual',
        Bullying = 'bullying',
        Redirection = 'redirection',
        PhoneNumber = 'phone_number',
        ChildExploitation = 'child_exploitation',
        ChildSafety = 'child_safety',
        SelfHarm = 'self_harm',
        Promotions = 'promotions',
    }
    export namespace Item {
        export const All: Item[] = [
            Item.Sexual,
            Item.Bullying,
            Item.Redirection,
            Item.PhoneNumber,
            Item.ChildExploitation,
            Item.ChildSafety,
            Item.SelfHarm,
            Item.Promotions,
        ];
        export function except(...items: Item[]) {
            const except = new Set<Item>(items);
            return All.filter(item => !except.has(item));
        }
    }
    export interface Options {
        userId?: string;
    }
}
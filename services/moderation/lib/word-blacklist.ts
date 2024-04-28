import { Filter } from "./filter";

export class WordBlacklistFilter extends Filter {
    private get _list(): string[] {
        return [
            'kys',
            'kill yourself',
            'bad word',
            'ak47',
            'ak 47',
            'ak-47',
            'ar15',
            'ar 15',
            'ar-15',
            'ky$',
            'fuck u',
            'go die',
            'kill you',
            'kill ur',
            'k1ll',
            'nigger',
            'niggers',
            'rifle',
            'not pretty',
            'no life',
            'kill',
            'slut',
            'ur ugly',
            'fuck you',
            'fagot',
            'k!ll',
            'whore',
            'cut yourself',
            'fuck yourself',
            'cut urself',
            'fuck urself',
            'murder',
            'rape',
            'rapist',
            'no one gives',
            'nobody cares',
            'nobody else cares',
            'nobody gives',
            'fag',
            'ugly',
            'play with',
            'freaky',
            'wearing',
            'braless',
            'rub your',
            'snap',
            'snapchat'
        ];
    }

    private get _regexedList() {
        return this._list.map(s => new RegExp("(^|\\s)".concat(s.split('').join('(\\s|\\.|\\-|)'), "(\\.|\\?|\\!|\\,|\\s|\\b|$)")));
    }

    private _test(str: string) {
        return this._regexedList.some(r => r.test(str));
    }

    public async shouldAllow(input: string, options: Filter.Options): Promise<boolean> {
        return !this._test(input.toLowerCase());
    }
}
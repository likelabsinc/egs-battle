export interface Booster {
	title: string;
	modifierFunction: (score: number) => number;
	endsAt: Date;
}

export class DoubleScoreBooster implements Booster {
	constructor(public title: string, public endsAt: Date) {}

	public modifierFunction = (score: number) => {
		return score * 2;
	};
}

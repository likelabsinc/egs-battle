export interface Booster {
	title: string;
	modifierFunction: (score: number) => number;
	endsAt: Date;
	durationInMs: number;
}

export class DoubleScoreBooster implements Booster {
	public durationInMs: number;
	public endsAt: Date;

	constructor(public title: string) {
		this.durationInMs = 30000;
		this.endsAt = new Date(Date.now() + this.durationInMs);
	}

	public modifierFunction = (score: number) => {
		return score * 2;
	};
}

export class TripleScoreBooster implements Booster {
	public durationInMs: number;
	public endsAt: Date;

	constructor(public title: string) {
		this.durationInMs = 30000;
		this.endsAt = new Date(Date.now() + this.durationInMs);
	}

	public modifierFunction = (score: number) => {
		return score * 3;
	};
}

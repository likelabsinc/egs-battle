import { Session } from '@likelabsinc/egs-tools';

export enum StorageKeys {
	State = 'state',
	Scores = 'scores',
	UserContributions = 'user-contributions',
}

export interface Booster {
	title: string;
	endsAt: Date;
}

export interface UserContribution {
	user: Session.User;
	score: number;
}

export interface UserScores {
	host: {
		[key: string]: UserContribution;
	};
	guest: {
		[key: string]: UserContribution;
	};
}

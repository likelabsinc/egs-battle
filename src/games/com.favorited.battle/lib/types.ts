import { Session } from '@likelabsinc/egs-tools';

export enum StorageKeys {
	State = 'state',
	Scores = 'scores',
	UserContributions = 'user-contributions',
	Feed = 'feed',
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

export interface FeedItem {
	username: string | null;
	body: string;
	createdAt: Date;
	textColor: string;
	usernameColor: string;
	iconImageUrl: string;
	iconBackgroundColor: string;
	iconColor: string;
}

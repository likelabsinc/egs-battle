import { Session } from '@likelabsinc/egs-tools';
import { Booster } from './boosters';

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

export interface Target {
	/// amount of points the users already have contributed
	/// for this target
	currentValue: number;

	/// amount of points the users need to contribute to
	/// reach the target and activate booster
	targetScore: number;

	/// text label for the target
	title: string;

	/// date when target ends, if not reached - booster will not be activated
	endsAt: Date;

	/// booster that will be activated when the target is reached
	booster: Booster;
}

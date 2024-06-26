import { Session } from '@likelabsinc/egs-tools';
import { Announcement, FeedItem, Target, UserContribution, Notification } from './types';
import { Booster } from './boosters';

export interface State {
	/**
	 * The initial state of the game.
	 */
	initial: {
		invited: boolean;
		title?: string;
	};

	/**
	 * A sample state w/ data { bar: string }
	 */
	round: {
		scores: {
			host: number;
			guest: number;
		};
		leaderboard: {
			host: UserContribution[];
			guest: UserContribution[];
		};
		winStreaks: {
			host: number;
			guest: number;
		};
		target: {
			host: Target | null;
			guest: Target | null;
		};
		booster: {
			host: Booster | null;
			guest: Booster | null;
		};
		announcement: {
			host: Announcement | null;
			guest: Announcement | null;
		};
		notification: {
			host: Notification | null;
			guest: Notification | null;
		};
		timerTextOverride: string | null;
		endsAt: Date;
		winner: 'host' | 'guest' | 'draw' | null;
		isForfeited: boolean;
		isFinished: boolean;
		feed: FeedItem[];
	};

	// insert additional properties here
}

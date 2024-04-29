import { Session } from '@likelabsinc/egs-tools';
import { Booster, FeedItem, UserContribution } from './types';

export interface State {
	/**
	 * The initial state of the game.
	 */
	initial: {
		invited: boolean;
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
		booster: Booster | null;
		endsAt: Date;
		winner: 'host' | 'guest' | 'draw' | null;
		isFinished: boolean;
		feed: FeedItem[];
	};

	// insert additional properties here
}

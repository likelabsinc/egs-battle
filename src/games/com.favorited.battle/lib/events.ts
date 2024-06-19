import { Game, Session } from '@likelabsinc/egs-tools';
import { Announcement, FeedItem, MuteMap, Notification, UserContribution } from './types';
import { Booster } from './boosters';

interface InboundEvents extends Game.Events.InboundEvents {
	'debug-send-gift': {
		type: 'gift';

		data: {
			userId: string;
			targetHostId: string;
			title: string;
			subtitle: string;
			image: string;
			primaryColor: string;
			secondaryColor: string;
			value: number;
		};
	};
	'accept-invite': undefined;
	'decline-invite': undefined;
	'user-double-tap': {
		side: 'host' | 'guest';
	};
	'mute-cohost': string;
	'unmute-cohost': string;
}

interface OutboundEvents extends Game.Events.OutboundEvents {
	'invite-declined': undefined;
	'update-booster': Booster | null;
	'update-scores': {
		host: number;
		guest: number;
	};
	'update-leaderboard': {
		host: UserContribution[];
		guest: UserContribution[];
	};
	'display-gift': {
		side: 'host' | 'guest';
		data: {
			title: string;
			subtitle: string;
			image: string;
			primaryColor: string;
			secondaryColor: string;
		};
	};
	'set-double-tapped': boolean;
	// final String text;
	// final String? backgroundColor;
	// final String? textColor;
	// final String? trailingText;
	// final String? trailingTextColor;

	'announce-target': {
		host?: Announcement | null;
		guest?: Announcement | null;
	};

	'update-mute-map': MuteMap;

	'send-notification': {
		side: 'host' | 'guest';
		notification: Notification;
	};
}

export type Events = Game.Events<InboundEvents, OutboundEvents>;

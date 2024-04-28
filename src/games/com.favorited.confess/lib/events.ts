import { Game, Session } from '@likelabsinc/egs-tools';
import { Booster, UserContribution } from './types';

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
}

export type Events = Game.Events<InboundEvents, OutboundEvents>;

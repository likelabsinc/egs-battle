import { ChatAction, Game, Session } from '@likelabsinc/egs-tools';
import { Events } from './lib/events';
import { State } from './lib/state';
import { Env } from '../../env/env';
import { Moderation } from '../../../services/moderation/moderation';
import { Booster, StorageKeys, UserScores } from './lib/types';

const kRoundDuration = 10 * 1000;

export class Battle extends Game<Env, State, Events> {
	private hostSession: Session<Events> | null = null;
	private guestSession: Session<Events> | null = null;

	private get moderation(): Moderation {
		return new Moderation({
			env: this.env,
			filters: [Moderation.Filters.UserBlacklist, Moderation.Filters.WordBlacklist, Moderation.Filters.Hive],
			items: Moderation.Item.All,
		});
	}

	private updateLeaderboard = async () => {
		try {
			const userContributions: UserScores = await this.storage.get(StorageKeys.UserContributions);
			const hostLeaderboard = Object.values(userContributions.host)
				.sort((a, b) => b.score - a.score)
				.splice(0, 3);
			const guestLeaderboard = Object.values(userContributions.guest)
				.sort((a, b) => b.score - a.score)
				.splice(0, 3);

			const state = await this.state.get();

			if (state.state === 'round') {
				await this.storage.set(StorageKeys.State, {
					state: 'round',
					data: {
						...(state.data as unknown as State['round']),
						leaderboard: {
							host: hostLeaderboard,
							guest: guestLeaderboard,
						},
					},
				});

				this.hostSession?.sendToChannel('update-leaderboard', {
					host: hostLeaderboard,
					guest: guestLeaderboard,
				});
			}
		} catch (e) {
			console.error(e);
		}
	};

	private startDebugBoosterScheduler = () => {
		console.log('startDebugBoosterScheduler');
		setTimeout(async () => {
			const state = await this.state.get();

			if (state.state === 'round') {
				const booster = (state as unknown as State['round']).booster;

				if (!booster) {
					console.log('startDebugBoosterScheduler setInterval 5000 !booster');

					this.hostSession?.sendToChannel('update-booster', {
						title: 'x2 value',
						endsAt: new Date(Date.now() + 30 * 1000),
					});

					setTimeout(async () => {
						console.log('startDebugBoosterScheduler setInterval 30000');
						const state = await this.state.get();

						if (state.state === 'round') {
							console.log('startDebugBoosterScheduler setInterval 30000 state.state === round');
							this.hostSession?.sendToChannel('update-booster', null);
						}

						this.startDebugBoosterScheduler();
					}, 30000);
				}
			}
		}, 5000);
	};

	private updateUserContribution = async (userId: string, value: number, side: 'host' | 'guest') => {
		const userContributions: UserScores = await this.storage.get(StorageKeys.UserContributions);

		const userContribution = userContributions[side][userId] || {
			user: this.getUserById(userId),
			score: 0,
		};

		userContribution.score += value;

		userContributions[side][userId] = userContribution;

		await this.storage.set(StorageKeys.UserContributions, userContributions);
	};

	private getUserById = (userId: string) => {
		const user = this.connectedSessions.find((session) => session.user.id == userId)?.user;

		return user;
	};

	private startGame = async () => {
		this.startDebugBoosterScheduler();

		await this.storage.set(StorageKeys.Scores, { host: 0, guest: 0 });
		await this.storage.set(StorageKeys.UserContributions, { host: {}, guest: {} });

		this.state.set('round', {
			scores: {
				host: 0,
				guest: 0,
			},
			leaderboard: {
				host: [],
				guest: [],
			},
			booster: null,
			endsAt: new Date(Date.now() + kRoundDuration),
			winner: null,
			isFinished: false,
		});

		this.storage.setAlarm(async () => {
			/// round end
			const scores: {
				host: number;
				guest: number;
			} = await this.storage.get(StorageKeys.Scores);

			const state = await this.state.get();

			this.state.set('round', {
				...(state.data as unknown as State['round']),
				winner: scores.host > scores.guest ? 'host' : scores.host < scores.guest ? 'guest' : 'draw',
				isFinished: true,
			});

			/// TODO: ask dt how it works
			this.persistentStorage.set('win-streaks', {});
		}, kRoundDuration);
	};

	protected registerEvents(): void {
		// this.registerGlobalEvent('system-notification', async (game, data) => {
		// 	if (data.type != 'gift') {
		// 		return;
		// 	}

		// 	const scores: {
		// 		host: number;
		// 		guest: number;
		// 	} = await this.storage.get(StorageKeys.Scores);

		// 	if (data.data.targetHostId == this.hostSession?.user.id) {
		// 		this.hostSession?.sendToChannel('display-gift', {
		// 			side: 'host',
		// 			data: {
		// 				title: data.data.title,
		// 				subtitle: data.data.subtitle,
		// 				image: data.data.image,
		// 				primaryColor: data.data.primaryColor,
		// 				secondaryColor: data.data.secondaryColor,
		// 			},
		// 		});
		// 	}

		// 	if (data.data.targetHostId == this.guestSession?.user.id) {
		// 		this.guestSession?.sendToChannel('display-gift', {
		// 			side: 'guest',
		// 			data: {
		// 				title: data.data.title,
		// 				subtitle: data.data.subtitle,
		// 				image: data.data.image,
		// 				primaryColor: data.data.primaryColor,
		// 				secondaryColor: data.data.secondaryColor,
		// 			},
		// 		});
		// 	}

		// 	this.hostSession?.sendToChannel('update-scores', {
		// 		host: scores.host + data.data.value,
		// 		guest: scores.guest,
		// 	});

		// 	await this.storage.set(StorageKeys.Scores, {
		// 		host: scores.host + data.data.value,
		// 		guest: scores.guest,
		// 	});

		// 	await this.updateUserContribution(
		// 		data.data.userId,
		// 		data.data.value,
		// 		data.data.targetHostId == this.hostSession?.user.id ? 'host' : 'guest'
		// 	);

		// 	this.updateLeaderboard();
		// });
		/**
		 * @event streamer-start - When the streamer starts the game.
		 */
		this.registerEvent('debug-send-gift', async (game, session, data) => {
			if (data.type != 'gift') {
				return;
			}

			const state = await this.state.get();

			console.log('debug-send-gift', data.data);
			console.log('guest id', this.guestSession?.user.id);

			const scores: {
				host: number;
				guest: number;
			} = await this.storage.get(StorageKeys.Scores);

			console.log('scores', scores);

			if (data.data.targetHostId == this.hostSession?.user.id) {
				console.log('hostSession', this.hostSession);
				this.hostSession?.sendToChannel('display-gift', {
					side: 'host',
					data: {
						title: data.data.title,
						subtitle: data.data.subtitle,
						image: data.data.image,
						primaryColor: data.data.primaryColor,
						secondaryColor: data.data.secondaryColor,
					},
				});

				scores.host += data.data.value;
			}

			if (data.data.targetHostId == this.guestSession?.user.id) {
				console.log('guestSession', this.guestSession);
				this.guestSession?.sendToChannel('display-gift', {
					side: 'guest',
					data: {
						title: data.data.title,
						subtitle: data.data.subtitle,
						image: data.data.image,
						primaryColor: data.data.primaryColor,
						secondaryColor: data.data.secondaryColor,
					},
				});

				scores.guest += data.data.value;
			}

			console.log('updating scores scores', scores);
			this.hostSession?.sendToChannel('update-scores', scores);

			await this.storage.set(StorageKeys.Scores, scores);
			await this.storage.set(StorageKeys.State, {
				state: 'round',
				data: {
					...(state.data as unknown as State['round']),
					scores: scores,
				},
			});

			console.log('updated scores scores', scores);

			await this.updateUserContribution(
				data.data.userId,
				data.data.value,
				data.data.targetHostId == this.hostSession?.user.id ? 'host' : 'guest'
			);

			console.log('updating user contribution', scores);

			this.updateLeaderboard();
		});

		this.registerEvent('accept-invite', async (game, session) => {
			if (session.isGuest) {
				this.startGame();
			}
		});

		this.registerEvent('decline-invite', async (game, session) => {
			if (session.isGuest) {
				this.hostSession?.send('invite-declined');
			}
		});

		// this.registerEvent('debug-send-boost', async (game, session, data) => {
		// 	const booster: Booster = {
		// 		title: data.title,
		// 		endsAt: new Date(Date.now() + 30 * 1000),
		// 	};

		// 	const state = await this.state.get();

		// 	if (state.state === 'round') {
		// 		this.state.set('round', {
		// 			...(state as unknown as State['round']),
		// 			booster,
		// 		});
		// 	}
		// });

		this.registerEvent('streamer-start', async (game, session) => {
			if (!session.isStreamer) return;

			this.startGame();
		});

		/**
		 * @event streamer-restart - When the streamer restarts the game.
		 */
		this.registerEvent('streamer-restart', async (game, session) => {
			if (!session.isStreamer) return;
			this.dispose();
			this.startGame();
		});

		/**
		 * @event bloc.close - When the user closes the game.
		 */
		this.registerEvent('bloc.close', async (game, session) => {
			if (!session.isStreamer) return;

			await this.dispose();
		});

		/**
		 * @event disconnect - When the user closes the game.
		 */
		this.registerEvent('disconnect', async (game, session) => {
			if (!session.isStreamer) return;

			await this.dispose();
		});
	}

	/**
	 * When a user connects to the game, send the current state.
	 *
	 * @param session
	 * @returns
	 */
	protected async onConnect(session: Session<Events>): Promise<void> {
		console.log(session.role, session.user.id, 'connected');
		if (session.isStreamer) {
			this.hostSession = session;
		}

		if (session.isGuest) {
			this.guestSession = session;
		}

		const state = await this.state.get();

		this.chatActions.restoreForSession(session);

		if (!state) {
			await this.state.set('initial', {
				invited: false,
			});
			return;
		} else {
			session.send('set-state', state.toJson());
		}
	}
}

function v4() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = (Math.random() * 16) | 0,
			v = c == 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

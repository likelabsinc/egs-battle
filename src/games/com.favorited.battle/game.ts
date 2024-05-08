import { Game, Session } from '@likelabsinc/egs-tools';
import { Events } from './lib/events';
import { State } from './lib/state';
import { Env } from '../../env/env';
import { FeedItem, StorageKeys, Target, TargetType, UserScores } from './lib/types';
import { Booster, DoubleScoreBooster, TripleScoreBooster } from './lib/boosters';

const kRoundDuration = 45 * 1000;
const kVictoryLapDuration = 12 * 1000;
const kTargetAnnouncementDelay = 5 * 1000;

export class Battle extends Game<Env, State, Events> {
	private hostSession: Session<Events> | null = null;
	private guestSession: Session<Events> | null = null;

	private boosterTimer: number | null = null;
	private boosterDelayTimer: number | null = null;

	private activeBooster: Booster | null = null;

	private winStreaks: {
		host: number;
		guest: number;
	} = {
		host: 0,
		guest: 0,
	};

	private getLeaderboard = async () => {
		const userContributions: UserScores = await this.storage.get(StorageKeys.UserContributions);
		const hostLeaderboard = Object.values(userContributions.host)
			.sort((a, b) => b.score - a.score)
			.splice(0, 3);
		const guestLeaderboard = Object.values(userContributions.guest)
			.sort((a, b) => b.score - a.score)
			.splice(0, 3);

		return {
			host: hostLeaderboard,
			guest: guestLeaderboard,
		};
	};

	/// Debug method to start the booster
	private scheduleBooster = () => {
		this.boosterDelayTimer = setTimeout(async () => {
			const state = await this.state.get();

			if (state.state === 'round') {
				if (!this.activeBooster) {
					this.activeBooster = new DoubleScoreBooster('x2 value');

					this.hostSession?.sendToChannel('update-booster', this.activeBooster);

					this.updateState('round', {
						booster: this.activeBooster,
					});

					this.boosterTimer = setTimeout(async () => {
						const state = await this.state.get();

						if (state.state === 'round') {
							this.hostSession?.sendToChannel('update-booster', null);

							this.updateState('round', {
								booster: null,
							});
						}

						this.disposeBooster();
					}, 15000);
				}
			}
		}, kRoundDuration - 30000);
	};

	private async updateState<T extends keyof State>(state: T, data: Partial<State[T]>, sync = false) {
		const currentState = await this.state.get();

		if (currentState.state === state) {
			await this.storage.set('state', {
				state: state,
				data: {
					...(currentState.data as unknown as State[T]),
					...data,
				},
			});

			if (sync) {
				this.syncState();
			}
		} else {
			console.log('state is not', state);
		}
	}

	private async syncState() {
		const state = await this.state.get();

		this.hostSession?.sendToChannel('set-state', state.toJson());
	}

	/// Updating the user contribution
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

	/// Getting the win streaks
	private getStreaks = async () => {
		if (!this.hostSession || !this.guestSession) {
			return {
				host: 0,
				guest: 0,
			};
		}

		const hostStreak = await this.env.winStreaks.get(this.hostSession?.user.id);
		const guestStreak = await this.env.winStreaks.get(this.guestSession?.user.id);

		return {
			host: hostStreak ? parseInt(hostStreak) : 0,
			guest: guestStreak ? parseInt(guestStreak) : 0,
		};
	};
	/// Getting the user by the user id
	private getUserById = (userId: string) => this.connectedSessions.find((session) => session.user.id == userId)?.user;

	/// Start the game
	private startGame = async () => {
		this.winStreaks = await this.getStreaks();

		this.scheduleBooster();

		setTimeout(async () => {
			this.createTarget({
				title: 'reach 2, get x3',
				targetValue: 2,
				currentValue: 0,
				endsAt: new Date(Date.now() + 10000),
				booster: new TripleScoreBooster('x3 value'),
				type: TargetType.uniqueUsers,
			});
		}, 5000);

		await this.storage.set(StorageKeys.Scores, { host: 0, guest: 0 });
		await this.storage.set(StorageKeys.UserContributions, { host: {}, guest: {} });

		const state = await this.state.get();
		const feed = (await this.storage.get(StorageKeys.Feed)) ?? [];

		console.log(state);
		console.log(feed);

		this.state.set('round', {
			scores: {
				host: 0,
				guest: 0,
			},
			winStreaks: this.winStreaks,
			leaderboard: {
				host: [],
				guest: [],
			},
			target: null,
			booster: null,
			announcement: null,
			endsAt: new Date(Date.now() + kRoundDuration),
			winner: null,
			isFinished: false,
			feed,
		});

		this.storage.setAlarm(async () => {
			/// round end
			const scores: {
				host: number;
				guest: number;
			} = await this.storage.get(StorageKeys.Scores);

			const state = await this.state.get();
			const winner = scores.host > scores.guest ? 'host' : scores.host < scores.guest ? 'guest' : 'draw';

			if (winner === 'host') {
				await this.env.winStreaks.put(this.hostSession!.user.id, (this.winStreaks.host + 1).toString());
				await this.env.winStreaks.put(this.guestSession!.user.id, '0');
			}

			if (winner === 'guest') {
				await this.env.winStreaks.put(this.guestSession!.user.id, (this.winStreaks.guest + 1).toString());
				await this.env.winStreaks.put(this.hostSession!.user.id, '0');
			}

			this.state.set('round', {
				...(state.data as unknown as State['round']),
				winner: winner,
				isFinished: true,
				winStreaks: await this.getStreaks(),
				endsAt: new Date(Date.now() + kVictoryLapDuration),
			});

			this.addFeedItem(
				this.buildFeedItem({
					username: winner === 'draw' ? undefined : winner == 'host' ? this.hostSession?.user.username : this.guestSession?.user.username,
					body: winner == 'draw' ? 'It`s draw!' : `won this round!`,
				})
			);
		}, kRoundDuration);
	};

	private async handleTargetUpdates(
		user: Session.User | Game.SystemNotification.User,
		valueContributed: number
	): Promise<Partial<State['round']> | undefined> {
		const state = await this.state.get();

		if (state.state !== 'round') {
			return;
		}

		const target = (state.data as State['round']).target!;

		switch (target.type) {
			case TargetType.score:
				target.currentValue += valueContributed;

				break;
			case TargetType.uniqueUsers:
				const usersContributed: string[] = (await this.storage.get('target-users-contributed')) ?? [];

				if (!usersContributed.includes(user.id)) {
					usersContributed.push(user.id);
					await this.storage.set('target-users-contributed', usersContributed);

					target.currentValue += 1;
				} else {
					return;
				}

				break;
		}

		if (target.currentValue >= target.targetValue) {
			this.activeBooster = target.booster;
			this.activeBooster.endsAt = new Date(Date.now() + this.activeBooster.durationInMs);

			return {
				target: null,
				booster: this.activeBooster,
			};
		} else {
			return {
				target: target,
			};
		}
	}

	private async createTarget(target: Target) {
		this.hostSession?.sendToChannel('announce-target', {
			text: target.title,
			trailingText: '10s',
		});

		this.updateState('round', {
			announcement: {
				text: target.title,
				trailingText: '10s',
			},
		});

		target.endsAt = new Date(target.endsAt.getTime() + kTargetAnnouncementDelay);

		setTimeout(async () => {
			await this.updateState(
				'round',
				{
					target,
				},
				true
			);

			setTimeout(async () => {
				this.updateState(
					'round',
					{
						target: null,
					},
					true
				);

				await this.storage.set('target-users-contributed', []);
			}, target.endsAt.getTime() - Date.now());
		}, kTargetAnnouncementDelay);
	}

	private async addFeedItem(item: FeedItem) {
		const state = await this.state.get();
		const feed = (await this.storage.get(StorageKeys.Feed)) ?? [];

		feed.push(item);

		await this.storage.set(StorageKeys.Feed, feed);

		await this.state.set('round', {
			...(state.data as unknown as State['round']),
			feed: feed,
		});
	}

	private buildFeedItem(data: Partial<FeedItem>): FeedItem {
		return {
			username: data.username ?? null,
			body: data.body ?? '',
			createdAt: new Date(),
			textColor: data.textColor ?? '#ffffff',
			usernameColor: data.usernameColor ?? '#cacaca',
			iconImageUrl: data.iconImageUrl ?? '',
			iconBackgroundColor: data.iconBackgroundColor ?? '#BEBEBE',
			iconColor: data.iconColor ?? '#ffffff',
		};
	}

	protected registerEvents(): void {
		this.registerGlobalEvent('system-notification', async (game, data) => {
			if (data.type != 'gift') {
				return;
			}

			/// Setting the type of the body to the type of the gift
			const body = data.data as Game.SystemNotification.Body['gift'];

			const state = await this.state.get();

			/// Checking if the state is in the round
			if (state.state == 'round') {
				if ((state.data as State['round']).isFinished) {
					return;
				}
			}

			/// Getting the scores from the storage
			const scores: {
				host: number;
				guest: number;
			} = await this.storage.get(StorageKeys.Scores);

			/// Getting the value of the gift
			///
			/// If there is an active booster, the value of the gift is modified by the modifier function of the active booster
			const value = this.activeBooster ? this.activeBooster.modifierFunction(body.value) : body.value;

			/// Checking if the user who sent the gift is the host
			if (body.livestream.userId == this.hostSession?.user.id) {
				scores.host += value;
			}

			/// Checking if the user who sent the gift is the guest
			if (body.livestream.userId == this.guestSession?.user.id) {
				scores.guest += value;
			}

			this.hostSession?.sendToChannel('update-scores', scores);

			await this.storage.set(StorageKeys.Scores, scores);

			/// Updating the user contribution
			await this.updateUserContribution(body.user.id, value, body.livestream.userId == this.hostSession?.user.id ? 'host' : 'guest');

			await this.addFeedItem(
				this.buildFeedItem({
					username: body.user.username,
					body: `sent a ${body.gift.name} ${body.quantity > 1 ? `x${body.quantity}` : ''}`,
				})
			);

			let targetUpdates: Partial<State['round']> | undefined = undefined;

			if ((state.data as State['round']).target) {
				targetUpdates = await this.handleTargetUpdates(body.user, value);
			}

			await this.updateState(
				'round',
				{
					scores: scores,
					leaderboard: await this.getLeaderboard(),
					...(targetUpdates ?? {}),
				},
				true
			);
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

		this.registerEvent('streamer-start', async (game, session) => {
			if (!session.isStreamer) return;

			this.startGame();
		});

		/**
		 * @event streamer-restart - When the streamer restarts the game.
		 */
		this.registerEvent('streamer-restart', async (game, session) => {
			if (!session.isStreamer) return;

			this.disposeBooster();

			this.storage.cancelAlarm();

			this.storage.delete(StorageKeys.Scores);
			this.storage.delete(StorageKeys.UserContributions);

			this.startGame();
		});

		/**
		 * @event bloc.close - When the user closes the game.
		 */
		this.registerEvent('bloc.close', async (game, session) => {
			if (!session.isStreamer) return;

			await this.dispose();

			this.disposeBooster();
		});

		/**
		 * @event disconnect - When the user closes the game.
		 */
		this.registerEvent('disconnect', async (game, session) => {
			if (!session.isStreamer) return;

			await this.dispose();

			this.disposeBooster();
		});
	}

	private async disposeBooster() {
		if (this.boosterTimer) clearTimeout(this.boosterTimer!);
		if (this.boosterDelayTimer) clearTimeout(this.boosterDelayTimer!);

		this.activeBooster = null;
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

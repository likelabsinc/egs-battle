import { Game, Session } from '@likelabsinc/egs-tools';
import { Events } from './lib/events';
import { State } from './lib/state';
import { Env } from '../../env/env';
import { Announcement, FeedItem, Side, StorageKeys, Target, TargetType, UserScores } from './lib/types';
import { Booster, DoubleScoreBooster, TripleScoreBooster } from './lib/boosters';
import { TimerController } from './lib/timer_controller';

const kRoundDuration = 45 * 1000;
const kVictoryLapDuration = 12 * 1000;

export class Battle extends Game<Env, State, Events> {
	private timerController: TimerController = new TimerController();

	private hostSession: Session<Events> | null = null;
	private guestSession: Session<Events> | null = null;

	private boosterTimer: number | null = null;
	private boosterDelayTimer: number | null = null;

	private activeBoosters: {
		host: Booster | null;
		guest: Booster | null;
	} = {
		host: null,
		guest: null,
	};

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

	/**
	 * Get the user by the user id
	 *
	 * @param userId
	 * @returns Session.User
	 */
	private getUserById = (userId: string) => this.connectedSessions.find((session) => session.user.id == userId)?.user;

	/**
	 * Get a scheduled booster
	 *
	 * 90% chance to get a x2 booster
	 * 10% chance to get a x3 booster
	 *
	 * @returns Booster
	 */
	private getScheduledBooster = async () => (Math.random() > 0.1 ? new DoubleScoreBooster('x2 value') : new TripleScoreBooster('x3 value'));

	private startBoosterSchedule = async (delayInMs: number) => {
		/// TODO: Implement the booster schedule

		this.timerController.addTimer({
			id: 'target-delay',
			durationMs: delayInMs,
			callback: async () => {
				this.createAnnouncement({
					announcement: {
						text: 'speed challenge',
						durationMs: 3000,

						trailingText: '30s',
					},
					side: Side.both,
					onAnnouncementEnd: async () => {
						this.createAnnouncement({
							announcement: {
								text: 'reaching the target will 2x team points',
								durationMs: 3000,
							},
							side: Side.both,
							onAnnouncementEnd: async () => {
								///
								/// TODO: figure out the logic of showing value or gifter challenge
								///
								this.createTarget(
									{
										title: 'speed challenge',
										type: TargetType.score,
										// targetValue: Math.max(500, this.connectedSessions.length * 10 + 200),
										targetValue: 5,
										currentValue: 0,
										endsAt: new Date(Date.now() + 15000),
										booster: await this.getScheduledBooster(),
									},
									Side.both
								);

								// this.createTarget(
								// 	{
								// 		title: 'gifter challenge',
								// 		type: TargetType.uniqueUsers,
								// 		targetValue: Math.max(2, Math.floor(this.connectedSessions.length / 5)),
								// 		currentValue: 0,
								// 		endsAt: new Date(Date.now() + 40000),
								// 		booster: await this.getScheduledBooster(),
								// 	},
								// 	Side.both
								// );
							},
						});
					},
				});
			},
		});
	};

	/**
	 * Start the game
	 *
	 * @returns void
	 */
	private startGame = async () => {
		this.winStreaks = await this.getStreaks();

		/// random between 60000 (4m left) and 150000 (2.5m left)
		// this.startBoosterSchedule(Math.random() * 90000 + 60000);
		this.startBoosterSchedule(Math.random() * 2000);

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
			target: {
				host: null,
				guest: null,
			},
			booster: {
				host: null,
				guest: null,
			},
			announcement: {
				host: null,
				guest: null,
			},
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

	private async handleTargetUpdates(args: {
		user: Session.User | Game.SystemNotification.User;
		side: Side;
		valueContributed: number;
	}): Promise<Partial<State['round']> | undefined> {
		if (args.side == Side.both) {
			console.error('Error in handling target updates. Side is Side.both - you can`t contribute to both sides');

			return;
		}

		const state = await this.getStateOrNull('round');

		if (!state) {
			return {};
		}

		const target = state.target![args.side];

		this.addFeedItem(
			this.buildFeedItem({
				username: args.user.username,
				body: `contributed ${args.valueContributed} to the ${args.side} target: ${target?.currentValue}/${target?.targetValue}`,
			})
		);

		if (!target) {
			return;
		}

		switch (target.type) {
			case TargetType.score:
				target.currentValue += args.valueContributed;

				break;
			case TargetType.uniqueUsers:
				const usersContributed: string[] = (await this.storage.get(args.side + '-target-users-contributed')) ?? [];

				if (!usersContributed.includes(args.user.id)) {
					usersContributed.push(args.user.id);
					await this.storage.set(args.side + '-target-users-contributed', usersContributed);

					target.currentValue += 1;
				} else {
					return;
				}

				break;
		}

		if (target.currentValue >= target.targetValue) {
			switch (args.side) {
				case Side.host:
					/// Saving target object to apply booster after the target ends
					await this.storage.set('host-target', { ...target });

					/// Checking if the guest target is reached
					if (await this.storage.get('guest-target')) {
						this.timerController.invokeEarly('guest-target-end');
						this.timerController.invokeEarly('host-target-end');

						return {};
					} else {
						return {
							target: {
								host: null,
								guest: state.target?.guest,
							},
							// booster: this.activeBoosters,
							announcement: {
								host: {
									text: 'target reached',
									durationMs: 30000,
								},
								guest: state.announcement?.guest ?? null,
							},
						};
					}
				case Side.guest:
					/// Saving target object to apply booster after the target ends
					await this.storage.set('guest-target', { ...target });

					/// Checking if the host target is reached
					if (await this.storage.get('host-target')) {
						this.timerController.invokeEarly('guest-target-end');
						this.timerController.invokeEarly('host-target-end');

						return {};
					} else {
						return {
							target: {
								host: state.target?.host,
								guest: null,
							},
							// booster: this.activeBoosters,
							announcement: {
								host: state.announcement?.host ?? null,
								guest: {
									text: 'target reached',
									durationMs: 30000,
								},
							},
						};
					}
				default:
					return {};
			}
		} else {
			switch (args.side) {
				case Side.host:
					this.addFeedItem(
						this.buildFeedItem({
							username: args.user.username,
							body: `serving results to the ${args.side} target: ${target.currentValue}/${target.targetValue}`,
						})
					);

					return {
						target: {
							host: target,
							guest: state.target?.guest,
						},
					};
				case Side.guest:
					this.addFeedItem(
						this.buildFeedItem({
							username: args.user.username,
							body: `serving results to the ${args.side} target: ${target.currentValue}/${target.targetValue}`,
						})
					);

					return {
						target: {
							host: state.target?.host,
							guest: target,
						},
					};
				default:
					return {};
			}
		}
	}

	/**
	 * Get the state DATA if it is the same as the state provided
	 * Otherwise, return null
	 *
	 * @param state
	 * @returns
	 */
	private async getStateOrNull<T extends keyof State>(state: T): Promise<State[T] | null> {
		const currentState = await this.state.get();

		if (currentState.state === state) {
			return currentState.data as State[T];
		}

		return null;
	}

	/**
	 * Create an announcement for the host or guest or both
	 *
	 * If the announcement is for both, the announcement will be displayed for both users
	 *
	 * If the announcement is for the host or guest, the announcement will be displayed for the user
	 *
	 * The announcement will be displayed for the duration of the kTargetAnnouncementDelay
	 *
	 * If the onAnnouncementEnd callback is provided, it will be called after the announcement ends
	 *
	 * @param announcement
	 * @param side
	 * @param onAnnouncementEnd
	 * @returns
	 */
	private async createAnnouncement(args: { announcement: Announcement; side: Side; onAnnouncementEnd?: () => void }) {
		const state = await this.getStateOrNull('round');

		if (!state) {
			return;
		}

		switch (args.side) {
			case Side.host:
				this.hostSession?.sendToChannel('announce-target', {
					host: args.announcement,
				});

				await this.updateState('round', {
					announcement: {
						host: args.announcement,
						guest: state.announcement?.guest ?? null,
					},
				});

				this.timerController.addTimer({
					id: 'host-announcement-end',
					durationMs: args.announcement.durationMs,
					callback: async () => {
						const state = await this.getStateOrNull('round');

						if (!state) {
							return;
						}

						await this.updateState(
							'round',
							{
								announcement: {
									host: null,
									guest: state.announcement?.guest ?? null,
								},
							},
							true
						);

						if (args.onAnnouncementEnd) {
							args.onAnnouncementEnd();
						}
					},
				});

				break;
			case Side.guest:
				this.guestSession?.sendToChannel('announce-target', {
					guest: args.announcement,
				});

				await this.updateState('round', {
					announcement: {
						host: state.announcement?.host ?? null,
						guest: args.announcement,
					},
				});

				this.timerController.addTimer({
					id: 'guest-announcement-end',
					durationMs: args.announcement.durationMs,
					callback: async () => {
						const state = await this.getStateOrNull('round');

						if (!state) {
							return;
						}

						await this.updateState(
							'round',
							{
								announcement: {
									host: state.announcement?.host ?? null,
									guest: null,
								},
							},
							true
						);

						if (args.onAnnouncementEnd) {
							args.onAnnouncementEnd();
						}
					},
				});

				break;
			case Side.both:
				this.hostSession?.sendToChannel('announce-target', {
					host: args.announcement,
					guest: args.announcement,
				});

				await this.updateState('round', {
					announcement: {
						host: args.announcement,
						guest: args.announcement,
					},
				});

				this.timerController.addTimer({
					id: 'both-announcement-end',
					durationMs: args.announcement.durationMs,
					callback: async () => {
						const state = await this.getStateOrNull('round');

						if (!state) {
							return;
						}

						await this.updateState(
							'round',
							{
								announcement: {
									host: null,
									guest: null,
								},
							},
							true
						);

						if (args.onAnnouncementEnd) {
							args.onAnnouncementEnd();
						}
					},
				});

				break;
		}
	}

	/**
	 * Create a target for the host or guest or both
	 *
	 * @param target
	 * @param side
	 */
	private async createTarget(target: Target, side: Side = Side.both) {
		/// We need to change the endsAt date to be the current date + the delay
		/// Because endTime specifies the time when the target object created, but
		/// target will be displayed after the announcement delay.
		const state = await this.getStateOrNull('round');

		if (!state) {
			return;
		}

		switch (side) {
			case Side.host:
				await this.storage.set('host-score-before-target', state.scores.host);

				await this.updateState(
					'round',
					{
						target: {
							host: target,
							guest: state.target?.guest ?? null,
						},
					},
					true
				);

				this.timerController.addTimer({
					id: 'host-target-end',
					durationMs: target.endsAt.getTime() - Date.now(),
					callback: async () => {
						const target: Target = await this.storage.get('host-target');
						const state = await this.getStateOrNull('round');

						if (!state) {
							return;
						}

						if (!target) {
							await this.updateState(
								'round',
								{
									target: {
										host: null,
										guest: state.target.guest ?? null,
									},
									announcement: {
										host: null,
										guest: state.announcement.guest,
									},
									booster: this.activeBoosters,
								},
								true
							);
						}

						if (target?.currentValue && target?.targetValue) {
							const hasReached = target?.currentValue >= target?.targetValue;

							if (hasReached) {
								this.activeBoosters.host = target?.booster;
								this.activeBoosters.host!.endsAt = new Date(Date.now() + this.activeBoosters.host!.durationInMs);

								const pointsBeforeBooster = state.scores.host;

								this.createBooster(this.activeBoosters.host!, Side.host, async () => {
									const scores: {
										host: number;
										guest: number;
									} = await this.storage.get(StorageKeys.Scores);
									const state = await this.getStateOrNull('round');

									const pointsEarnedDuringBoost = scores.host - pointsBeforeBooster;
									const announcement = {
										text: 'total match points: ',
										durationMs: 5000,
										trailingText: pointsEarnedDuringBoost.toString(),
									};

									await this.updateState(
										'round',
										{
											announcement: {
												host: announcement,
												guest: state?.announcement.guest ?? null,
											},
										},
										true
									);
								});
							}
						}
					},
				});
				break;
			case Side.guest:
				await this.storage.set('guest-score-before-target', state.scores.host);

				await this.updateState(
					'round',
					{
						target: {
							host: state.target?.host ?? null,
							guest: target,
						},
					},
					true
				);

				this.timerController.addTimer({
					id: 'guest-target-end',
					durationMs: target.endsAt.getTime() - Date.now(),
					callback: async () => {
						const target: Target = await this.storage.get('guest-target');
						const state = await this.getStateOrNull('round');

						if (!state) {
							return;
						}

						/// Checking if the target is null, if null - target not reached
						if (!target) {
							await this.updateState(
								'round',
								{
									target: {
										host: state.target.host ?? null,
										guest: null,
									},
									announcement: {
										host: state.announcement.host,
										guest: null,
									},
									booster: this.activeBoosters,
								},
								true
							);
						}

						if (target?.currentValue && target?.targetValue) {
							const hasReached = target?.currentValue >= target?.targetValue;

							this.addFeedItem(
								this.buildFeedItem({
									username: 'system',
									body: `guest target reached: ${hasReached} ${target.currentValue}/${target.targetValue}`,
								})
							);

							if (hasReached) {
								this.activeBoosters.guest = target?.booster;
								this.activeBoosters.guest!.endsAt = new Date(Date.now() + this.activeBoosters.guest!.durationInMs);

								const pointsBeforeBooster = state.scores.guest;

								this.createBooster(this.activeBoosters.guest!, Side.guest, async () => {
									const scores: {
										host: number;
										guest: number;
									} = await this.storage.get(StorageKeys.Scores);
									const state = await this.getStateOrNull('round');

									const pointsEarnedDuringBoost = scores.guest - pointsBeforeBooster;
									const announcement = {
										text: 'total match points: ',
										durationMs: 5000,
										trailingText: pointsEarnedDuringBoost.toString(),
									};

									await this.updateState(
										'round',
										{
											announcement: {
												host: state?.announcement.host ?? null,
												guest: announcement,
											},
										},
										true
									);
								});
							}
						}
					},
				});

				break;
			case Side.both:
				await this.createTarget({ ...target }, Side.host);
				await this.createTarget({ ...target }, Side.guest);

				break;
		}
	}

	private async createBooster(booster: Booster, side: Side, onBoosterEnd?: () => void) {
		const state = await this.getStateOrNull('round');

		if (!state) {
			return;
		}

		switch (side) {
			case Side.host:
				await this.updateState('round', {
					booster: {
						host: booster,
						guest: state.booster.guest,
					},
				});

				this.timerController.addTimer({
					id: 'host-booster-end',
					durationMs: booster.durationInMs,
					callback: async () => {
						await this.updateState('round', {
							announcement: {
								host: null,
								guest: state.announcement.guest,
							},
							booster: {
								host: null,
								guest: state.booster.guest,
							},
						});

						if (onBoosterEnd) onBoosterEnd();
					},
				});

				break;
			case Side.guest:
				await this.updateState('round', {
					announcement: {
						host: state.announcement.host,
						guest: null,
					},
					booster: {
						host: state.booster.host,
						guest: booster,
					},
				});

				this.timerController.addTimer({
					id: 'guest-booster-end',
					durationMs: booster.durationInMs,
					callback: async () => {
						await this.updateState('round', {
							booster: {
								host: state.booster.host,
								guest: null,
							},
						});

						if (onBoosterEnd) onBoosterEnd();
					},
				});

				break;
			case Side.both:
				await this.createBooster({ ...booster }, Side.host, onBoosterEnd);
				await this.createBooster({ ...booster }, Side.guest, onBoosterEnd);

				break;
		}
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
			const side = body.livestream.userId == this.hostSession?.user.id ? Side.host : Side.guest;

			this.addFeedItem(
				this.buildFeedItem({
					username: body.user.username,
					body: `sent gift to the ${side} team, ${body.livestream.userId} ${this.hostSession?.user.id}`,
				})
			);

			const state = await this.getStateOrNull('round');

			/// Checking if the state is in the round
			if (!state || state.isFinished) {
				return;
			}

			/// Getting the scores from the storage
			const scores: {
				host: number;
				guest: number;
			} = await this.storage.get(StorageKeys.Scores);

			/// Getting the value of the gift
			///
			/// If there is an active booster, the value of the gift is modified by the modifier function of the active booster
			const value = this.activeBoosters[side] ? this.activeBoosters[side]!.modifierFunction(body.value) : body.value;

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

			if (state.target) {
				targetUpdates = await this.handleTargetUpdates({ user: body.user, side, valueContributed: value });

				this.addFeedItem(
					this.buildFeedItem({
						username: body.user.username,
						body: JSON.stringify(targetUpdates),
					})
				);
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
			this.timerController.clear();

			this.storage.clear();

			this.startGame();
		});

		/**
		 * @event bloc.close - When the user closes the game.
		 */
		this.registerEvent('bloc.close', async (game, session) => {
			if (!session.isStreamer) return;
			await this.resetGame();

			await this.dispose();
		});

		/**
		 * @event disconnect - When the user closes the game.
		 */
		this.registerEvent('disconnect', async (game, session) => {
			if (!session.isStreamer) return;
			await this.resetGame();

			await this.dispose();
		});
	}

	private async resetGame() {
		try {
			this.timerController.clear();
			this.disposeBooster();

			await this.state.set('initial', {
				invited: false,
			});
		} catch (e) {
			this.addFeedItem(
				this.buildFeedItem({
					username: 'system',
					body: JSON.stringify(e),
				})
			);
		}
	}

	private async disposeBooster() {
		if (this.boosterTimer) clearTimeout(this.boosterTimer!);
		if (this.boosterDelayTimer) clearTimeout(this.boosterDelayTimer!);

		this.activeBoosters = {
			host: null,
			guest: null,
		};
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

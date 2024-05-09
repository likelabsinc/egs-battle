export class TimerController {
	private timers: Map<
		String,
		{
			timerId: number;
			callback: () => void;
		}
	> = new Map<
		String,
		{
			timerId: number;
			callback: () => void;
		}
	>();

	constructor() {}

	addTimer(args: { id: string; durationMs: number; callback: () => void }) {
		if (this.timers.has(args.id)) {
			clearTimeout(this.timers.get(args.id)!.timerId);
		}

		this.timers.set(args.id, {
			timerId: setTimeout(args.callback, args.durationMs),
			callback: args.callback,
		});

		/// remove timer from map after durationMs
		this.timers.set(args.id + '-cleaner', {
			timerId: setTimeout(() => {
				this.timers.delete(args.id);
			}, args.durationMs),
			callback: () => this.timers.delete(args.id),
		});
	}

	isActive(id: string) {
		return this.timers.has(id);
	}

	removeTimer(id: string) {
		if (this.timers.has(id)) {
			clearTimeout(this.timers.get(id)!.timerId);

			this.timers.delete(id);
		}
	}

	invokeEarly(id: string) {
		if (this.timers.has(id)) {
			clearTimeout(this.timers.get(id)!.timerId);

			this.timers.get(id)!.callback();

			this.timers.delete(id);
		}
	}

	clear() {
		this.timers.forEach((timer) => clearTimeout(timer.timerId));

		this.timers.clear();
	}
}

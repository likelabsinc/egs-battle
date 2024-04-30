import { Env } from './env/env';
import { DurableObjects } from '@likelabsinc/egs-tools';
import { Battle } from './games/com.favorited.battle/game';

export default DurableObjects.Game.Exported;

export class Game extends DurableObjects.Game<Battle, Env> {
	protected game = Battle;
}

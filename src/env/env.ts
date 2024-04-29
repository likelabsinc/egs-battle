import { DefaultEnv } from '@likelabsinc/egs-tools';

export interface Env extends DefaultEnv {
	// insert additional properties here
	hiveCache: KVNamespace;
	userBlacklist: KVNamespace;
	winStreaks: KVNamespace;
	HIVE_TOKEN: string;
}

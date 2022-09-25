import { global_constants } from 'utility/constants.js';
import { read_data_file } from 'data/file.js';

const {
    scripts,
} = global_constants();

const {
	nukeServers,
	loopServers,
	purchaseServers,
	purchaseHacknets,
} = scripts;

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
	ns.enableLog("run");

	let previousHacking = 0;
	let previousServers = 0;
	let previousPurchasedServers = 0;

	while (true) {
		const stats = read_data_file(ns, "stats");
        const purchasing = {
            servers: read_data_file(ns, "purchase-servers"),
            hacknets: read_data_file(ns, "purchase-hacknets"),
        };
        const loopWGH = read_data_file(ns, "loop-wgh");

        let hacking = ns.getHackingLevel();
		let servers = stats.servers;
		let purchasedServers = stats.purchasedServers;

		let active = false;

		if (previousHacking===0 || Math.floor(previousHacking / 10) != Math.floor(hacking / 10)) {
			active = ns.run(nukeServers, 1);
		}

		if (servers != previousServers) {
			if (!ns.isRunning(loopServers, "home")) active = ns.run(loopServers, 1, loopWGH.target);
		}

		if (purchasing.servers.enabled) {
			if (!ns.isRunning(purchaseServers, "home", "--auto")) active = ns.run(purchaseServers, 1, "--auto");
		}

		if (purchasing.hacknets.enabled) {
			if (!ns.isRunning(purchaseHacknets, "home", "--auto")) active = ns.run(purchaseHacknets, 1, "--auto");
		}

		previousHacking = hacking;
		previousServers = servers;
		previousPurchasedServers = purchasedServers;

        if (active) ns.print(new Date().toLocaleString());
		await ns.sleep(1000 * 10); 
	}
}

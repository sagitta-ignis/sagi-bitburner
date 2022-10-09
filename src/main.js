import { global_constants } from 'utility/constants.js';
import { read_data_file } from 'data/file.js';

const {
    scripts,
	programs,
} = global_constants();

const {
	nukeServers,
	loopServers,
	scheduleHWGW,
	purchaseServers,
	purchaseHacknets,
	installBackdoor,
	addPrograms,
} = scripts;

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
	ns.enableLog("run");

	let previousPrograms = 0;
	let previousHacking = 0;
	let previousServers = 0;
	let previousPurchasedServers = 0;

	/** @type {Map<string, number>} */
	const processes = new Map();

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

		if (stats.programs < programs.length) {
			if (!ns.isRunning(addPrograms, "home")) active = ns.run(addPrograms);
		}
		if (previousHacking != hacking || previousPrograms != stats.programs) {
			if (!ns.isRunning(nukeServers, "home")) active = ns.run(nukeServers);
			if (!ns.isRunning(installBackdoor, "home")) active = ns.run(installBackdoor);
		}
		if (servers != previousServers) {
			if (!ns.isRunning(installBackdoor, "home")) active = ns.run(installBackdoor);
		}

		if ((processes.has(scheduleHWGW) && !ns.isRunning(processes.get(scheduleHWGW))) || !ns.isRunning(scheduleHWGW)) {
			processes.set(scheduleHWGW, active = ns.run(scheduleHWGW));
		}

		if (purchasing.servers.enabled) {
			if (!ns.isRunning(purchaseServers, "home", "--auto")) active = ns.run(purchaseServers, 1, "--auto");
		}

		if (purchasing.hacknets.enabled) {
			if (!ns.isRunning(purchaseHacknets, "home", "--auto")) active = ns.run(purchaseHacknets, 1, "--auto");
		}

		previousPrograms = stats.programs;
		previousHacking = hacking;
		previousServers = servers;
		previousPurchasedServers = purchasedServers;

        if (active) ns.print(new Date().toLocaleString());
		await ns.sleep(1000 * 10); 
	}
}

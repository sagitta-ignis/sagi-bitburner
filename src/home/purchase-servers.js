import { global_constants  } from 'utility/constants.js';
import { read_data_file, update_data_file } from 'data/file.js';
import { list_servers } from 'opened_servers.js';

const { prices, purchasedServerPrefix } = global_constants();

/** @param {NS} ns */
export async function main(ns) {
	let configuration = read_data_file(ns, "purchase-servers");
	if (!configuration.args) configuration.args = { ram: 8 };
	const args = ns.flags([["help", false],["ram", configuration.args.ram],["auto",false],["disable",false]]);
	// How much RAM each purchased server will have. In this case, it'll
	// be 8GB.
	let ram = args.ram;
    if (args.help) {
        ns.tprint("This script tries to purchase a server with given/configured ram.");
        ns.tprint(`Usage: run ${ns.getScriptName()} [ram]`);
        ns.tprint("Example:");
        ns.tprint(`> run ${ns.getScriptName()} 512`);
        return;
    }
	if (args.ram != configuration.args.ram) {
		await update_data_file(ns, "purchase-servers", { args: { ram } });
	}

	if (ns.args.includes("--disable")) {
        await update_data_file(ns, "purchase-servers", { enabled: false });
		ns.toast(`${args.disable?'Stopped':'Started'} purchasing servers`, "warning");
		return;
	}
	if (args.auto)  {
		await update_data_file(ns, "purchase-servers", { enabled: true });
		ns.toast(`Started purchasing servers`, "warning");
	}
	ns.disableLog("scan");
	ns.disableLog("hasRootAccess");
	ns.disableLog("getServerUsedRam");
	ns.disableLog("killall");
	// Iterator we'll use for our loop
	let limit = ns.getPurchasedServerLimit();
	let purchasedServers;
	let currentRamServers;
	let sleeping = 1;

	// Continuously try to purchase servers until we've reached the maximum
	// amount of servers with maxed-out ram
	do {
		configuration = read_data_file(ns, "purchase-servers");
		let prices = getPurchasedServerPrices(ns);
		if (ram < 8 || !prices[ram]) {
			ns.tprint(`Wrong amount of RAM : ${ram}`);
			return;
		}
		let cost = ns.getPurchasedServerCost(ram);
		ns.print(`Purchasing servers with ${ram} GB RAM at ${ns.nFormat(cost, "$0.000a")}`);

		purchasedServers = list_servers(ns).filter(s => s.startsWith(purchasedServerPrefix));
		currentRamServers = purchasedServers.filter(s => s.endsWith("-" + ram));
		ns.print(`Purchased servers : ${purchasedServers.length}`);
		ns.print(`Current servers with ${ram} GB : ${currentRamServers.length}`);

		if (currentRamServers.length >= limit) break;

		await ns.sleep(sleeping);
		const money = ns.getServerMoneyAvailable("home");
		if (money < cost) {
			sleeping = 1000 * 60 * 1;
			continue;
		}
		sleeping = 1000;

		let replacedServer = null;
		let server = null;
		let purchasing = undefined;
		do {
            // define next server to purchase, and a server to upgrade (by replacing it) when limit is reached
			if (purchasedServers.length < limit) {
				server = purchasedServerPrefix + "-" + purchasedServers.length + "-" + ram;
				ns.print(`Trying to buy [${server}] for : ${cost}`);
			} else {
				replacedServer = purchasedServers.find(s => true);
				server = replacedServer.replace(/\-[0-9]+$/, `-${ram}`);
				ns.print(`Trying to replace [${replacedServer}] by [${server}] for : ${cost}`);
			}
			if (args.auto) {
				purchasing = true;
				break;
			}
            // (when not auto) confirm purchase or change ram to purchase
			const answer = await ns.prompt(`Purchase ${server} for ${ns.nFormat(cost, "$0.000a")} ?`, { type: "select", choices: ["Yes", "Change ram", "No"] });
			if (answer == "Change ram") {
				const choices = Object.entries(prices).filter(([ram, price]) => price <= money).map(([ram, price]) => ram);
				const changeTo = await ns.prompt(`Choose ram :`, { type: "select", choices: choices });
                if (changeTo == null) break;
				ram = Number.parseInt(changeTo);
                await update_data_file(ns, "purchase-servers", { args: { ram } });
				cost = prices[ram];
			} else {
				purchasing = answer == "Yes";
			}
		} while (purchasing === undefined);
		if (!purchasing) {
			if (!args.auto) return;
			await ns.sleep(1000 * 60);
			continue;
		}

		if (replacedServer && (args.auto || await ns.prompt(`Delete ${replacedServer} ?`, { type: "boolean" }))) {
			ns.disableLog("sleep");
			while(ns.getServerUsedRam(replacedServer) > 0) {
				ns.killall(replacedServer);
				await ns.sleep(5);
			}
			ns.enableLog("sleep");
			if (ns.deleteServer(replacedServer)) {
				ns.toast(`Deleted ${replacedServer}`, "warning");
				replacedServer = null;
			} else {
				ns.toast(`Failed to delete ${replacedServer}`, "error");
				await ns.sleep(1000);
			}
		}
		if (replacedServer) {
			if (!args.auto) return;
			await ns.sleep(1000 * 60);
			continue;
		}

		let hostname = ns.purchaseServer(server, ram);
		if (hostname) {
			ns.toast(`Purchased ${hostname}`, "success", 1000*60);

			const servers = list_servers(ns).filter(s => ns.hasRootAccess(s));
			purchasedServers = servers.filter(s => s.startsWith(purchasedServerPrefix));
			currentRamServers = purchasedServers.filter(s => s.endsWith("-" + ram));

            await update_data_file(ns, "stats", { servers: servers.length, purchasedServers: purchasedServers.length });

			ns.print(`Purchased servers : ${purchasedServers.length}`);
			ns.print(`Current servers with ${ram} GB : ${currentRamServers.length}`);
		} else {
			ns.toast(`Failed to purchase ${server}`, "error");
			await ns.sleep(1000);
		}
		if (!args.auto) return;
        configuration = read_data_file(ns, "purchase-servers");
        if (!configuration.enabled) {
			ns.toast(`Stopped purchasing servers`, "warning");
			return;
		}
		await ns.sleep(1000 * 60);
	} while(currentRamServers.length < limit);

	if (currentRamServers.length >= limit) {
		ram = ram * 2;
		if (prices[ram]) await update_data_file(ns, "purchase-servers", { args: { ram } });
		else {
			ns.toast(`Purchased servers are maxed out`, "success", 1000*60);
			await update_data_file(ns, "purchase-servers", { enabled: false });
		}
	}
}

/**
 *  @param {AutocompleteData} data
 *  @param {string[]} args
 */
export function autocomplete(data, args) {
    return Object.keys(prices);
}

/** @param {NS} ns */
function getPurchasedServerPrices(ns) {
	const prices = {};
	for (let i = 1; i <= 20; i++) {
		prices[`${Math.pow(2, i)}`] = ns.getPurchasedServerCost(Math.pow(2, i));
	}
	return prices;
}

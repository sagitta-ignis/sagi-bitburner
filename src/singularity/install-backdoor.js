import { list_servers } from 'opened_servers.js';
import { recursiveScan } from 'find_server.js';
import { analyze_server } from 'analyze_server.js';

/**
 * @param {NS} ns
 * @param {string} server
 * @return {Promise<string[]>}
 */
async function install_backdoor(ns, server) {
	let servers = [];
	let route = [];
	recursiveScan(ns, '', 'home', server, route);
	let start = undefined;
	route = route.reduceRight((path, node) => {
		if (start) return path;
		if (!ns.getServer(node).backdoorInstalled) {
			path.unshift(node);
		} else {
			start = node;
		}
		return path;
	}, []);
	if (start) route.unshift(start);
	ns.print(`Reaching ${server} by route : ${route.join(' -> ')}`);
	ns.singularity.connect("home");
	const hacking = ns.getHackingLevel();
	for (let node of route) {
		if(!ns.singularity.connect(node)) {
			ns.print(`Cannot reach ${server} because of ${node} not connecting`);
			return servers;
		}
		if (canBackdoor(ns, node, hacking)) {
			await ns.singularity.installBackdoor();
			servers.push(node);
		} else if (node === server) {
			ns.print(`Cannot install backdoor ${server} because of missing requirements (root acess, hacking skill)`);
		}
	}
	ns.singularity.connect("home");
	return servers;
}

/**
 * @param {NS} ns
 * @param {string} server
 * @param {number} playerSkill
 */
function canBackdoor(ns, hostname, playerSkill) {
	const server = ns.getServer(hostname);
	return !server.backdoorInstalled && server.hasAdminRights && playerSkill >= server.requiredHackingSkill;
}

/** @param {NS} ns */
export async function main(ns) {
	const args = ns.flags([["help", false]]);
	const targets = args._.slice();
	if (args.help) {
		ns.tprint("This script runs installBackdoor() on given server.");
        ns.tprint("If none, iterate through every server with root access and required hacking skill.");
		ns.tprint(`Usage: run ${ns.getScriptName()} [...servers]`);
		ns.tprint("Example:");
		ns.tprint(`> run ${ns.getScriptName()} CSEC avmnite-02h`);
		return;
	}
	ns.disableLog("scan");
	ns.disableLog("hasRootAccess");
	ns.disableLog("getHackingLevel");
	let message = '';
	const hacking = ns.getHackingLevel();
	const servers = list_servers(ns)
		.filter(s => (targets.length === 0 || targets.includes(s)) && canBackdoor(ns, s, hacking));
	if (targets.length > 0 && servers.length != targets.length) {
		for (let target of targets) {
			if (!servers.includes(target)) {
				const tar = ns.getServer(target);
				if (tar.backdoorInstalled) {
					message = `Backdoor already installed on ${target}`;
				} else if (!tar.hasAdminRights) {
					message = `Backdoor requires root access on ${target}`;
				} else if (hacking < tar.requiredHackingSkill) {
					message = `Backdoor requires more hacking skill (${tar.requiredHackingSkill}) on ${target}`;
				}
				ns.print(message);
				ns.toast(message, "warning", 1000*10);
			}
		}
	}
	if (servers.length > 0) {
		message = `Trying to install backdoor on ${servers.length} servers`;
		ns.print(message+' :');
		ns.toast(message, "info", 1000*10);
		for (let s of servers) { ns.print(`	- ${s}`); }
	} else {
		message = `Nothing to install backdoor on`;
		ns.print(message);
		ns.toast(message, "warning", 1000*10);
		return;
	}
	let backdoors = 0;
	while (servers.length > 0) {
		let server = servers.shift();
		let nodes = await install_backdoor(ns, server);
		for (let node of nodes) { ns.toast(`Installed backdoor on ${node}`, "success", 1000*10); }
		backdoors += nodes.length;
	}
	if (backdoors > 0) {
		message = `Installed ${backdoors} backdoors`;
		ns.print(message);
		ns.toast(message, "info", 1000*10);		
	}
}

/**
 *  @param {AutocompleteData} data
 *  @param {string[]} args
 */
export function autocomplete(data, args) {
    return data.servers;
}
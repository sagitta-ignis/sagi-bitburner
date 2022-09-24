/** @param {NS} ns **/
export async function main(ns) {
	const args = ns.flags([["help", false]]);
	if (args.help || args._.length < 2) {
		ns.tprint("This script deploys another script on a server with maximum threads possible.");
		ns.tprint(`Usage: run ${ns.getScriptName()} HOST SCRIPT ARGUMENTS`);
		ns.tprint("Example:");
		ns.tprint(`> run ${ns.getScriptName()} n00dles basic_hack.js foodnstuff`);
		return;
	}

	const host = args._[0];
	const script = args._[1];
	const script_args = args._.slice(2);

	if (!ns.serverExists(host)) {
		ns.tprint(`Server '${host}' does not exist. Aborting.`);
		return;
	}
	if (!ns.ls(ns.getHostname()).find(f => f === script)) {
		ns.tprint(`Script '${script}' does not exist. Aborting.`);
		return;
	}

	const ram = ns.getScriptRam(script);
	const available = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
	const threads = Math.floor(available / ram);
	if (threads <= 0) {
		ns.tprint(`Server '${host}' requires more RAM (${available.toFixed(2)}/${ram}). Aborting.`);
		return;
	}
	ns.tprint(`Launching script '${script}' on server '${host}' with ${threads} threads and the following arguments: ${script_args}`);
	await ns.scp(script, host, ns.getHostname());
	ns.exec(script, host, threads, ...script_args);
}

/**
 *  @param {AutocompleteData} data
 *  @param {string[]} args
 */
export function autocomplete(data, args) {
	if (args.length === 0 || !data.servers.includes(args[0])) return data.servers;
	if (args.length >= 1) return data.scripts;
    return [];
}
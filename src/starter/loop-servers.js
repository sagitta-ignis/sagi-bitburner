import { global_constants  } from 'utility/constants.js';
import { update_data_file } from 'data/file.js';
import { list_servers } from 'opened_servers.js';

const { scripts, purchasedServerPrefix } = global_constants();
const {
	deploy,
	loopWGH
} = scripts;

/** @param {NS} ns */
export async function main(ns) {
	const args = ns.flags([["help", false]]);
    const target = ns.args[0];
    if (args.help || !target) {
        ns.tprint(`This script run through all rooted servers on which it deploys ${loopWGH} aiming at given server.`);
        ns.tprint(`Usage: run ${ns.getScriptName()} TARGET`);
        ns.tprint("Example:");
        ns.tprint(`> run ${ns.getScriptName()} n00dles`);
        return;
    }
    if (!ns.fileExists(deploy)) {
        ns.tprint(`${deploy} is missing`);
        return;
    }
    await update_data_file(ns, "loop-wgh", { target });
    const host = ns.getHostname();
	const servers = list_servers(ns).filter(s => ns.hasRootAccess(s) && !s.startsWith(purchasedServerPrefix));
    const requiredRam = ns.getScriptRam(deploy);
	for (const server of servers) {
        if (ns.isRunning(loopWGH, server, target)) continue;
        const serverMax = ns.getServerMaxRam(server);
        if (serverMax == 0) continue;
        // waiting home ram for deploy
        const hostMax = ns.getServerMaxRam(host);
        while(requiredRam > (hostMax-ns.getServerUsedRam(host))) await ns.sleep(1000);
        ns.scriptKill(loopWGH, server);
		ns.run(deploy, 1, server, loopWGH, target);
	}
}

/**
 *  @param {AutocompleteData} data
 *  @param {string[]} args
 */
export function autocomplete(data, args) {
    return data.servers;
}

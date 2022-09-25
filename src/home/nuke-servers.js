import { update_data_file } from 'data/file.js';
import { list_servers } from 'opened_servers.js';

/** @param {NS} ns */
export async function main(ns) {
	const args = ns.flags([["help", false]]);
    if (args.help) {
        ns.tprint("This script run through all servers on which it tries to take root access.");
        ns.tprint(`Usage: run ${ns.getScriptName()}`);
        ns.tprint("Example:");
        ns.tprint(`> run ${ns.getScriptName()}`);
        return;
    }
    ns.disableLog("ALL");
	const servers = list_servers(ns).filter(s => !ns.hasRootAccess(s));
	ns.print(`Checking ${servers.length} servers scanned from [${ns.getHostname()}]`);
    const acquired = [];
	for (const server of servers) {
        let ports = ns.getServerNumPortsRequired(server);
        if (ports > 0 && ns.fileExists("BruteSSH.exe", "home")) {
            ns.brutessh(server);
            ports--;
        }
        if (ports > 0 && ns.fileExists("FTPCrack.exe", "home")) {
            ns.ftpcrack(server);
            ports--;
        }
        if (ports > 0 &&  ns.fileExists("relaySMTP.exe", "home")) {
            ns.relaysmtp(server);
            ports--;
        }
        if (ports > 0 && ns.fileExists("HTTPWorm.exe", "home")) {
            ns.httpworm(server);
            ports--;
        }
        if (ports > 0 && ns.fileExists("SQLInject.exe", "home")) {
            ns.sqlinject(server);
            ports--;
        }
        if (ports > 0) {
            ns.print(`Not enough ports for [${server}] : ${ports} left`);
            continue;
        }
        ns.nuke(server);
        acquired.push(server);
	}
    ns.print("Acquired access to :");
    acquired.forEach(server => ns.print("  "+server));
    if (acquired.length>0) ns.toast(`Acquired access to ${acquired.length} servers`, "success", 1000*10);
    await update_data_file(ns, "stats", { servers: list_servers(ns).filter(s => ns.hasRootAccess(s)).length });
}

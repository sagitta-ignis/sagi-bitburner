/** @param {NS} ns */
export async function main(ns) {
	const args = ns.flags([["help", false]]);
    if (args.help) {
        ns.tprint("This script runs share() in a loop.");
        ns.tprint(`Usage: run ${ns.getScriptName()}`);
        ns.tprint("Example:");
        ns.tprint(`> run ${ns.getScriptName()}`);
        return;
    }
	while(true) {
		await ns.share();
	}
}
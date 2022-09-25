/** @param {NS} ns */
export async function main(ns) {
	const args = ns.flags([["help", false]]);
	let target = ns.args[0];
    let untilDate = ns.args[1];
    if (args.help || !target) {
        ns.tprint("This script runs grow() on a given target.");
        ns.tprint(`Usage: run ${ns.getScriptName()} target [iso-datetime]`);
        ns.tprint("Example:");
        ns.tprint(`> run ${ns.getScriptName()} n00dles "${new Date(Date.now() + 1000*60*5).toISOString()}"`);
        return;
    }
    let until = 0;
    if (untilDate) until = Math.max(Date.parse(untilDate) - Date.now(), 0);
    if (until) await ns.sleep(until);
	await ns.grow(target);
}

/**
 *  @param {AutocompleteData} data
 *  @param {string[]} args
 */
export function autocomplete(data, args) {
    return data.servers;
}
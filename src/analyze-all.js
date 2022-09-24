import { _eval } from 'utility/eval.js';
import { list_servers } from 'opened_servers.js';
import { analyze_server } from 'analyze_server.js';

/** @param {NS} ns */
export async function main(ns) {
	const args = ns.flags([["help", false]]);
	let predicate = ns.args[0] || "s.hack.enabled && s.root";
	let comparator = ns.args[1] || "b.money.max - a.money.max";
    if (args.help) {
        ns.tprint("This script list all servers :");
		ns.tprint("- filtered by given expression or by hack chance percentage above 50%.");
		ns.tprint("- ordered by given expression or by descending money max.");
		ns.tprint("Then pass one by one to 'analyze_server.js' script, waiting a prompt in-between");
        ns.tprint(`Usage: run ${ns.getScriptName()} [predicate] [comparator]`);
        ns.tprint("Example:");
        ns.tprint(`> run ${ns.getScriptName()} "${predicate}" "${comparator}"`);
        return;
    }
	ns.tprint(`Filtering by predicate(s) : ${predicate}`);
	ns.tprint(`Ordering by comparator(a,b) : ${comparator}`);
	const servers = list_servers(ns)
		.map(name => {
			let server = analyze_server(ns, name);
			server.name = name;
			return server;
		})
		.filter(s => _eval(ns, predicate, { s:s }))
		.sort((a, b) => _eval(ns, comparator, { a:a, b:b }));
	for (let server of servers) {
		ns.run("analyze_server.js", 1, server.name);
		const next = await ns.prompt("Continue?",  { type: "boolean" });
		if (!next) break;
	}
}

/**
 *  @param {AutocompleteData} data
 *  @param {string[]} args
 */
 export function autocomplete(data, args) {
    return [];
}
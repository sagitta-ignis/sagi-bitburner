import { _eval } from 'utility/eval.js';
import { list_servers } from 'opened_servers.js';
import { analyze_server } from 'analyze_server.js';

/** @param {NS} ns */
export async function main(ns) {
	const args = ns.flags([["help", false],["auto", false],["predicate",""]]);
	let predicate = args.predicate;
    if (args.help || args._.length < 1) {
        ns.tprint("This script list all servers :");
		ns.tprint("- filtered by given expression or by hack chance percentage above 50%.");
		ns.tprint("- ordered by given expression or by descending money max.");
		ns.tprint("Then pass one by one to 'analyze_server.js' script, waiting a prompt in-between");
        ns.tprint(`Usage: run ${ns.getScriptName()} SCRIPT ARGUMENTS [--predicate="expression"] [--auto]`);
        ns.tprint("Example:");
        ns.tprint(`> run ${ns.getScriptName()} basic_hack.js foodnstuff --predicate="${predicate||"host.name.startsWith('pserv')"}" --auto`);
        return;
    }

	const script = args._[0];
	const script_args = args._.slice(1);

	if (!ns.ls(ns.getHostname()).find(f => f === script)) {
		ns.tprint(`Script '${script}' does not exist. Aborting.`);
		return;
	}

	ns.tprint(`Deploying on all hosts : `, script, ...script_args)
	ns.tprint(`Filtering by predicate(host) : ${predicate || 'no filter'}`);
	predicate = predicate || "true";

	ns.disableLog("ALL");
	const servers = list_servers(ns)
		.map(name => {
			let server = analyze_server(ns, name);
			server.name = name;
			return server;
		})
		.filter(s => _eval(ns, predicate, { host:s }));
	ns.enableLog("ALL");
	if (!args.auto && !await ns.prompt(`Deploy on ${servers.length} servers ?`,  { type: "boolean" })) return;
	for (let server of servers) {
		ns.run("deploy.js", 1, server.name, script, ...script_args);
		await ns.sleep(100);
	}
}

/**
 *  @param {AutocompleteData} data
 *  @param {string[]} args
 */
export function autocomplete(data, args) {
	if (args.length == 0) return data.scripts;
    return [];
}
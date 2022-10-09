import { global_constants } from 'utility/constants.js';
import { update_data_file } from 'data/file.js';

const {
	/** @type {string[]} */
	programs,
	home,
} = global_constants();

/** @param {NS} ns */
export async function main(ns) {
	const args = ns.flags([["help", false]]);
	if (args.help) {
		ns.tprint("This script tries to create or buy all progams.");
		ns.tprint(`Usage: run ${ns.getScriptName()}`);
		ns.tprint("Example:");
		ns.tprint(`> run ${ns.getScriptName()}`);
		return;
	}
	ns.disableLog("sleep");
	let left = programs.slice()
		.filter(program => !ns.fileExists(program, home));
	while(left.length > 0) {
		let money = ns.getServerMoneyAvailable(home);
		let program = left.shift();
		let cost = ns.singularity.getDarkwebProgramCost(program);
		if (cost === -1 || cost > money) {
			let created = false;
			if (!ns.singularity.isBusy() && (created = ns.singularity.createProgram(program, false))) {
				let work;
				do {
					work = ns.singularity.getCurrentWork();
					await ns.sleep(1000*60);
				} while(work.type === 'CREATE_PROGRAM' && work.programName === program && !ns.fileExists(program, home));
			}
			if (!created) await ns.sleep(1000*60*5);
		} else if (cost > 0) {
			ns.singularity.purchaseProgram(program);
		}
		if (!ns.fileExists(program, home)) left.unshift(program);
		await update_data_file(ns, "stats", { programs: programs.length - left.length });
		await ns.sleep(1000*10);
	}
}

/**
 *  @param {AutocompleteData} data
 *  @param {string[]} args
 */
export function autocomplete(data, args) {
    return [];
}
/**
 * Continuously tries to weaken, grow or hack depending on server state
 *
 * @param {NS} ns 
 * @param {string} target
 */
export async function loop_wgh(ns, target) {
	const moneyThresh =  moneyThreshold(ns, target);
	if (moneyThresh <= 1) {
		ns.tprint("Not enough money available in ["+target+"]");
		return;
	}
	const securityThresh = securityThreshold(ns, target);

	ns.print("Hacking ["+target+"] with ["+moneyThresh+"] in money and protected by ["+securityThresh+"] security");	
	// Infinite loop that continously hacks/grows/weakens the target server
	while(true) {
		if (ns.getServerSecurityLevel(target) > securityThresh) {
			// If the server's security level is above our threshold, weaken it
			await ns.weaken(target);
		} else if (ns.getServerMoneyAvailable(target) < moneyThresh) {
			// If the server's money is less than our threshold, grow it
			await ns.grow(target);
		} else {
			// Otherwise, hack it
			await ns.hack(target);
		}
	}
}

/**
 * Defines how much money a server should have before we hack it
 * In this case, it is set to 75% of the server's max money.
 *
 * @param {NS} ns 
 * @param {string} target
 */
 export function moneyThreshold(ns, target) {
	return ns.getServerMaxMoney(target) * 0.75;
}

/**
 * Defines the maximum security level the target server can
 * have. If the target's security level is higher than this,
 * we'll weaken it before doing anything else.
 *
 * @param {NS} ns 
 * @param {string} target
 */
export function securityThreshold(ns, target) {
	return ns.getServerMinSecurityLevel(target) + 5;
}

/** @param {NS} ns */
export async function main(ns) {
	const args = ns.flags([['help', false]]);
	// Defines the "target server", which is the server
	// that we're going to hack. In this case, it's "n00dles"
    const target = args._[0];
    if(args.help || !target) {
        ns.tprint("This script will generate money by hacking a target server.");
        ns.tprint(`USAGE: run ${ns.getScriptName()} SERVER_NAME`);
        ns.tprint("Example:");
        ns.tprint(`> run ${ns.getScriptName()} n00dles`);
        return;
    }
	await loop_wgh(ns, target);
}

/**
 *  @param {AutocompleteData} data
 *  @param {string[]} args
 */
export function autocomplete(data, args) {
    return data.servers;
}

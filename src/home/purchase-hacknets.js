/** @param {NS} ns */
export async function main(ns) {
	const args = ns.flags([["help", false],["interval", 1000*60],["auto", false]]);
    if (args.help) {
        ns.tprint("This script buys and upgrades HackNet nodes.");
        ns.tprint(`Usage: run ${ns.getScriptName()}`);
        ns.tprint("Example:");
        ns.tprint(`> run ${ns.getScriptName()}`);
        return;
    }
	ns.disableLog("sleep");
	ns.disableLog("getServerMoneyAvailable");
	const maxNodes = ns.hacknet.maxNumNodes();
	const maxLevel = 200;
	const maxRam = 64;
	const maxCore = 16;
	const maxedOuts = [];
	const formatCost = (cost) => Number.isFinite(cost) ? ns.nFormat(cost, "$0.000a"): 'MAXED';
	do {
		await ns.sleep(args.interval);
		let numNodes = ns.hacknet.numNodes();
		let money = ns.getServerMoneyAvailable("home");
		ns.print(' ');
		ns.print(`Trying to purchase hacknet ...`);
		ns.print(' ');
		let purchases = {
			node: {
				cost: ns.hacknet.getPurchaseNodeCost(),
				buy: () => ns.hacknet.purchaseNode(),
				node: numNodes
			},
			level: {
				cost: money,
				amount: 1,
				buy: () => ns.hacknet.upgradeLevel(purchases.level.node, purchases.level.amount),
				node: undefined
			},
			ram: {
				cost: money,
				amount: 1,
				buy: () => ns.hacknet.upgradeRam(purchases.ram.node, purchases.ram.amount),
				node: undefined
			},
			core: {
				cost: money,
				amount: 1,
				buy: () => ns.hacknet.upgradeCore(purchases.core.node, purchases.core.amount),
				node: undefined
			}
		};
		ns.print(`Next node at ${ns.nFormat(purchases.node.cost, "$0.000a")}`);
		for (let i = 0; i < numNodes; i++) {
			let upgrades = {
				level: {
					cost: ns.hacknet.getLevelUpgradeCost(i, 1),
				},
				ram: {
					cost: ns.hacknet.getRamUpgradeCost(i, 1),
				},
				core: {
					cost: ns.hacknet.getCoreUpgradeCost(i, 1),
				},
			};
			ns.print(`Node#${i}	|	level ${formatCost(upgrades.level.cost)}	|	ram ${formatCost(upgrades.ram.cost)}	|	core ${formatCost(upgrades.core.cost)}`);
			for (let [name, upgrade] of Object.entries(upgrades)) {
				if (!Number.isFinite(upgrade.cost)) continue;
				if (upgrade.cost < purchases[name].cost) {
					purchases[name].cost = upgrade.cost;
					purchases[name].node = i;
				}
			}
		}
		let purchase = Object.entries(purchases)
			.map(([name, purchase]) => ({ ...purchase, name }))
			.reduce((current, purchase) => {
				if (purchase.node === undefined || !Number.isFinite(purchase.cost)) return current;
				if (!current || current.node === undefined || !Number.isFinite(current.cost)) return purchase;
				return purchase.cost < current.cost ? purchase : current;
			}, undefined);
		if (!purchase) {
			ns.print(`Nothing to purchase`);
			continue;
		}
		ns.print(`Trying to purchase ${purchase.name} ${purchase.name!='node'?'':`for `}node ${purchase.node} at ${ns.nFormat(purchase.cost, "$0.000a")}`);
		let result = purchase.buy();
		if (result === false || result === -1) continue;
		ns.print(`Purchased ${purchase.name} ${purchase.name!='node'?'':`for `}node ${purchase.node} at ${ns.nFormat(purchase.cost, "$0.000a")}`);
		let node = ns.hacknet.getNodeStats(purchase.node);
		if (!node) continue;
		if (node.level < maxLevel || node.ram < maxRam || node.cores < maxCore) continue;
		else maxedOuts.push(node);
	} while(maxedOuts.length != maxNodes);
	ns.print(`Maxed out hacknets`);
}
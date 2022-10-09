import { print_objects } from 'utility/print.js';

/**
 * @typedef Augmentation
 * @type {object}
 * @property {string} name
 * @property {Faction} faction
 * @property {string[]} prereq
 * @property {number} reputation
 * @property {number} base
 * @property {number} price
 * @property {number} predicted
 * @property {boolean} unlocked
 * @property {boolean} purchasable
 * @property {AugmentationStats} stats
 */

/**
 * @typedef Faction
 * @type {object}
 * @property {string} name
 * @property {number} reputation
 */

/**
 * @param {NS} ns
 * @param {string[]} skip
 * @return {Map<string,Augmentation>}
 */
export function getAvailableAugmentations(ns, skip) {
    const player = ns.getPlayer();
    const owned = ns.singularity.getOwnedAugmentations(true);
    const ignore = skip.reduce((map, name) => map.set(name, true), new Map());

    /** @type {Map<string, Augmentation>} */
    const augmentations = new Map();
    for (let faction of player.factions) {
        if (ignore.has(faction)) continue;
        const factionReputation = ns.singularity.getFactionRep(faction);
        ns.singularity.getAugmentationsFromFaction(faction)
            .forEach(aug => {
                if (ignore.has(aug)) return;
                const prereq = ns.singularity.getAugmentationPrereq(aug);
                const reputation = ns.singularity.getAugmentationRepReq(aug);
                const base = ns.singularity.getAugmentationBasePrice(aug);
                const price = ns.singularity.getAugmentationPrice(aug);
                const stats = ns.singularity.getAugmentationStats(aug);
                const unlocked = owned.includes(aug);
                const augmentation = {
                    name: aug,
                    faction: {
                        name: faction,
                        reputation: factionReputation,
                    },
                    prereq,
                    reputation,
                    base,
                    price,
                    unlocked,
                    stats,
                };
                augmentations.set(augmentation.name, augmentation);
            });
    }
    return augmentations;
}

/**
 * @param {NS} ns
 * @param {Map<string,Augmentation>} augmentations
 */
export function predictAugmentations(ns, augmentations) {
    const ordered = Array.from(augmentations.values())
        .filter(a => !a.unlocked)
        .sort(byRequirementsThenPrices(augmentations, false));

    let money = ns.getServerMoneyAvailable("home");
    const first = ordered.find(aug => !aug.unlocked);
    let multi = first.price / first.base;

    ordered.reduce((total, augmentation) => {
        if (augmentation.unlocked) return total;
        augmentation.predicted = (multi*augmentation.price);
        augmentation.purchasable = augmentation.predicted <= money && augmentation.reputation <= augmentation.faction.reputation;
        if (!augmentation.purchasable) {
            augmentation.predicted = undefined;
            return total;
        }
        total+=augmentation.predicted;
        money-=augmentation.predicted;
        multi*=1.9;
        return total;
    }, 0);

    return ordered;
}

/**
 * @param {Map<string,Augmentation>} map
 * @return {(a: Augmentation, b: Augmentation) => number}
 */
export function byRequirementsThenPrices(map, ascendingPrice = true) {
    return (a,b) => {
        if (a.prereq.includes(b.name)) return 1;
        if (b.prereq.includes(a.name)) return -1;
        const aPrice = getUnlockedAugmentationPrice(a, map);
        const bPrice = getUnlockedAugmentationPrice(b, map);
        return (ascendingPrice===false?-1:1) * (aPrice - bPrice);
    }; 
}

/**
 * @param {Augmentation} augmentation
 * @param {Map<string,Augmentation>} map
 * @return {number}
 */
export function getUnlockedAugmentationPrice(augmentation, map) {
    if (augmentation.prereq.length <= 0) return augmentation.price;
    return augmentation.prereq.reduce(
        (lowest, name) => {
            if (!map.has(name)) return lowest;
            const prereq = map.get(name);
            if (prereq.unlocked) return lowest;
            return Math.min(lowest, getUnlockedAugmentationPrice(prereq, map));
        },
        augmentation.price
    );
}

/**
 * @param {NS} ns
 * @param {Augmentation[]} augmentations
 */
function print_augmentations(ns, augmentations) {
    print_objects(ns, augmentations, {
        faction: { label: 'Faction', format: (_, faction) => faction.name },
        name: { label: 'Name' },
        price: {
            label: 'Price',
            format: (sign,value) => ns.nFormat(value, "0.000a"),
            reduce: (total, price) => total=(total||0)+price,
        },
        predicted: {
            label: 'Predicted',
            format: (sign,value) => ns.nFormat(value, "0.000a"),
            reduce: (total, price) => total=(total||0)+(price||0),
        },
        reputation: {
            label: 'Reputation',
            format: (sign,value) => ns.nFormat(value, "0.000a"),
        },
        purchasable: { label: 'Purchasable' },
    });
}

/** @param {NS} ns */
export async function main(ns) {
    const args = ns.flags([["help", false],["skip", []]]);
    if (args.help) {
        ns.tprint("This script list all ordered augmentations from currently joined factions.");
        ns.tprint(`Usage: run ${ns.getScriptName()}`);
        ns.tprint("Example:");
        ns.tprint(`> run ${ns.getScriptName()}`);
        return;
    }
    ns.disableLog("getServerMoneyAvailable");
    /** @type {Map<string, Augmentation>} */
    let augmentations = getAvailableAugmentations(ns, args.skip)
    const predictions = predictAugmentations(ns, augmentations);
    print_augmentations(ns, predictions);
}

export function autocomplete(data, args) {
    return [];
}
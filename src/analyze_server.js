/**
 * @param {NS} ns
 * @param {string} server
 */
export function analyze_server(ns, server) {
    const usedRam = ns.getServerUsedRam(server);
    const maxRam = ns.getServerMaxRam(server);
    const moneyAvailable = ns.getServerMoneyAvailable(server);
    const maxMoney = ns.getServerMaxMoney(server);
    const minSec = ns.getServerMinSecurityLevel(server);
    const sec = ns.getServerSecurityLevel(server);
    const growth = ns.getServerGrowth(server);
    const hackTime = ns.getHackTime(server);
    const growTime = ns.getGrowTime(server);
    const weakenTime = ns.getWeakenTime(server);
    const growthMultipliers = [
        0,
        ns.growthAnalyze(server, 1),
        ns.growthAnalyze(server, 2),
        ns.growthAnalyze(server, 3),
        ns.growthAnalyze(server, 4)
    ];
    const playerLevel = ns.getHackingLevel();
    const rootAccess = ns.hasRootAccess(server);
    const hackLevel = ns.getServerRequiredHackingLevel(server);
    const hackAmount = ns.hackAnalyze(server);
    const hackChance = ns.hackAnalyzeChance(server);
    return {
        ram: {
            max: maxRam,
            used: usedRam
        },
        money: {
            max: maxMoney,
            available: moneyAvailable,
            delta: maxMoney - moneyAvailable,
        },
        root: rootAccess,
        security: {
            min: minSec,
            level: sec,
            delta: sec - minSec,
        },
        growth: {
            rate: growth,
            multipliers: growthMultipliers
        },
        time: {
            hack: hackTime,
            grow: growTime,
            weaken: weakenTime
        },
        hack: {
            level: hackLevel,
            enabled: playerLevel >= hackLevel,
            amount: hackAmount,
            chance: hackChance
        }
    };
}

/**
 * @param {NS} ns
 * @param {Server} server
 */
export function format_server(ns, server) {
    return `
${server.name}:
    RAM        : ${server.ram.used} / ${server.ram.max} (${server.ram.used / server.ram.max * 100}%)
    $          : ${ns.nFormat(server.money.available, "$0.000a")} / ${ns.nFormat(server.money.max, "$0.000a")} (${(server.money.available / server.money.max * 100).toFixed(2)}%)
    hack skill : ${server.hack.level} (${server.hack.enabled?'enabled':'disabled'}${server.root?',root':''})
    security   : ${server.security.min.toFixed(2)} / ${server.security.level.toFixed(2)}
    growth     : ${server.growth.rate}
    hack time  : ${ns.tFormat(server.time.hack)}
    grow time  : ${ns.tFormat(server.time.grow)}
    weaken time: ${ns.tFormat(server.time.weaken)}
    grow x2    : ${(server.growth.multipliers[2]).toFixed(2)} threads
    grow x3    : ${(server.growth.multipliers[3]).toFixed(2)} threads
    grow x4    : ${(server.growth.multipliers[4]).toFixed(2)} threads
    hack 10%   : ${(.10 / server.hack.amount).toFixed(2)} threads
    hack 25%   : ${(.25 / server.hack.amount).toFixed(2)} threads
    hack 50%   : ${(.50 / server.hack.amount).toFixed(2)} threads
    hackChance : ${(server.hack.chance * 100).toFixed(2)}%
`
}

/** @param {NS} ns */
export async function main(ns) {
    const args = ns.flags([["help", false]]);
    const server = ns.args[0];
    if (args.help || !server) {
        ns.tprint("This script does a more detailed analysis of a server.");
        ns.tprint(`Usage: run ${ns.getScriptName()} SERVER`);
        ns.tprint("Example:");
        ns.tprint(`> run ${ns.getScriptName()} n00dles`);
        return;
    }
    ns.tprint(format_server(ns, { name: server, ...analyze_server(ns, server)}));
}


/**
 *  @param {AutocompleteData} data
 *  @param {string[]} args
 */
export function autocomplete(data, args) {
    return data.servers;
}
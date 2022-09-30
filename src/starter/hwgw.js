import { global_constants } from 'utility/constants.js';
import { date_format } from 'utility/format.js';
import { analyze_available, check_hwgw, run_operations, print_operations } from 'utility/hwgw.js';
import { list_servers } from 'opened_servers.js';


const { hackRam, growRam, weakenRam } = global_constants();

/** 
 * @param {NS} ns 
 * @param {string} target
 * @param {number} percent
 * @param {number} timeWindow
 * @return {Array<HWGWOperation>}
 */
 export function hwgw(ns, target, percent, timeWindow = 100, start = Date.now()) {
    const batchSteps = 4;

    // check target for optimized batch
    const security = ns.getServerSecurityLevel(target);
    const min = ns.getServerMinSecurityLevel(target);
    const money = Math.max(1, ns.getServerMoneyAvailable(target));
    const max = ns.getServerMaxMoney(target);
    const canHack = security == min && money == max;

    // prepare batch window
    const growPerc = (percent / 100.0);
    let hackMoney = growPerc * max;

    const hackTime = ns.getHackTime(target);
    const hackThreads = Math.max(1, Math.ceil(ns.hackAnalyzeThreads(target, hackMoney)));
    hackMoney = hackThreads * ns.hackAnalyze(target) * max;
    const hackSec = ns.hackAnalyzeSecurity(hackThreads, target);

    const moneyAmount = canHack ? max - hackMoney : money;
    const growthAmount = Math.max(1.1, max / moneyAmount);
    const weakenAmount = ns.weakenAnalyze(1);

    const weakenSec = canHack ? hackSec : security - min;
    const weakenTime = ns.getWeakenTime(target);
    const weakenThreads = Math.max(1, Math.ceil(weakenSec / weakenAmount));

    const growTime = ns.getGrowTime(target);
    const growThreads = Math.max(1, Math.ceil(ns.growthAnalyze(target, growthAmount)));
    const growSec = ns.growthAnalyzeSecurity(growThreads, target, 1);

    const reweakenThreads = Math.max(1, Math.ceil(growSec / weakenAmount));

    // create batch
    /** @type {Array<HWGWOperation>} */
    const batch = [];

    let weakenStartAt = start;
    let weakenDueAt = weakenStartAt + weakenTime;

    let hackStartAt = 0;
    let hackDueAt = 0;

    let growStartAt = 0;
    let growDueAt = 0;

    let reweakenStartAt = 0;
    let reweakenDueAt = start;

    if (canHack) {
        hackStartAt = weakenDueAt - hackTime - (timeWindow / batchSteps);
        hackDueAt = hackStartAt + hackTime;
        batch.push(
            {
                script: 'hack.js',
                threads: hackThreads,
                args: [target, date_format(ns, hackStartAt)],
                data: { target, start: hackStartAt, end: hackDueAt,ram: hackRam, money: -1 * hackMoney, max, security: hackSec }
            },
        )
    }
    if (security != min || canHack) {
        batch.push(
            {
                script: 'weaken.js',
                threads: weakenThreads,
                args: [target, date_format(ns, weakenStartAt)],
                data: { target, start: weakenStartAt, end: weakenDueAt,ram: weakenRam, security: -1 * weakenThreads * weakenAmount }
            },
        );
    }
    if (money != max || canHack) {
        reweakenStartAt = weakenStartAt + timeWindow;
        reweakenDueAt = reweakenStartAt + weakenTime;

        growStartAt = reweakenDueAt - growTime - (timeWindow / batchSteps);
        growDueAt = growStartAt + growTime;

        batch.push(
        {
            script: 'grow.js',
            threads: growThreads,
            args: [target, date_format(ns, growStartAt)],
            data: { target, start: growStartAt, end: growDueAt,ram: growRam, money: (growthAmount - 1) * money, max, security: growSec, growth: growthAmount }
        },
        {
            script: 'weaken.js',
            threads: reweakenThreads,
            args: [target, date_format(ns, reweakenStartAt)],
            data: { target, start: reweakenStartAt, end: reweakenDueAt, ram: weakenRam, security: -1 * reweakenThreads * weakenAmount }
        },
        );
    }
    return batch;
}

/** 
 * @param {NS} ns 
 * @param {string} target
 * @param {number} percent
 * @param {number} timeWindow
 * @return {Array<HWGWOperation>}
 */
export async function run_hwgw(ns, target, percent, timeWindow = 100) {
    // analyze batch
    const batch = hwgw(ns, target, percent, timeWindow);
    if (batch == null) {
        ns.print(`Failed to create batch`);
        return null;
    }
    const operations = batch.filter(op => !!op.script);
    if (operations.length <= 0) {
        ns.print(`Failed to fill batch`);
        return null;
    }

    // allocate batch
    let allocated = true;
    for (let operation of operations) {
        const ram = ns.getScriptRam(operation.script);
        operation.host = findOneServerByAvailableRam(ns, operation.threads, ram)?.name;
        if (!operation.host) ns.print(`No server available for ${operation.threads} threads (${operation.threads * ram} RAM)`);
        allocated = allocated && !!operation.host;
    }
    if (!allocated) {
        ns.print(`Server ${target} requires more RAM for batch operation`);
        return [];
    }

    return await run_operations(ns, operations);
}

/**
 * @param {NS} ns
 * @param {number} threads
 * @param {number} ram
 */
function findOneServerByAvailableRam(ns, threads, ram) {
    let servers = list_servers(ns)
        .filter(server => ns.hasRootAccess(server) && ns.getServerUsedRam(server) < 0.9*ns.getServerMaxRam(server))
        .map(name => analyze_available(ns, name))
        .sort((a , b) => a.ram.available - b.ram.available)
    servers.push(analyze_available(ns, "home"));
    // NOTE: yes i know Array.find() but intellisense is brooooooken
    let found = servers[0];
    found = undefined;
    for (let server of servers) {
        if (Math.floor(server.ram.available / ram) < threads) continue;
        found = server;
        break;
    }
    return found;
}

/** @param {NS} ns */
export async function main(ns) {
    const args = ns.flags([["help", false], ["percent", 25], ["time", 100], ["once",false]]);
    let target = ns.args[0];
    if (args.help || !target) {
        ns.tprint("This script runs an hack-weaken-grow-weaken batch algorithm on a given target.");
        ns.tprint(`Usage: run ${ns.getScriptName()} target`);
        ns.tprint("Example:");
        ns.tprint(`> run ${ns.getScriptName()} n00dles`);
        return;
    }
    ns.disableLog("ALL");
    ns.enableLog("exec");
    ns.enableLog("sleep");

    const percent = args.percent;
    const batchWindow = args.time;
    const maxPreparations = 3;

    let message = '';

    // prepare algorithm (WGW) loop
    let optimized = false;
    let tries = 0;
    do {
        tries++;
        // check if target optimized for batch
        let check = check_hwgw(ns, target);
        optimized = check.optimized;
        ns.print(`Check if ${target} is optimized for HWGW : ${optimized}`);
        if (optimized) break;
        if (!optimized && tries === 0) {
            message = `Server ${target} must be prepared for HWGW`;
            // ns.toast(message, "warning", 1000 * 60);
            ns.print(message);
        }
        let batch = await run_hwgw(ns, target, percent, batchWindow);
        if (batch) {
            const untilFinished = batch.reduce((finished, op) => Math.max(finished, op.data.end), 0);
            let { money, security } = check;
            batch.unshift({ host: target, data: { start: Date.now(), money, security } });
            print_operations(ns, batch);
            if (untilFinished) await ns.sleep(untilFinished + batchWindow - Date.now());
        }
        optimized = check_hwgw(ns, target).optimized;
        if (!optimized) await ns.sleep(1000 * (5 + Math.floor(Math.random() * 30)));
    } while (!optimized && tries < maxPreparations);
    if (tries >= maxPreparations) {
        message = `WGW algorithm went wrong on ${target}`;
        ns.toast(message, "error", 1000*60);
        ns.print(message);
        ns.tail();
        return;
    }
    await ns.sleep(batchWindow);

    message = `Running HWGW at server ${target}`;
    ns.toast(message, "success", 1000 * 60);
    ns.print(message);

    // batch algorithm (HWGW) loop
    do {
        const { security, money } = check_hwgw(ns, target);
        const batch = await run_hwgw(ns, target, percent, batchWindow);
        if (batch == null) {
            message = `HWGW algorithm went wrong on ${target}`;
            ns.toast(message, "error", 1000*60);
            ns.print(message);
            ns.tail();
            await ns.sleep(1000 * (5 + Math.floor(Math.random() * 60)));
        } else if (batch.length > 0) {
            batch.unshift({ host: target, data: { start: Date.now(), money, security } });
            print_operations(ns, batch);
        }
        if (!args.once) await ns.sleep(batchWindow);
    } while (!args.once);
}


/**
 *  @param {AutocompleteData} data
 *  @param {string[]} args
 */
export function autocomplete(data, args) {
    return data.servers;
}

import { global_constants } from 'utility/constants.js';
import { date_format } from 'utility/format.js';

import { read_data_file, update_data_file } from 'data/file.js';
import { list_servers } from 'opened_servers.js';
import { analyze_server } from 'analyze_server.js';

import { check_hwgw, run_operations, print_operations } from 'utility/hwgw.js';
import { hwgw } from 'starter/hwgw.js';

const { 
	scripts,
} = global_constants();

/** @type {Map<string, Map<number, HWGWOperation>>} */
const currentOperations = new Map();

/** @param {NS} ns */
export function schedule(ns, percent = 25, timeWindow = 200) {
    const time = {
        scheduled: { start: 0, end: 0 },
        servers: { start: 0, end: 0 },
        targetsort: { start: 0, end: 0 },
        preparables: { start: 0, end: 0 },
        hacking: { start: 0, end: 0 },
        preparing: { start: 0, end: 0 },
        remaining: { start: 0, end: 0 },
    };
    
    time.scheduled.start = Date.now();
    /** @type {EstimatedTarget[]} */
    const targets = [];
    /** @type {EstimatedTarget[]} */
    const hackables = [];
    /** @type {EstimatedTarget[]} */
    let preparables = [];
    /** @type {AvailableHost[]} */
    const hosts = [];

    time.servers.start = Date.now();
    const names = list_servers(ns);
    for (let name of names) {
        if (isHackable(ns, name)) {
            const target = estimateTarget(ns, name, percent, timeWindow);
            if (target.optimized || !hasOperationRunning(ns, target.name)) targets.push(target);
        }
        const host = analyzeAvailable(ns, name);
        if (host.available) hosts.push(host);
    }
    const home = analyzeAvailable(ns, "home");
    if (home.available) hosts.push(home);
    time.servers.end = Date.now();

    time.targetsort.start = Date.now();
    targets.sort(byProductionPerSecond(false));
    time.targetsort.end = Date.now();

    time.preparables.start = Date.now();
    const slice = targets.slice(0,3);
    for (let target of slice) {
        if (target.optimized) {
            hackables.push(target);
        } else {
            preparables.push(target);
        }
    }
    preparables = preparables.concat(
        targets.slice(3).sort(byDeltas(true))
    );
    time.preparables.end = Date.now();
    const preparablesLength = preparables.length;

    /** @type {HWGWBatch[]} */
    const batches = [];

    time.hacking.start = Date.now();
    let hackingRange = { start: 0, end: 3 };
    if (hosts.length > 0) assign(ns, hackables, hosts, batches, hackingRange);
    time.hacking.end = Date.now();

    time.preparing.start = Date.now();
    let preparingRange = { start: 0, end: 3 };
    if (hosts.length > 0) assign(ns, preparables, hosts, batches, preparingRange);
    time.preparing.end = Date.now();

    preparables = preparables.filter(p => !batches.some(b => b.name === p.name));
    preparables.sort(byMaxMoney(false));

    time.remaining.start = Date.now();
    let start = Date.now() + timeWindow;
    while(hosts.length > 0 && (hackables.length > 0 || preparables.length > 0)) {
        const size = batches.length;
        if (hosts.length > 0) assign(ns, hackables.map(h => ({...h, operations: hwgw(ns, h.name, percent, timeWindow, start)})), hosts, batches);
        if (hosts.length > 0) assign(ns, preparables.slice(0,3).map(p => ({...p, operations: hwgw(ns, p.name, percent, timeWindow, start)})), hosts, batches);
        if (batches.length > names.length || size === batches.length || Date.now()-time.scheduled.start >= 1000) break;
        preparables = preparables.filter(p => !batches.some(b => b.target.name === p.name));
        start += timeWindow;
    }
    time.remaining.end = Date.now();

    time.scheduled.end = Date.now();
    return {
        batches,
        time: {
            servers: time.servers.end - time.servers.start,
            targetsort: time.targetsort.end - time.targetsort.start,
            preparables: time.preparables.end - time.preparables.start,
            hacking: time.hacking.end - time.hacking.start,
            preparing: time.preparing.end - time.preparing.start,
            remaining: time.remaining.end - time.remaining.start,
            scheduled: time.scheduled.end - time.scheduled.start,
        },
        length: {
            servers: names.length,
            targets: targets.length,
            preparables: preparablesLength,
        }
    };
}

/**
 * @param {NS} ns
 * @param {string} name
 */
function isHackable(ns, name) {
    return ns.hasRootAccess(name) 
        && ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(name)
        && ns.getServerMaxMoney(name) > 0;
}

/**
 * @param {NS} ns
 * @param {string} name
 * @return {EstimatedTarget}
 */
function estimateTarget(ns, name, percent, timeWindow, start = Date.now()) {
    const  { money, max, security, min, optimized } = check_hwgw(ns, name);
    const hackable = isHackable(ns, name);
    let operations = [];
    let productionPerMillisecond = 0;
    if (hackable) {
        operations = hwgw(ns, name, percent, timeWindow, start);
        const hack = operations.find(() => true);
        if (hack?.script === scripts.hack) productionPerMillisecond = Math.abs(hack.data.money) / (hack.data.end - hack.data.start);
    }
    return {
        name,
        start,
        money: { available: money, max, delta: max - money },
        security: { level: security, min, delta: security - min },
        hackable,
        optimized: optimized?1:0,
        operations,
        productionPerMillisecond,
    };
}

/**
 * @param {AvailableHost} host
 */
function isAvailable(host) {
    if (!host.root) return false;
    const max = host.ram.max;
    const available = host.ram.available;
    if (host.name !== 'home') return available > 0;
    return (available-(max > 32 ? 32 : 0)) > 0;
}

/**
 * @param {NS} ns
 * @param {string} hostname
 */
function analyzeAvailable(ns, hostname) {
    const server = {
        name: hostname,
        root: ns.hasRootAccess(hostname),
        ram: {
            max: ns.getServerMaxRam(hostname),
            used: ns.getServerUsedRam(hostname),
            available: 0,
        },
        available: false,
    };
    server.ram.available = server.ram.max - server.ram.used;
    server.available = isAvailable(server);
    return server;
}

/**
 * @param {NS} ns
 * @param {EstimatedTarget[]} targets
 * @param {AvailableHost[]} hosts
 * @param {HWGWBatch[]} batches
 * @param {{ start: number, end: number;}} range
 */
function assign(ns, targets, hosts, batches, range = {}) {
    const slice = targets.slice(range.start, range.end);
    for (let target of slice) {
        const operations = allocate(ns, target, hosts);
        if (operations.length <= 0) continue;
        /** @type {EstimatedTarget} */
        const prediction = operations.reduce((predict, op) => {
            if (Number.isFinite(op.data.money)) {
                predict.money.available += op.data.money;
                predict.money.available = Math.min(predict.money.available, predict.money.max);
            }
            if (Number.isFinite(op.data.security)) {
                predict.security.level += op.data.security;
                predict.security.level = Math.max(predict.security.level, predict.security.min);
            }
            return predict;
        }, JSON.parse(JSON.stringify(target)));
        if (operations.length === 4) {
            const money = target.money.available === prediction.money.available;
            const security = target.security.level === prediction.security.level;
            if (!money || !security) {
                ns.print(`Found instability when predicting batch for ${target.name} : ${!money?'money':''} ${!security?'security':''}`);
                debugger;
            }            
        }
        batches.push({
            target,
            operations,
            prediction,
        });
        if (hosts.length <= 0) break;
    }
}

/**
 * @param {NS} ns
 * @param {EstimatedTarget} target
 * @param {AvailableHost[]} hosts
 */
function allocate(ns, target, hosts) {
    /** @type {HWGWOperation[]} */
    const allocated = [];
    const operations = target.operations;
    for (let operation of operations) {
        const ram = operation.data.ram;
        const threads = operation.threads;
        const index = hosts.sort(byAvailableRamClosestTo(ram))
            .findIndex(server => Math.floor(server.ram.available / ram) >= threads);
        if (index < 0) {
            if (operation.script !== scripts.weaken) break;
            continue;
        }
        const host = hosts[index];
        operation.host = host.name;
        allocated.push(operation);
        host.ram.available -= (threads * ram);
        if (host.ram.available-2 <= 0) hosts.splice(index, 1);
        if (hosts.length <= 0) break;
    }
    return allocated;
}

/**
 * @param {NS} ns
 * @param {string} name
 * @return {boolean}
 */
function hasOperationRunning(ns, name) {
    /** @type {HWGWOperation[]} */
    let targets = read_data_file(ns, "hwgw-targets") || {};
    if (!targets[name]) return false;
    return Object.keys(targets[name]).length > 0;
}

/**
 * @param {boolean} ascending
 * @return {(a: EstimatedTarget, b: EstimatedTarget) => number}
 */
function byMaxMoney(ascending = true) {
    return (a,b) => (ascending?1:-1)*(a.money.max - b.money.max);
}

/**
 * @param {boolean} ascending
 * @return {(a: EstimatedTarget, b: EstimatedTarget) => number}
 */
function byProductionPerSecond(ascending = true) {
    return (a,b) => (ascending?1:-1)*(a.productionPerMillisecond - b.productionPerMillisecond);
}

/**
 * @param {boolean} ascending
 * @return {(a: EstimatedTarget, b: EstimatedTarget) => number}
 */
 function byDeltas(ascending = true) {
    return (a,b) => {
        let security = 0;
        if (a.security.delta > 0 || b.security.delta > 0) {
            security = a.security.delta - b.security.delta;
        }
        if (security!==0) return (ascending?1:-1)*security;
        let money = 0;
        if (a.money.delta > 0 || b.money.delta > 0) {
            money = a.money.delta - b.money.delta;
        }
        if (money!==0) return (ascending?1:-1)*money;
        return byMaxMoney(false)(a,b);
    };
}

/**
 * @param {number} ram
 * @param {boolean} ascending
 * @return {(a: AvailableHost, b: AvailableHost) => number}
 */
function byAvailableRamClosestTo(ram, ascending = true) {
    return (a,b) => (ascending?1:-1)*((a.ram.available - ram) - (b.ram.available - ram));
}

/**
 * @param {NS} ns
 * @param {HWGWBatch} batch
 */
async function persist(ns, batch) {
    /** @type {{ [index: string]: { [index:string]: [string,string,any[]] } }} */
    let targets = read_data_file(ns, "hwgw-targets") || {};

    for (let recent of ns.getRecentScripts()) {
        const { pid, server } = recent;
        if (!targets[server] || !targets[server][pid]) continue;
        const [script,host,args] =  targets[server][pid];
        delete targets[server][scriptIdentifier(script, args)];
        delete targets[server][pid];
    }

    for (let target of Object.values(targets)) {
        for (let spid of Object.keys(target)) {
            const pid = Number.parseInt(spid);
            if (!Number.isFinite(pid)) continue;
            const [script,host,args] = target[pid];
            const [name,end] =  args;
            if (end > Date.now()) continue;
            delete targets[name][scriptIdentifier(script, args)];
            delete targets[name][pid];
        }
    }

    for (let operation of batch.operations) {
        const target = operation.data.target;
        const {host,script,args,pid} = operation;
        if (!script || !target) continue;
        if (!targets[target]) targets[target] = {};
        targets[target][pid] = [script,host,args];
        targets[target][scriptIdentifier(script, args)] = pid;
    }

    await update_data_file(ns, "hwgw-targets", targets, false);
}

function scriptIdentifier(script, args) {
    return `${script}|${args.join('|')}`;
}

/** @param {NS} ns */
export async function main(ns) {
	const args = ns.flags([["help", false],["disable",false],["percent", 25],["time", 300]]);
    if (args.help) {
        ns.tprint("This script tries to schedule one or several targets for an hack-weaken-grow-weaken batch algorithm.");
        ns.tprint(`Usage: run ${ns.getScriptName()}`);
        ns.tprint("Example:");
        ns.tprint(`> run ${ns.getScriptName()}`);
        return;
    }
    ns.disableLog("ALL");
    let configuration = read_data_file(ns, "starter-schedule-hwgw");
	if (args.disable === configuration.enabled) {
        await update_data_file(ns, "starter-schedule-hwgw", { enabled: !args.disable });
		ns.toast(`${args.disable?'Stopped':'Started'} scheduling HWGW`, "warning");
		return;
	}
    if (args.disable) return;
    const wd = eval('window');
    ns.moveTail(wd.innerWidth / 2, 0);
    ns.resizeTail((wd.innerWidth / 2) - 15, wd.innerHeight - 15);
    const time = {
        total: { start: 0, end: 0 },
        execution: { start: 0, end: 0 },
        persist: { start: 0, end: 0 },
    };
    while(configuration.enabled)  {
        
        time.total.start = Date.now();
        let planning = schedule(ns, args.percent, args.time);
        
        time.execution.start = Date.now();
        let ops = 0;
        for (let batch of planning.batches) {
            batch.executed = await run_operations(ns, batch.operations);
            ops += batch.executed.length;
        }
        time.execution.end = Date.now();
        
        time.persist.start = Date.now();
        let closestEndDate = -1;
        for (let batch of planning.batches) {
            if (batch.executed.length <= 0) continue;
            closestEndDate = batch.executed.reduce((date, op) => (date < 0) || (op.data.end < date) ? op.data.end : date, closestEndDate);
            /*
            const { name, start, money, security } = batch.target;
            print_operations(ns, [{ host: name, data: { start, money: money.available, security: security.level } }].concat(batch.executed));
            */
            await persist(ns, batch);
        }
        time.persist.end = Date.now();

        time.total.end = Date.now();

        ns.print(`------------${date_format(ns, time.total.start, 'HH:mm:ss.SSSZZ')}------------`);
        ns.print(`Servers (${planning.length.servers}) analyzed in ${ns.tFormat(planning.time.servers, true)}`);
        ns.print(`Targets (${planning.length.targets}) sorted in ${ns.tFormat(planning.time.targetsort, true)}`);
        ns.print(`Preparables (${planning.length.preparables}) sorted in ${ns.tFormat(planning.time.preparables, true)}`);
        ns.print(`Assigned hack in ${ns.tFormat(planning.time.hacking, true)}`);
        ns.print(`Assigned preparation in ${ns.tFormat(planning.time.preparing, true)}`);
        ns.print(`Assigned remaining in ${ns.tFormat(planning.time.remaining, true)}`);
        ns.print(`Scheduled ${planning.batches.length} batches in ${ns.tFormat(planning.time.scheduled, true)}`);
        ns.print(`Executed ${ops} operations in ${ns.tFormat(time.execution.end - time.execution.start, true)}`);
        ns.print(`Persisted in ${ns.tFormat(time.persist.end - time.persist.start, true)}`);
        ns.print(`Total in ${ns.tFormat(time.total.end - time.total.start, true)}`);
        ns.print(`------------------------------------------`);
        await ns.sleep(closestEndDate - Date.now() + args.time);
        configuration = read_data_file(ns, "starter-schedule-hwgw");
    }
}
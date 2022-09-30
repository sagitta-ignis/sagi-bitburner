import { print_objects } from 'utility/print.js';
import { date_format } from 'utility/format.js';

/** @param {NS} ns */
export function check_hwgw(ns, target) {
    let security = ns.getServerSecurityLevel(target);
    let min = ns.getServerMinSecurityLevel(target);
    let money = Math.max(1, ns.getServerMoneyAvailable(target));
    let max = ns.getServerMaxMoney(target);
    const result = {
        optimized: security === min && money === max,
        security, min, money, max
    };
    return result;
}

/**
 * @param {NS} ns
 * @param {string} hostname
 */
export function analyze_available(ns, hostname) {
    const server = {
        name: hostname,
        root: ns.hasRootAccess(hostname),
        ram: {
            max: ns.getServerMaxRam(hostname),
            used: ns.getServerUsedRam(hostname),
            available: 0,
        },
    };
    server.ram.available = server.ram.max - server.ram.used;
    return server;
}

/**
 * @param {NS} ns
 * @param {Array<HWGWOperation>} operations
 */
export async function run_operations(ns, operations) {
    // upload batch
    for (let operation of operations) {
        await ns.scp(operation.script, operation.host, "home");
    }

    // execute batch
    const executing = [];
    for (let operation of operations) {
        operation.pid = ns.exec(operation.script, operation.host, operation.threads, ...operation.args);
        if(operation.pid == 0) break;
        executing.push(operation);
    }
    // cancel if cannot run whole batch
    if (executing.length !== operations.length) {
        while(executing.length > 0) {
            let operation = executing.pop();
            ns.kill(operation.pid, operation.host);
        }
    }
    return executing;
}


/**
 * @param {NS} ns
 * @param {Array<HWGWOperation>} batch
 */
export function print_operations(ns, batch) {
    /** @type {HWGWHeaders} */
    const headers = {
        end: { label: 'Date', format: (formatted, value) => date_format(ns, value, 'HH:mm:ss.SSSZZ') },
        host: { label: 'Host' },
        threads: { label: 'Threads' },
        script: { label: 'Script' },
        money: { label: 'Money', signed: true, format: (sign, value,op) => Number.isFinite(value) ? (op.script?sign:'')+ns.nFormat(value, "0.000a") : `${value}` },
        security: { label: 'Security', signed: true, format: (sign, value, op) => `${op.script?sign:''}${value.toFixed(2)}` },
        growth: { label: 'Growth', format: (sign, value) => Number.isFinite(value) ? value.toFixed(2) : `${value}` },
    }
    print_objects(ns, batch.map(o=>({...o,...o.data})), headers);
}

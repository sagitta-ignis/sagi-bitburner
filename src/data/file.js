import { mergeWith } from 'library/lodash/mergewith.js';

/**
 * @param {NS} ns
 * @param {string} filename
 * @param {any} data
 */
export async function update_data_file(ns, filename, data, merging = true) {
    let content = read_data_file(ns, filename);
    if (merging) {
        mergeWith(content, data, (obj, src) => {
            if (_.isArray(obj)) {
                return obj.concat(src);
            }
        });
    } else {
        content = data;
    }
	await ns.write(data_path(filename), JSON.stringify(content, undefined, 2), "w");
}

/**
 * @param {NS} ns
 * @param {string} filename
 */
export function read_data_file(ns, filename) {
    return JSON.parse(ns.read(data_path(filename))||'{}');
}

/**
 * @param {string} filename
 */
function data_path(filename) {
    return `/data/${filename}.txt`;
}
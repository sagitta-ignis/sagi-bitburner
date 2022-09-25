import { DateTime } from 'library/luxon.js';

/** @param {NS} ns */
export function date_format(ns, date, format) {
	if (typeof date === 'number' || typeof date === 'string') {
		date = new Date(date);
	}
	if (!(date instanceof Date)) {
		throw new Error(`Trying format date with wrong value type, received : ${date}`);
	}
	if (format) {
		return DateTime.fromJSDate(date).toFormat(format);
	}
	return DateTime.fromJSDate(date).toISO();
}
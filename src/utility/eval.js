/**
 * @param {NS} ns
 * @param {string} expression 	to evaluate
 * @param {string} data 		provided to expresion
 * @return {string} 			result of evaluated expresion using given data.
 */
 export function _eval(ns, expression = 'undefined', data = {}) {
	return eval(`(({${Object.keys(data).join(',')}}) => ${expression})(${JSON.stringify(data)})`);
}
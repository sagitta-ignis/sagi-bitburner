/**
 * @param {NS} ns
 * @param {Array<>} values
 * @param {{ [index: string]: Header }} configuration
 */
 export function print_objects(ns, values, configuration) {
    if (values.length <= 0) return;
    const reducers = {};
    /** @type {{ [index: string]: Header }} */
    const headers = Object.entries(configuration).reduce((headers, [attribute, cfg]) => {
		headers[attribute] = cfg.label;
        reducers[attribute] = undefined;
		return headers;
	}, {});
    const rows = values.map(v => {
        for (let [attribute, value] of Object.entries(v)) {
            if (typeof configuration[attribute]?.reduce === 'function') {
                    reducers[attribute] = configuration[attribute].reduce(reducers[attribute], value, v);
            }
        }
        return toRow(ns, v, configuration);
    });
    const footers = toRow(ns, reducers, configuration);
    /** @type {{ [index: string]: Padding }} */
    const paddings = [headers,footers].concat(rows).reduce(
        (paddings,row) => Object.entries(row)
            .reduce((paddings, [attribute, value]) => {
                if (!paddings[attribute]) {
                    paddings[attribute] = {
                        align: configuration[attribute].align
                    };
                }
                if (!Number.isFinite(paddings[attribute].length) || paddings[attribute].length < value.length) {
                    paddings[attribute].length = value.length;
                }
                return paddings;
            }, paddings)
        , {});
    const titles = formatRow(headers, paddings);
	ns.print(''.padStart(titles.length,'-'));
    ns.print(titles);
	ns.print(''.padStart(titles.length,'-'));
	for(let row of rows) {
        ns.print(formatRow(row, paddings));
	}
    ns.print(''.padStart(titles.length,'-'));
    ns.print(formatRow(footers, paddings));
	ns.print(''.padStart(titles.length,'-'));
}

/**
 * @param {NS} ns
 * @param {{ [index: string]: string }} values
 * @param {{ [index: string]: Padding }} paddings
 */
function formatRow(values, paddings) {
    const row = Object.entries(values)
        .map(([attribute, value]) => {
            const padding = paddings[attribute];
            const length = padding.length||0;
            const filler = padding.filler;
            if (value==null) value = '';
            if (!(typeof value === 'string')) value = `${value}`;
            if (padding.align === 'start') {
                value = value.padEnd(length, filler);
            } else {
                 value = value.padStart(length, filler);
            }
            return value;
        })
        .join(' |   ');
    return `| ${row} |`;
}

/**
 * @param {NS} ns
 * @param {{ [index: string]: any }} values
 * @param {{ [index: string]: Header }} headers
 */
export function toRow(ns, values, headers) {
    return Object.entries(headers).reduce((row, [attribute, header]) => {
        if (header.skip != null && typeof header.skip === 'function' && header.skip(values)) return row;
        const value = values[attribute];
		let formatted = '';
		switch(typeof value) {
			case 'number':
                if (header.signed) formatted = `${value>0?'+':''}`;
                if (header.format != null && typeof header.format === 'function') {
                    formatted = header.format(formatted, value, values);
                } else {
                    formatted += `${value}`;
                }
                break;
            default:
                if (value != null) {
                    if (header.format != null && typeof header.format === 'function') {
                        formatted = header.format(formatted, value, values);
                    } else {
                        formatted = `${value}`;
                    }  
                }
		}
		row[attribute] = formatted;
        return row;
	}, {});
}
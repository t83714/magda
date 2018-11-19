export function getValuesFrequency(data: any[]): any {
    let values: any = {};

    for (let value of data) {
        values[value] = (values[value] || 0) + 1;
    }

    values = Object.entries(values).sort(
        (a, b) => (a[0] === "null" ? -1 : b[1] - a[1])
    );

    // put null at the start, order by descending count
    return {
        informationGain: entropy(values, data),
        values
    };
}

export function entropy(values: any, data: any): number {
    let output = 0;

    // output = sum p(x) log_2 p(x)
    for (const value of values) {
        const probabilityOfValue = value[1] / data.length;
        output +=
            (probabilityOfValue * Math.log(probabilityOfValue)) / Math.log(2);
    }

    return -output;
}

export function matchesRegex(data: any, ...regex: RegExp[]): boolean {
    for (const item of data) {
        if (item === null) {
            continue;
        }
        let matches = false;
        for (const reg of regex) {
            matches = matches || reg.test(item);
        }
        if (!matches) {
            return false;
        }
    }
    return true;
}

export function isWithinRange(min: any, max: any, data: any) {
    for (const item of data) {
        if (item != null && (item < min || item > max)) {
            return false;
        }
    }
    return true;
}

export function produceStatistics(data: any, frequencies: any) {
    const values = data.filter((item: any) => item !== null);
    const sorted = values.slice(0).sort((a: number, b: number) => a - b);
    const sum = values.reduce((a: number, b: number) => a + b, 0);
    const count = values.length;
    const mean = sum / count;
    const minimum = sorted[0];
    const maximum = sorted[count - 1];
    if (minimum === maximum) {
        return {
            count,
            sum,
            mean,
            minimum,
            maximum
        };
    }

    let standardDeviation = 0;
    for (const item of values) {
        standardDeviation += Math.pow(item - mean, 2);
    }
    standardDeviation = Math.sqrt(standardDeviation / count);
    const mode = parseFloat(frequencies[0][0]);

    const median = getQuartile(sorted, 0.5);
    const quartile1 = getQuartile(sorted, 0.25);
    const quartile3 = getQuartile(sorted, 0.75);
    const skewness = (mean - mode) / standardDeviation;
    const histogram = produceHistoram(sorted);
    return {
        count,
        sum,
        mean,
        minimum,
        maximum,
        standardDeviation,
        mode,
        median,
        quartile1,
        quartile3,
        skewness,
        histogram
    };
}

function getQuartile(sorted: any, ratio: number): number {
    if (sorted.length < 3) {
        return undefined;
    }
    const even = sorted.length % 2 === 0;
    const index = Math.floor(sorted.length * ratio);
    if (even) {
        return (sorted[index] + sorted[index + 1]) / 2;
    } else {
        return sorted[index];
    }
}

function produceHistoram(sorted: any, bins: number = -1): any {
    if (sorted.length < 3) {
        return undefined;
    }
    if (bins < 1) {
        bins = Math.round(
            Math.max(3, 3 + Math.log(sorted.length) / Math.log(2))
        );
    }

    const histogram = [];
    for (let x = 0; x < bins; x++) {
        histogram[x] = 0;
    }

    const start = sorted[0];
    const range = sorted[sorted.length - 1] - start;

    for (const value of sorted) {
        const bin = Math.min(
            Math.floor(((value - start) / range) * bins),
            bins - 1
        );
        histogram[bin] += 1;
    }

    return histogram;
}

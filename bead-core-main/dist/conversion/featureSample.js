const NEIGHBORS_4 = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
];
function colorKey(r, g, b, bits = 4) {
    const shift = 8 - bits;
    return `${r >> shift},${g >> shift},${b >> shift}`;
}
function luminance(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
}
function chroma(r, g, b) {
    return Math.max(r, g, b) - Math.min(r, g, b);
}
/** 统计全图稀有色（眼睛、腮红、项圈等），排除大面积底色 */
export function analyzeFeatureColors(pixels, width, height) {
    const hist = new Map();
    let total = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (pixels[i + 3] < 128)
                continue;
            total++;
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const key = colorKey(r, g, b);
            const bucket = hist.get(key);
            if (bucket) {
                bucket.count++;
                bucket.r += r;
                bucket.g += g;
                bucket.b += b;
            }
            else {
                hist.set(key, { count: 1, r, g, b });
            }
        }
    }
    const ranked = [...hist.entries()].sort((a, b) => b[1].count - a[1].count);
    const backgroundKeys = new Set(ranked
        .filter(([, bucket]) => bucket.count / Math.max(1, total) >= 0.04)
        .slice(0, 2)
        .map(([key]) => key));
    if (backgroundKeys.size === 0 && ranked.length > 0) {
        backgroundKeys.add(ranked[0][0]);
    }
    const featureKeys = new Set();
    const tinyFeatureKeys = new Set();
    const tinyLimit = Math.max(24, Math.floor(total * 0.008));
    for (const [key, bucket] of hist) {
        if (backgroundKeys.has(key))
            continue;
        const ratio = bucket.count / Math.max(1, total);
        const mean = {
            r: Math.round(bucket.r / bucket.count),
            g: Math.round(bucket.g / bucket.count),
            b: Math.round(bucket.b / bucket.count),
        };
        const sat = chroma(mean.r, mean.g, mean.b);
        const lum = luminance(mean.r, mean.g, mean.b);
        if (ratio < 0.14 || sat >= 28 || lum < 80) {
            featureKeys.add(key);
        }
        if (bucket.count <= tinyLimit) {
            tinyFeatureKeys.add(key);
        }
    }
    return { featureKeys, backgroundKeys, tinyFeatureKeys };
}
/**
 * 将眼睛、腮红等微小色块向外扩 1 像素，避免降采样时落在格缝上被吞掉。
 */
export function dilateTinyFeatures(pixels, width, height, analysis) {
    const { backgroundKeys, tinyFeatureKeys } = analysis;
    if (tinyFeatureKeys.size === 0)
        return pixels;
    const out = new Uint8ClampedArray(pixels);
    const seeds = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (pixels[i + 3] < 128)
                continue;
            const key = colorKey(pixels[i], pixels[i + 1], pixels[i + 2]);
            if (!tinyFeatureKeys.has(key))
                continue;
            seeds.push({ x, y, r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] });
        }
    }
    for (const seed of seeds) {
        for (const [dx, dy] of NEIGHBORS_4) {
            const nx = seed.x + dx;
            const ny = seed.y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height)
                continue;
            const ni = (ny * width + nx) * 4;
            if (pixels[ni + 3] < 128)
                continue;
            const nKey = colorKey(pixels[ni], pixels[ni + 1], pixels[ni + 2]);
            if (!backgroundKeys.has(nKey))
                continue;
            out[ni] = seed.r;
            out[ni + 1] = seed.g;
            out[ni + 2] = seed.b;
            out[ni + 3] = 255;
        }
    }
    return out;
}
function sampleDominantInCell(pixels, imgWidth, x0, y0, x1, y1) {
    const buckets = new Map();
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const i = (y * imgWidth + x) * 4;
            if (pixels[i + 3] < 128)
                continue;
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const key = `${r >> 3},${g >> 3},${b >> 3}`;
            const bucket = buckets.get(key);
            if (bucket) {
                bucket.count++;
                bucket.r += r;
                bucket.g += g;
                bucket.b += b;
            }
            else {
                buckets.set(key, { count: 1, r, g, b });
            }
        }
    }
    let best = null;
    for (const bucket of buckets.values()) {
        if (!best || bucket.count > best.count)
            best = bucket;
    }
    if (!best)
        return null;
    return {
        r: Math.round(best.r / best.count),
        g: Math.round(best.g / best.count),
        b: Math.round(best.b / best.count),
    };
}
/**
 * 格内采样：稀有特征色（眼睛/腮红/项圈）> 描边 > 主色。
 */
export function sampleCellFeatureAware(pixels, imgWidth, x0, y0, x1, y1, analysis) {
    const featureBuckets = new Map();
    let darkest = null;
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const i = (y * imgWidth + x) * 4;
            if (pixels[i + 3] < 128)
                continue;
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const key = colorKey(r, g, b);
            const lum = luminance(r, g, b);
            if (analysis.featureKeys.has(key)) {
                const sat = chroma(r, g, b);
                const score = 1 + sat / 16 + (lum < 72 ? 0.5 : 0);
                const bucket = featureBuckets.get(key);
                if (bucket) {
                    bucket.score += score;
                    bucket.count++;
                    bucket.r += r;
                    bucket.g += g;
                    bucket.b += b;
                }
                else {
                    featureBuckets.set(key, { score, count: 1, r, g, b });
                }
            }
            if (lum < 72) {
                if (!darkest || lum < darkest.lum)
                    darkest = { r, g, b, lum };
            }
        }
    }
    if (featureBuckets.size > 0) {
        let best = null;
        for (const bucket of featureBuckets.values()) {
            if (!best || bucket.score > best.score)
                best = bucket;
        }
        if (best) {
            return {
                r: Math.round(best.r / best.count),
                g: Math.round(best.g / best.count),
                b: Math.round(best.b / best.count),
            };
        }
    }
    if (darkest)
        return { r: darkest.r, g: darkest.g, b: darkest.b };
    return sampleDominantInCell(pixels, imgWidth, x0, y0, x1, y1);
}

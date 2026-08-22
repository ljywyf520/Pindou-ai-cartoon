export function srgbToLinear(channel) {
    const n = channel / 255;
    return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}
export function linearToSrgb(channel) {
    const c = channel <= 0.0031308 ? channel * 12.92 : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(c * 255)));
}
export function clampRgb(rgb) {
    return {
        r: Math.max(0, Math.min(255, Math.round(rgb.r))),
        g: Math.max(0, Math.min(255, Math.round(rgb.g))),
        b: Math.max(0, Math.min(255, Math.round(rgb.b))),
    };
}
export function linearAverageToSrgb(rLin, gLin, bLin, weight) {
    if (weight <= 0)
        return null;
    return {
        r: linearToSrgb(rLin / weight),
        g: linearToSrgb(gLin / weight),
        b: linearToSrgb(bLin / weight),
    };
}
export function relativeLuminance(rgb) {
    const r = srgbToLinear(rgb.r);
    const g = srgbToLinear(rgb.g);
    const b = srgbToLinear(rgb.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

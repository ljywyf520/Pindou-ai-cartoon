import { convertImageToPattern } from '../conversion/convertImageToPattern.js';
export { convertImageToPattern } from '../conversion/convertImageToPattern.js';
export function mapImageToGrid(pixels, imgWidth, imgHeight, options) {
    return convertImageToPattern(pixels, imgWidth, imgHeight, options);
}
export function cloneGrid(grid) {
    return grid.map((row) => row.map((cell) => ({ ...cell })));
}
export function gridDimensions(grid) {
    return { width: grid[0]?.length ?? 0, height: grid.length };
}

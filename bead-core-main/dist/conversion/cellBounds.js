/** 降采样时单格在源图上的像素边界（无间隙、无重叠） */
export function cellBounds(imgWidth, imgHeight, gridWidth, gridHeight, col, row) {
    const x0 = Math.floor((col * imgWidth) / gridWidth);
    const y0 = Math.floor((row * imgHeight) / gridHeight);
    const x1 = Math.min(imgWidth, Math.ceil(((col + 1) * imgWidth) / gridWidth));
    const y1 = Math.min(imgHeight, Math.ceil(((row + 1) * imgHeight) / gridHeight));
    return { x0, y0, x1: Math.max(x0 + 1, x1), y1: Math.max(y0 + 1, y1) };
}

/** 转换阶段不做额外模糊处理；锐化/对比度由 prepareSourcePixels 统一负责 */
export function preprocessForConversion(pixels, _width, _height, _mode) {
    return pixels;
}

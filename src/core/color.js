export const PRIMITIVE_COLORS_RGB = {
    'black': [0,0,0], 'white': [255,255,255], 'red': [255,0,0],
    'green': [0,255,0], 'blue': [0,0,255], 'cyan': [0,255,255],
    'magenta': [255,0,255], 'yellow': [255,255,0]
};

export function getPixelColor(imageData, x, y) {
    x = Math.max(0, Math.min(Math.floor(x), imageData.width - 1)); 
    y = Math.max(0, Math.min(Math.floor(y), imageData.height - 1));
    const index = (y * imageData.width + x) * 4;
    return { 
        r: imageData.data[index], 
        g: imageData.data[index + 1], 
        b: imageData.data[index + 2], 
        a: imageData.data[index + 3] 
    };
}

export function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h * 360, s * 100, l * 100];
}

export function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) { r = g = b = l; } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1; if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        let p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export function shiftHue(r, g, b, degree) {
    let [h, s, l] = rgbToHsl(r, g, b);
    h = (h + degree) % 360; if (h < 0) h += 360;
    return hslToRgb(h, s, l);
}
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const { Delaunay } = require('d3-delaunay');

const GOLDEN_RATIO_CONJUGATE = parseFloat(((Math.sqrt(5) - 1) / 2).toFixed(4));
function getPixelColor(imageData, x, y) {
    x = Math.max(0, Math.min(Math.floor(x), imageData.width - 1));
    y = Math.max(0, Math.min(Math.floor(y), imageData.height - 1));
    const index = (y * imageData.width + x) * 4;
    return { r: imageData.data[index], g: imageData.data[index + 1], b: imageData.data[index + 2], a: imageData.data[index + 3] };
}
function generateEdgeAwareSeeds(numDesiredSeeds, width, height, imageData) {
    const seeds = [];
    const numCandidates = numDesiredSeeds * 20;
    const candidatesInfo = [];
    const baseWeight = 0.05;
    const grayscale = new Uint8Array(width * height);
    let maxMagnitude = 0;
    const magnitudes = new Float32Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            const r = imageData.data[i*4]; const g = imageData.data[i*4+1]; const b = imageData.data[i*4+2];
            grayscale[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        }
    }
    const sobelX = [[-1,0,1],[-2,0,2],[-1,0,1]]; const sobelY = [[-1,-2,-1],[0,0,0],[1,2,1]];
    for (let y = 1; y < height-1; y++) {
        for (let x = 1; x < width-1; x++) {
            let Gx = 0, Gy = 0;
            for(let k_y = -1; k_y <= 1; k_y++) {
                for (let k_x = -1; k_x <= 1; k_x++) {
                    const val = grayscale[(y + k_y) * width + (x + k_x)];
                    Gx += val * sobelX[k_y+1][k_x+1]; Gy += val * sobelY[k_y+1][k_x+1];
                }
            }
            const mag = Math.sqrt(Gx*Gx + Gy*Gy);
            magnitudes[y * width + x] = mag;
            if (mag > maxMagnitude) maxMagnitude = mag;
        }
    }
    for (let i = 0; i < numCandidates; i++) {
        const x = Math.floor(Math.random() * (width-2)) + 1; const y = Math.floor(Math.random() * (height-2)) + 1;
        let edgeComponent = (maxMagnitude > 0) ? (magnitudes[y * width + x] / maxMagnitude) : 0;
        candidatesInfo.push({ point: [x, y], weight: baseWeight + (1.0 - baseWeight) * edgeComponent });
    }
    candidatesInfo.sort((a, b) => b.weight - a.weight);
    const numPerEdge = 10;
    for (let i = 0; i <= numPerEdge; i++) {
        seeds.push([i * width / numPerEdge, 0]); seeds.push([i * width / numPerEdge, height - 1]);
        seeds.push([0, i * height / numPerEdge]); seeds.push([width - 1, i * height / numPerEdge]);
    }
    for (const cand of candidatesInfo) {
        if (seeds.length >= numDesiredSeeds) break;
        seeds.push(cand.point);
    }
    return seeds;
}

async function generateSVG(imagePath, outputPath, numSeeds) {
    const img = await loadImage(imagePath);
    const width = img.width; const height = img.height;
    const sourceCanvas = createCanvas(width, height);
    const sourceCtx = sourceCanvas.getContext('2d');
    sourceCtx.drawImage(img, 0, 0);
    const originalImageData = sourceCtx.getImageData(0, 0, width, height);

    const seeds = generateEdgeAwareSeeds(numSeeds, width, height, originalImageData);
    const delaunay = Delaunay.from(seeds);

    let svgString = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background-color: transparent;">\n`;

    for (let i = 0; i < delaunay.triangles.length; i += 3) {
        const p1 = seeds[delaunay.triangles[i]]; const p2 = seeds[delaunay.triangles[i+1]]; const p3 = seeds[delaunay.triangles[i+2]];
        if (!p1 || !p2 || !p3) continue;
        const centerX = (p1[0] + p2[0] + p3[0]) / 3; const centerY = (p1[1] + p2[1] + p3[1]) / 3;
        const color = getPixelColor(originalImageData, centerX, centerY);
        const fill = `rgb(${color.r},${color.g},${color.b})`;
        const stroke = `rgba(${Math.floor(color.r*0.7)},${Math.floor(color.g*0.7)},${Math.floor(color.b*0.7)},0.6)`;
        svgString += `  <polygon points="${p1[0].toFixed(2)},${p1[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)} ${p3[0].toFixed(2)},${p3[1].toFixed(2)}" fill="${fill}" stroke="${stroke}" stroke-width="0.3" />\n`;
    }
    svgString += `</svg>`;
    fs.writeFileSync(outputPath, svgString);
    console.log(`Saved SVG: ${outputPath}`);
}

async function main() {
    await generateSVG('Mona_Lisa.png', 'assets/Mona_Lisa.svg', 333);
    await generateSVG('Marilyn_Monroe.jpg', 'assets/Marilyn_Monroe.svg', 333);
}
main().catch(console.error);
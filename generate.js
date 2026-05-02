const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const { Delaunay } = require('d3-delaunay');

const GOLDEN_RATIO_CONJUGATE = parseFloat(((Math.sqrt(5) - 1) / 2).toFixed(4));

function getPixelColor(imageData, x, y) {
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

function addBoundarySeeds(currentSeeds, width, height, numPerEdge) {
    const boundarySeeds = [];
    if (width <= 0 || height <= 0 || numPerEdge < 0) return currentSeeds;

    if (numPerEdge === 0 && currentSeeds.length === 0) {
        boundarySeeds.push([0,0]); boundarySeeds.push([width-1, 0]);
        boundarySeeds.push([0, height-1]); boundarySeeds.push([width-1, height-1]);
    } else if (numPerEdge > 0) {
        for (let i = 0; i <= numPerEdge; i++) {
            const x = Math.round(i * (width - 1) / numPerEdge);
            boundarySeeds.push([x, 0]);
            boundarySeeds.push([x, height - 1]);
        }
        for (let i = 1; i < numPerEdge; i++) {
            const y = Math.round(i * (height - 1) / numPerEdge);
            boundarySeeds.push([0, y]);
            boundarySeeds.push([width - 1, y]);
        }
    }

    let allSeeds = currentSeeds.concat(boundarySeeds);
    const uniqueSeedsSet = new Set();
    const uniqueSeedsArray = [];
    for (const seed of allSeeds) {
        const key = `${Math.round(seed[0])},${Math.round(seed[1])}`;
        if (!uniqueSeedsSet.has(key)) {
            uniqueSeedsSet.add(key);
            uniqueSeedsArray.push(seed);
        }
    }
    return uniqueSeedsArray;
}

function generateSeeds(numDesiredSeeds, powerFactor, edgeThreshold, edgeWeightFactor, minDistance, width, height, imageData) {
    const seeds = [];
    const numCandidates = numDesiredSeeds * 20;
    const candidatesInfo = [];
    const baseWeight = 0.02;

    const grayscale = new Uint8Array(width * height);
    let maxMagnitude = 0;

    for (let y_scan = 0; y_scan < height; y_scan++) {
        for (let x_scan = 0; x_scan < width; x_scan++) {
            const i_scan = y_scan * width + x_scan;
            const r = imageData.data[i_scan*4];
            const g = imageData.data[i_scan*4+1];
            const b = imageData.data[i_scan*4+2];
            grayscale[i_scan] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

            if (edgeWeightFactor > 0 && edgeWeightFactor <=1 ) {
                let Gx_scan = 0, Gy_scan = 0;
                const sobelX = [[-1,0,1],[-2,0,2],[-1,0,1]];
                const sobelY = [[-1,-2,-1],[0,0,0],[1,2,1]];
                for(let k_y = -1; k_y <= 1; k_y++) {
                    for (let k_x = -1; k_x <= 1; k_x++) {
                        const currentY = y_scan + k_y;
                        const currentX = x_scan + k_x;
                        if (currentY >= 0 && currentY < height && currentX >= 0 && currentX < width) {
                            Gx_scan += grayscale[currentY * width + currentX] * sobelX[k_y+1][k_x+1];
                            Gy_scan += grayscale[currentY * width + currentX] * sobelY[k_y+1][k_x+1];
                        }
                    }
                }
                let magnitude_scan = Math.sqrt(Gx_scan*Gx_scan + Gy_scan*Gy_scan);
                if (magnitude_scan > maxMagnitude) maxMagnitude = magnitude_scan;
            }
        }
    }

    for (let i = 0; i < numCandidates; i++) {
        const candX = Math.random() * width;
        const candY = Math.random() * height;
        const x = Math.floor(candX);
        const y = Math.floor(candY);
        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const grayIndex = y * width + x;
        const brightness = grayscale[grayIndex] / 255.0;
        const invertedBrightness = 1.0 - brightness;
        const darknessComponent = Math.pow(invertedBrightness, powerFactor);

        let edgeComponent = 0;
        if (edgeWeightFactor > 0 && edgeWeightFactor <=1) {
            let Gx = 0, Gy = 0;
            const sobelX = [[-1,0,1],[-2,0,2],[-1,0,1]];
            const sobelY = [[-1,-2,-1],[0,0,0],[1,2,1]];
             for(let k_y = -1; k_y <= 1; k_y++) {
                for (let k_x = -1; k_x <= 1; k_x++) {
                    const currentY = y + k_y;
                    const currentX = x + k_x;
                    if (currentY >= 0 && currentY < height && currentX >= 0 && currentX < width) {
                        Gx += grayscale[currentY * width + currentX] * sobelX[k_y+1][k_x+1];
                        Gy += grayscale[currentY * width + currentX] * sobelY[k_y+1][k_x+1];
                    }
                }
            }
            let magnitude = Math.sqrt(Gx*Gx + Gy*Gy);
            if (magnitude > edgeThreshold) {
                edgeComponent = (maxMagnitude > 0) ? (magnitude / maxMagnitude) : 0;
            }
        }

        const combinedRawWeight = edgeWeightFactor * edgeComponent + (1.0 - edgeWeightFactor) * darknessComponent;
        const weight = baseWeight + (1.0 - baseWeight) * Math.max(0, Math.min(1, combinedRawWeight));

        candidatesInfo.push({ point: [candX, candY], weight: weight });
    }

    candidatesInfo.sort((a, b) => b.weight - a.weight);
    const minDistanceSq = minDistance * minDistance;

    for (const candInfo of candidatesInfo) {
        if (seeds.length >= numDesiredSeeds) break;
        let tooClose = false;
        for (const s of seeds) {
            const distSq = Math.pow(s[0] - candInfo.point[0], 2) + Math.pow(s[1] - candInfo.point[1], 2);
            if (distSq < minDistanceSq) {
                tooClose = true; break;
            }
        }
        if (!tooClose) { seeds.push(candInfo.point); }
    }

    if (seeds.length < numDesiredSeeds) {
        let currentSeedKeys = new Set(seeds.map(s => `${Math.round(s[0])},${Math.round(s[1])}`));
        for (let i = 0; i < candidatesInfo.length && seeds.length < numDesiredSeeds; i++) {
             if (candidatesInfo[i].weight < baseWeight * 0.5 && seeds.length > numDesiredSeeds * 0.75) break;
             const key = `${Math.round(candidatesInfo[i].point[0])},${Math.round(candidatesInfo[i].point[1])}`;
             if (!currentSeedKeys.has(key)) {
                 seeds.push(candidatesInfo[i].point);
                 currentSeedKeys.add(key);
             }
        }
    }
    while (seeds.length < numDesiredSeeds) {
        seeds.push([Math.random() * width, Math.random() * height]);
    }
    while (seeds.length > numDesiredSeeds) {
        seeds.splice(Math.floor(Math.random() * seeds.length), 1);
    }
    return seeds;
}

async function processImage(imagePath, outputPath, options) {
    const img = await loadImage(imagePath);
    const width = img.width;
    const height = img.height;

    const sourceCanvas = createCanvas(width, height);
    const sourceCtx = sourceCanvas.getContext('2d');
    sourceCtx.drawImage(img, 0, 0);
    const originalImageData = sourceCtx.getImageData(0, 0, width, height);

    const baseSettings = {
        imageWidth: 1024,
        imageHeight: 1536,
        numSeeds: options.numSeeds || 666,
        numBoundarySeeds: 11,
        powerFactor: 0.1,
        edgeThreshold: 33,
        edgeWeightFactor: GOLDEN_RATIO_CONJUGATE,
        minDistance: 18
    };

    const currentArea = width * height;
    const baseArea = baseSettings.imageWidth * baseSettings.imageHeight;
    let areaScaleFactor = (baseArea > 0 && currentArea > 0) ? (currentArea / baseArea) : 1.0;
    areaScaleFactor = Math.max(0.1, Math.min(10.0, areaScaleFactor));

    const currentMinSide = Math.min(width, height);
    const baseMinSide = Math.min(baseSettings.imageWidth, baseSettings.imageHeight);
    let linearScaleFactor = (baseMinSide > 0 && currentMinSide > 0) ? (currentMinSide / baseMinSide) : 1.0;
    linearScaleFactor = Math.max(0.25, Math.min(4.0, linearScaleFactor));

    const actualNumSeeds = Math.max(100, Math.round(baseSettings.numSeeds * areaScaleFactor));
    const actualNumBoundarySeeds = Math.max(5, Math.round(baseSettings.numBoundarySeeds * linearScaleFactor));
    const actualMinDistance = Math.max(1, Math.round(baseSettings.minDistance * linearScaleFactor));
    const powerFactor = baseSettings.powerFactor;
    const edgeThreshold = baseSettings.edgeThreshold;
    const edgeWeightFactor = baseSettings.edgeWeightFactor;

    let seeds = generateSeeds(actualNumSeeds, powerFactor, edgeThreshold, edgeWeightFactor, actualMinDistance, width, height, originalImageData);
    seeds = addBoundarySeeds(seeds, width, height, actualNumBoundarySeeds);

    const pointsForDelaunay = seeds.map(s => [s[0], s[1]]);
    const delaunay = Delaunay.from(pointsForDelaunay);

    const outputCanvas = createCanvas(width, height);
    const outputCtx = outputCanvas.getContext('2d');
    
    // Draw background
    outputCtx.drawImage(img, 0, 0, width, height);

    for (let i = 0; i < delaunay.triangles.length; i += 3) {
        const p1_orig = pointsForDelaunay[delaunay.triangles[i]];
        const p2_orig = pointsForDelaunay[delaunay.triangles[i+1]];
        const p3_orig = pointsForDelaunay[delaunay.triangles[i+2]];
        if (!p1_orig || !p2_orig || !p3_orig) continue;

        outputCtx.beginPath();
        outputCtx.moveTo(p1_orig[0], p1_orig[1]);
        outputCtx.lineTo(p2_orig[0], p2_orig[1]);
        outputCtx.lineTo(p3_orig[0], p3_orig[1]);
        outputCtx.closePath();

        const centerX_orig = (p1_orig[0] + p2_orig[0] + p3_orig[0]) / 3;
        const centerY_orig = (p1_orig[1] + p2_orig[1] + p3_orig[1]) / 3;
        const color = getPixelColor(originalImageData, centerX_orig, centerY_orig);
        
        outputCtx.fillStyle = `rgba(${color.r},${color.g},${color.b},${color.a/255})`;
        outputCtx.fill();
        outputCtx.strokeStyle = `rgba(${Math.floor(color.r*0.8)},${Math.floor(color.g*0.8)},${Math.floor(color.b*0.8)},0.5)`;
        outputCtx.lineWidth = 0.5;
        outputCtx.stroke();
    }

    const buffer = outputCanvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Saved: ${outputPath}`);
}

async function main() {
    const inputImage = 'Mona_Lisa.png';
    await processImage(inputImage, 'Mona_Lisa_variant1.png', { numSeeds: 500 });
    await processImage(inputImage, 'Mona_Lisa_variant2.png', { numSeeds: 1000 });
    await processImage(inputImage, 'Mona_Lisa_variant3.png', { numSeeds: 2000 });
}

main().catch(console.error);

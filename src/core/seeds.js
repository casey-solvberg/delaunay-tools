export function addBoundarySeeds(currentSeeds, width, height, numPerEdge) {
    const bSeeds = [];
    if (width <= 0 || height <= 0 || numPerEdge < 0) return currentSeeds;
    
    if (numPerEdge > 0) {
        for (let i = 0; i <= numPerEdge; i++) {
            const x = Math.round(i * (width - 1) / numPerEdge);
            bSeeds.push([x, 0]);
            bSeeds.push([x, height - 1]);
        }
        for (let i = 1; i < numPerEdge; i++) {
            const y = Math.round(i * (height - 1) / numPerEdge);
            bSeeds.push([0, y]);
            bSeeds.push([width - 1, y]);
        }
    }
    
    let allSeeds = currentSeeds.concat(bSeeds);
    const unique = new Set(), res = [];
    for (const s of allSeeds) { 
        const k = `${Math.round(s[0])},${Math.round(s[1])}`; 
        if (!unique.has(k)) { unique.add(k); res.push(s); } 
    }
    return res;
}

export function generateSeeds(numDesiredSeeds, powerFactor, edgeThreshold, edgeWeightFactor, minDistance, width, height, imageData) {
    const seeds = []; 
    const numCandidates = numDesiredSeeds * 20; 
    const candidatesInfo = [];
    const grayscale = new Uint8Array(width * height); 
    let maxMag = 0;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x; 
            const r = imageData.data[i*4], g = imageData.data[i*4+1], b = imageData.data[i*4+2];
            grayscale[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            if (edgeWeightFactor > 0 && edgeWeightFactor <=1 ) {
                let Gx = 0, Gy = 0;
                for(let k_y = -1; k_y <= 1; k_y++) {
                    for (let k_x = -1; k_x <= 1; k_x++) {
                        const cY = y + k_y, cX = x + k_x;
                        if (cY >= 0 && cY < height && cX >= 0 && cX < width) {
                            const val = grayscale[cY * width + cX];
                            Gx += val * [[-1,0,1],[-2,0,2],[-1,0,1]][k_y+1][k_x+1]; 
                            Gy += val * [[-1,-2,-1],[0,0,0],[1,2,1]][k_y+1][k_x+1];
                        }
                    }
                }
                let mag = Math.sqrt(Gx*Gx + Gy*Gy); 
                if (mag > maxMag) maxMag = mag;
            }
        }
    }
    
    for (let i = 0; i < numCandidates; i++) {
        const cX = Math.random() * width, cY = Math.random() * height;
        const x = Math.floor(cX), y = Math.floor(cY);
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        
        const bness = grayscale[y * width + x] / 255.0; 
        const dark = Math.pow(1.0 - bness, powerFactor);
        let edgeC = 0;
        
        if (edgeWeightFactor > 0 && edgeWeightFactor <=1) {
            let Gx = 0, Gy = 0;
             for(let k_y = -1; k_y <= 1; k_y++) {
                for (let k_x = -1; k_x <= 1; k_x++) {
                    const cY = y + k_y, cX = x + k_x;
                    if (cY >= 0 && cY < height && cX >= 0 && cX < width) {
                        const val = grayscale[cY * width + cX];
                        Gx += val * [[-1,0,1],[-2,0,2],[-1,0,1]][k_y+1][k_x+1]; 
                        Gy += val * [[-1,-2,-1],[0,0,0],[1,2,1]][k_y+1][k_x+1];
                    }
                }
            }
            let mag = Math.sqrt(Gx*Gx + Gy*Gy);
            if (mag > edgeThreshold) edgeC = (maxMag > 0) ? (mag / maxMag) : 0;
        }
        
        // Формула с инвертированной темнотой и обычным Собелем
        const cWeight = edgeWeightFactor * edgeC + (1.0 - edgeWeightFactor) * (1.0 - dark);
        
        candidatesInfo.push({ point: [cX, cY], weight: 0.02 + 0.98 * Math.max(0, Math.min(1, cWeight)) });
    }
    
    candidatesInfo.sort((a, b) => b.weight - a.weight); 
    const minDSq = minDistance * minDistance;
    
    for (const c of candidatesInfo) {
        if (seeds.length >= numDesiredSeeds) break;
        let tooClose = false;
        for (const s of seeds) { 
            if (Math.pow(s[0]-c.point[0],2) + Math.pow(s[1]-c.point[1],2) < minDSq) { 
                tooClose = true; break; 
            } 
        }
        if (!tooClose) seeds.push(c.point);
    }
    
    if (seeds.length < numDesiredSeeds) {
        let uSet = new Set(seeds.map(s => `${Math.round(s[0])},${Math.round(s[1])}`));
        for (let i = 0; i < candidatesInfo.length && seeds.length < numDesiredSeeds; i++) {
             if (candidatesInfo[i].weight < 0.01 && seeds.length > numDesiredSeeds * 0.75) break;
             const k = `${Math.round(candidatesInfo[i].point[0])},${Math.round(candidatesInfo[i].point[1])}`;
             if (!uSet.has(k)) { seeds.push(candidatesInfo[i].point); uSet.add(k); }
        }
    }
    
    while (seeds.length < numDesiredSeeds) seeds.push([Math.random() * width, Math.random() * height]);
    return seeds;
}
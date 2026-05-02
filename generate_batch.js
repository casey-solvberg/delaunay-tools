const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const { Delaunay } = require('d3-delaunay');

const GOLDEN_RATIO_CONJUGATE = parseFloat(((Math.sqrt(5) - 1) / 2).toFixed(4));
const PRIMITIVE_COLORS = {
    'black': '#000000', 'white': '#FFFFFF', 'red': '#FF0000',
    'green': '#00FF00', 'blue': '#0000FF', 'cyan': '#00FFFF',
    'magenta': '#FF00FF', 'yellow': '#FFFF00'
};

function getPixelColor(imageData, x, y) {
    x = Math.max(0, Math.min(Math.floor(x), imageData.width - 1));
    y = Math.max(0, Math.min(Math.floor(y), imageData.height - 1));
    const index = (y * imageData.width + x) * 4;
    return { r: imageData.data[index], g: imageData.data[index + 1], b: imageData.data[index + 2], a: imageData.data[index + 3] };
}

function distance(p1, p2) { return Math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2); }
function addPoints(p1,p2){return[p1[0]+p2[0],p1[1]+p2[1]];}
function subPoints(p1,p2){return[p1[0]-p2[0],p1[1]-p2[1]];}
function scalePointScalar(p,s){return[p[0]*s,p[1]*s];}
function getCentroid(v_a,v_b,v_c){return[(v_a[0]+v_b[0]+v_c[0])/3.0,(v_a[1]+v_b[1]+v_c[1])/3.0];}
function scaleVertexFromCenter(vertex, center, scaleFactor) {
    const [vx, vy] = subPoints(vertex, center);
    const [scaled_vx, scaled_vy] = scalePointScalar([vx, vy], scaleFactor);
    return addPoints(center, [scaled_vx, scaled_vy]);
}
function getBarycenter(v_a,v_b,v_c,m_a,m_b,m_c){
    const s_m=m_a+m_b+m_c;
    if(s_m < 1e-6) return getCentroid(v_a,v_b,v_c);
    return[(m_a*v_a[0]+m_b*v_b[0]+m_c*v_c[0])/s_m,(m_a*v_a[1]+m_b*v_b[1]+m_c*v_c[1])/s_m];
}
function decomposeRgbToQ(r_in, g_in, b_in) {
    let q_k = 255 - Math.max(r_in, g_in, b_in);
    let q_w_total = Math.min(r_in, g_in, b_in);
    let r_rem = r_in - q_w_total, g_rem = g_in - q_w_total, b_rem = b_in - q_w_total;
    let q_c = 0, q_m = 0, q_y = 0;
    if (r_rem > 0 && g_rem > 0 && b_rem == 0) { q_y = Math.min(r_rem, g_rem); r_rem -= q_y; g_rem -= q_y; }
    else if (r_rem > 0 && b_rem > 0 && g_rem == 0) { q_m = Math.min(r_rem, b_rem); r_rem -= q_m; b_rem -= q_m; }
    else if (g_rem > 0 && b_rem > 0 && r_rem == 0) { q_c = Math.min(g_rem, b_rem); g_rem -= q_c; b_rem -= q_c; }
    return {'K':q_k,'W_total':q_w_total,'C':q_c,'M':q_m,'Y':q_y,'R_pure':r_rem,'G_pure':g_rem,'B_pure':b_rem};
}

class Decomposer {
    constructor() { this.polygons = []; }
    addPoly(vertices, colorKey) {
        if (!vertices || vertices.length < 3) return;
        this.polygons.push({ vertices, colorKey });
    }
    decompose(v_a_orig, v_b_orig, v_c_orig, r_in, g_in, b_in) {
        const qValues = decomposeRgbToQ(r_in, g_in, b_in);
        const q_k = qValues['K'];
        const q_w_total = qValues['W_total'];
        const qCoreCandidates = [];
        const qKeyToPrimitiveName = {'C':'cyan','M':'magenta','Y':'yellow','R_pure':'red','G_pure':'green','B_pure':'blue'};
        Object.keys(qKeyToPrimitiveName).forEach(qKey => {
            if (qValues[qKey] > 0) qCoreCandidates.push({ name: qKeyToPrimitiveName[qKey], q: qValues[qKey] });
        });
        const qSumCore = qCoreCandidates.reduce((sum, item) => sum + item.q, 0);

        if (q_w_total === 255) { this.addPoly([v_a_orig, v_b_orig, v_c_orig], 'white'); return; }
        if (q_k === 255 && q_w_total === 0) {
            const p_apex = getCentroid(v_a_orig, v_b_orig, v_c_orig);
            this.addPoly([v_a_orig, v_b_orig, p_apex], 'black');
            this.addPoly([v_b_orig, v_c_orig, p_apex], 'black');
            this.addPoly([v_c_orig, v_a_orig, p_apex], 'black');
            return;
        }
        if (qSumCore === 255 && q_k === 0 && q_w_total === 0) {
            const p_apex = getCentroid(v_a_orig, v_b_orig, v_c_orig);
            const coreColor = qCoreCandidates[0].name;
            this.addPoly([v_a_orig, v_b_orig, p_apex], coreColor);
            this.addPoly([v_b_orig, v_c_orig, p_apex], coreColor);
            this.addPoly([v_c_orig, v_a_orig, p_apex], coreColor);
            return;
        }

        let t_eff_va = v_a_orig, t_eff_vb = v_b_orig, t_eff_vc = v_c_orig;
        const p_cen_orig = getCentroid(v_a_orig, v_b_orig, v_c_orig);

        if (q_w_total > 0) {
            let scaleFactorNum = qSumCore + q_k;
            let scaleFactorDenom = qSumCore + q_k + q_w_total;
            if (scaleFactorDenom < 1e-6) scaleFactorDenom = 1.0;
            const s_eff = Math.sqrt(scaleFactorNum / scaleFactorDenom);
            t_eff_va = scaleVertexFromCenter(v_a_orig, p_cen_orig, s_eff);
            t_eff_vb = scaleVertexFromCenter(v_b_orig, p_cen_orig, s_eff);
            t_eff_vc = scaleVertexFromCenter(v_c_orig, p_cen_orig, s_eff);
            this.addPoly([v_a_orig, v_b_orig, t_eff_vb, t_eff_va], 'white');
            this.addPoly([v_b_orig, v_c_orig, t_eff_vc, t_eff_vb], 'white');
            this.addPoly([v_c_orig, v_a_orig, t_eff_va, t_eff_vc], 'white');
        }

        if (qSumCore === 0 && q_k === 0) return;

        let p_bary_eff_for_apex = getCentroid(t_eff_va, t_eff_vb, t_eff_vc);

        if (qSumCore > 0) {
            qCoreCandidates.sort((a, b) => b.q - a.q || a.name.localeCompare(b.name));
            let mass_Va_contrib = 0, mass_Vb_contrib = 0, mass_Vc_contrib = 0;
            let color_face_VbVc, color_face_VcVa, color_face_VaVb;
            const cNames = qCoreCandidates.map(c => c.name);
            const qValuesForMass = qCoreCandidates.map(c => c.q);

            if (qCoreCandidates.length === 1) {
                color_face_VaVb = color_face_VbVc = color_face_VcVa = cNames[0];
                mass_Va_contrib = mass_Vb_contrib = mass_Vc_contrib = qValuesForMass[0];
            } else {
                const C1 = cNames[0], Q1 = qValuesForMass[0];
                const C2 = cNames[1], Q2 = qValuesForMass[1];
                const C3 = (cNames.length >= 3) ? cNames[2] : C2;
                const Q3 = (qValuesForMass.length >=3) ? qValuesForMass[2] : Q2;
                const sides = [
                    { faceKey: 'VbVc', len: distance(t_eff_vb, t_eff_vc), color: '', q: 0 },
                    { faceKey: 'VcVa', len: distance(t_eff_vc, t_eff_va), color: '', q: 0 },
                    { faceKey: 'VaVb', len: distance(t_eff_va, t_eff_vb), color: '', q: 0 }
                ];
                sides.sort((s1, s2) => s2.len - s1.len);
                sides[0].color = C1; sides[0].q = Q1;
                sides[1].color = C2; sides[1].q = Q2;
                sides[2].color = C3; sides[2].q = Q3;

                color_face_VbVc = sides.find(s => s.faceKey === 'VbVc').color;
                color_face_VcVa = sides.find(s => s.faceKey === 'VcVa').color;
                color_face_VaVb = sides.find(s => s.faceKey === 'VaVb').color;
                mass_Va_contrib = sides.find(s => s.faceKey === 'VbVc').q;
                mass_Vb_contrib = sides.find(s => s.faceKey === 'VcVa').q;
                mass_Vc_contrib = sides.find(s => s.faceKey === 'VaVb').q;
            }
            p_bary_eff_for_apex = getBarycenter(t_eff_va, t_eff_vb, t_eff_vc, mass_Va_contrib, mass_Vb_contrib, mass_Vc_contrib);

            let s_cut_factor;
            const denom_core_black = q_k + qSumCore;
            if (denom_core_black < 1e-6) s_cut_factor = 0;
            else s_cut_factor = Math.sqrt(Math.max(0, q_k) / denom_core_black);

            if (q_k > 0) {
                const v_a_cut = addPoints(p_bary_eff_for_apex, scalePointScalar(subPoints(t_eff_va, p_bary_eff_for_apex), s_cut_factor));
                const v_b_cut = addPoints(p_bary_eff_for_apex, scalePointScalar(subPoints(t_eff_vb, p_bary_eff_for_apex), s_cut_factor));
                const v_c_cut = addPoints(p_bary_eff_for_apex, scalePointScalar(subPoints(t_eff_vc, p_bary_eff_for_apex), s_cut_factor));

                this.addPoly([p_bary_eff_for_apex, v_b_cut, v_c_cut], 'black');
                this.addPoly([p_bary_eff_for_apex, v_c_cut, v_a_cut], 'black');
                this.addPoly([p_bary_eff_for_apex, v_a_cut, v_b_cut], 'black');

                this.addPoly([t_eff_vb, t_eff_vc, v_c_cut, v_b_cut], color_face_VbVc);
                this.addPoly([t_eff_vc, t_eff_va, v_a_cut, v_c_cut], color_face_VcVa);
                this.addPoly([t_eff_va, t_eff_vb, v_b_cut, v_a_cut], color_face_VaVb);
            } else {
                this.addPoly([p_bary_eff_for_apex, t_eff_vb, t_eff_vc], color_face_VbVc);
                this.addPoly([p_bary_eff_for_apex, t_eff_vc, t_eff_va], color_face_VcVa);
                this.addPoly([p_bary_eff_for_apex, t_eff_va, t_eff_vb], color_face_VaVb);
            }
        } else if (q_k > 0) {
            p_bary_eff_for_apex = getCentroid(t_eff_va, t_eff_vb, t_eff_vc);
            this.addPoly([p_bary_eff_for_apex, t_eff_vb, t_eff_vc], 'black');
            this.addPoly([p_bary_eff_for_apex, t_eff_vc, t_eff_va], 'black');
            this.addPoly([p_bary_eff_for_apex, t_eff_va, t_eff_vb], 'black');
        }
    }
}

// Full Edge-Aware Seed Generation to capture features correctly
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
            const r = imageData.data[i*4];
            const g = imageData.data[i*4+1];
            const b = imageData.data[i*4+2];
            grayscale[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        }
    }
    
    // Calculate Sobel
    const sobelX = [[-1,0,1],[-2,0,2],[-1,0,1]];
    const sobelY = [[-1,-2,-1],[0,0,0],[1,2,1]];
    for (let y = 1; y < height-1; y++) {
        for (let x = 1; x < width-1; x++) {
            let Gx = 0, Gy = 0;
            for(let k_y = -1; k_y <= 1; k_y++) {
                for (let k_x = -1; k_x <= 1; k_x++) {
                    const val = grayscale[(y + k_y) * width + (x + k_x)];
                    Gx += val * sobelX[k_y+1][k_x+1];
                    Gy += val * sobelY[k_y+1][k_x+1];
                }
            }
            const mag = Math.sqrt(Gx*Gx + Gy*Gy);
            magnitudes[y * width + x] = mag;
            if (mag > maxMagnitude) maxMagnitude = mag;
        }
    }

    let scoreSum = 0;
    for (let i = 0; i < numCandidates; i++) {
        const x = Math.floor(Math.random() * (width-2)) + 1;
        const y = Math.floor(Math.random() * (height-2)) + 1;
        
        let edgeComponent = (maxMagnitude > 0) ? (magnitudes[y * width + x] / maxMagnitude) : 0;
        let weight = baseWeight + (1.0 - baseWeight) * edgeComponent;
        candidatesInfo.push({ point: [x, y], weight: weight });
    }

    candidatesInfo.sort((a, b) => b.weight - a.weight);
    
    // Ensure boundary seeds
    const numPerEdge = 10;
    for (let i = 0; i <= numPerEdge; i++) {
        seeds.push([i * width / numPerEdge, 0]);
        seeds.push([i * width / numPerEdge, height - 1]);
        seeds.push([0, i * height / numPerEdge]);
        seeds.push([width - 1, i * height / numPerEdge]);
    }
    
    // Pick highest weight candidates
    for (const cand of candidatesInfo) {
        if (seeds.length >= numDesiredSeeds) break;
        seeds.push(cand.point);
        scoreSum += cand.weight; // Our artistic "score"
    }
    
    return { seeds, score: scoreSum };
}

async function generateBestVariant(imagePath, outputPrefix, numSeeds, iterations) {
    const img = await loadImage(imagePath);
    const width = img.width; const height = img.height;
    
    const sourceCanvas = createCanvas(width, height);
    const sourceCtx = sourceCanvas.getContext('2d');
    sourceCtx.drawImage(img, 0, 0);
    const originalImageData = sourceCtx.getImageData(0, 0, width, height);

    let bestScore = -1;
    let bestPolygons = null;
    let bestIteration = 0;

    console.log(`Generating ${iterations} variants for ${numSeeds} seeds...`);
    
    for(let it = 1; it <= iterations; it++) {
        const { seeds, score } = generateEdgeAwareSeeds(numSeeds, width, height, originalImageData);
        
        if (score > bestScore) {
            bestScore = score;
            bestIteration = it;
            
            const delaunay = Delaunay.from(seeds);
            const decomposer = new Decomposer();

            for (let i = 0; i < delaunay.triangles.length; i += 3) {
                const p1 = seeds[delaunay.triangles[i]];
                const p2 = seeds[delaunay.triangles[i+1]];
                const p3 = seeds[delaunay.triangles[i+2]];
                if (!p1 || !p2 || !p3) continue;

                const centerX = (p1[0] + p2[0] + p3[0]) / 3;
                const centerY = (p1[1] + p2[1] + p3[1]) / 3;
                const color = getPixelColor(originalImageData, centerX, centerY);
                
                decomposer.decompose(p1, p2, p3, color.r, color.g, color.b);
            }
            bestPolygons = decomposer.polygons;
        }
    }
    
    console.log(`Best variant for ${numSeeds} seeds was iteration ${bestIteration} with Edge Score: ${bestScore.toFixed(2)}`);

    // Render best
    const outputCanvas = createCanvas(width, height);
    const outputCtx = outputCanvas.getContext('2d');
    
    outputCtx.fillStyle = '#FFFFFF';
    outputCtx.fillRect(0, 0, width, height);

    for (const poly of bestPolygons) {
        outputCtx.beginPath();
        outputCtx.moveTo(poly.vertices[0][0], poly.vertices[0][1]);
        for(let v=1; v<poly.vertices.length; v++) {
            outputCtx.lineTo(poly.vertices[v][0], poly.vertices[v][1]);
        }
        outputCtx.closePath();
        outputCtx.fillStyle = PRIMITIVE_COLORS[poly.colorKey] || '#888888';
        outputCtx.fill();
        // Minimal outline for 3D look
        outputCtx.strokeStyle = 'rgba(0,0,0,0.1)';
        outputCtx.lineWidth = 0.5;
        outputCtx.stroke();
    }

    const outputPath = `${outputPrefix}_${numSeeds}.png`;
    const buffer = outputCanvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Saved selected masterpiece: ${outputPath}`);
}

async function main() {
    await generateBestVariant('Marilyn_Monroe.jpg', 'assets/Marilyn_Monroe_curated', 111, 11);
    await generateBestVariant('Marilyn_Monroe.jpg', 'assets/Marilyn_Monroe_curated', 333, 11);
    await generateBestVariant('Marilyn_Monroe.jpg', 'assets/Marilyn_Monroe_curated', 666, 11);
}

main().catch(console.error);
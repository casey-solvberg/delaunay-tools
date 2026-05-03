import { distance, addPoints, subPoints, scalePointScalar, getCentroid, scaleVertexFromCenter, getBarycenter } from './math.js';

export function decomposeRgbToQ(r_in, g_in, b_in) {
    let q_k = 255 - Math.max(r_in, g_in, b_in);
    let q_w_total = Math.min(r_in, g_in, b_in);
    let r_rem = r_in - q_w_total, g_rem = g_in - q_w_total, b_rem = b_in - q_w_total;
    let q_c = 0, q_m = 0, q_y = 0;
    if (r_rem > 0 && g_rem > 0 && b_rem == 0) { q_y = Math.min(r_rem, g_rem); r_rem -= q_y; g_rem -= q_y; }
    else if (r_rem > 0 && b_rem > 0 && g_rem == 0) { q_m = Math.min(r_rem, b_rem); r_rem -= q_m; b_rem -= q_m; }
    else if (g_rem > 0 && b_rem > 0 && r_rem == 0) { q_c = Math.min(g_rem, b_rem); g_rem -= q_c; b_rem -= q_c; }
    return {'K':q_k,'W_total':q_w_total,'C':q_c,'M':q_m,'Y':q_y,'R_pure':r_rem,'G_pure':g_rem,'B_pure':b_rem};
}

export class Decomposer {
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
                color_face_VaVb = cNames[0]; color_face_VbVc = cNames[0]; color_face_VcVa = cNames[0];
                mass_Va_contrib = qValuesForMass[0]; mass_Vb_contrib = qValuesForMass[0]; mass_Vc_contrib = qValuesForMass[0]; 
            } else { 
                const C1 = cNames[0], Q1 = qValuesForMass[0], C2 = cNames[1], Q2 = qValuesForMass[1], C3 = (cNames.length >= 3) ? cNames[2] : C2, Q3 = (qValuesForMass.length >=3) ? qValuesForMass[2] : Q2;
                const sides_eff_color_assign = [ 
                    { faceKey: 'VbVc', len: distance(t_eff_vb, t_eff_vc), color: C1, q: Q1 }, 
                    { faceKey: 'VcVa', len: distance(t_eff_vc, t_eff_va), color: C2, q: Q2 }, 
                    { faceKey: 'VaVb', len: distance(t_eff_va, t_eff_vb), color: C3, q: Q3 }  
                ];
                sides_eff_color_assign.sort((s1, s2) => s2.len - s1.len);
                sides_eff_color_assign[0].color = C1; sides_eff_color_assign[0].q = Q1;
                sides_eff_color_assign[1].color = C2; sides_eff_color_assign[1].q = Q2;
                sides_eff_color_assign[2].color = C3; sides_eff_color_assign[2].q = Q3;
                color_face_VbVc = sides_eff_color_assign.find(s => s.faceKey === 'VbVc').color; 
                color_face_VcVa = sides_eff_color_assign.find(s => s.faceKey === 'VcVa').color; 
                color_face_VaVb = sides_eff_color_assign.find(s => s.faceKey === 'VaVb').color;
                mass_Va_contrib = sides_eff_color_assign.find(s => s.faceKey === 'VbVc').q; 
                mass_Vb_contrib = sides_eff_color_assign.find(s => s.faceKey === 'VcVa').q; 
                mass_Vc_contrib = sides_eff_color_assign.find(s => s.faceKey === 'VaVb').q;
            }
            
            p_bary_eff_for_apex = getBarycenter(t_eff_va, t_eff_vb, t_eff_vc, mass_Va_contrib, mass_Vb_contrib, mass_Vc_contrib);
            let s_cut_factor; const denom_core_black = q_k + qSumCore;
            if (denom_core_black < 1e-6) s_cut_factor = 0; else s_cut_factor = Math.sqrt(Math.max(0, q_k) / denom_core_black);

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
            this.addPoly([t_eff_va, t_eff_vb, t_eff_vc], 'black');
        }
    }
}
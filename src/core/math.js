export function distance(p1, p2) { 
    return Math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2); 
}

export function addPoints(p1, p2) { 
    return [p1[0]+p2[0], p1[1]+p2[1]]; 
}

export function subPoints(p1, p2) { 
    return [p1[0]-p2[0], p1[1]-p2[1]]; 
}

export function scalePointScalar(p, s) { 
    return [p[0]*s, p[1]*s]; 
}

export function getCentroid(v_a, v_b, v_c) { 
    return [(v_a[0]+v_b[0]+v_c[0])/3.0, (v_a[1]+v_b[1]+v_c[1])/3.0]; 
}

export function scaleVertexFromCenter(vertex, center, scaleFactor) {
    return addPoints(center, scalePointScalar(subPoints(vertex, center), scaleFactor));
}

export function getBarycenter(v_a, v_b, v_c, m_a, m_b, m_c) {
    const s_m = m_a + m_b + m_c; 
    if (s_m < 1e-6) return getCentroid(v_a, v_b, v_c);
    return [
        (m_a*v_a[0] + m_b*v_b[0] + m_c*v_c[0])/s_m, 
        (m_a*v_a[1] + m_b*v_b[1] + m_c*v_c[1])/s_m
    ];
}
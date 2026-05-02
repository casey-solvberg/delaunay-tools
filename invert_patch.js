const fs = require('fs');

// Список всех файлов, где может быть наша логика генерации точек
const filesToPatch = [
    'index.html',
    'decomposer.html',
    'hue_shift.html',
    'generate.js',
    'generate_batch.js',
    'generate_decomposed.js',
    'generate_svg_examples.js'
];

filesToPatch.forEach(file => {
    if (!fs.existsSync(file)) {
        console.log(`Файл ${file} не найден, пропускаем.`);
        return;
    }

    let content = fs.readFileSync(file, 'utf8');
    let patched = false;

    // 1. Патч для браузерных HTML (используется edgeC и dark)
    if (content.includes('edgeWeightFactor * edgeC +')) {
        content = content.replace(
            /const cWeight = edgeWeightFactor \* edgeC \+ \(1\.0 - edgeWeightFactor\) \* dark;/g,
            'const cWeight = edgeWeightFactor * (1.0 - edgeC) + (1.0 - edgeWeightFactor) * dark;'
        );
        patched = true;
    }

    // 2. Патч для generate.js (используется edgeComponent и darknessComponent)
    if (content.includes('edgeWeightFactor * edgeComponent +')) {
        content = content.replace(
            /const combinedRawWeight = edgeWeightFactor \* edgeComponent \+ \(1\.0 - edgeWeightFactor\) \* darknessComponent;/g,
            'const combinedRawWeight = edgeWeightFactor * (1.0 - edgeComponent) + (1.0 - edgeWeightFactor) * darknessComponent;'
        );
        patched = true;
    }

    // 3. Патч для скриптов куратора и SVG (используется только baseWeight и edgeComponent)
    if (content.includes('(1.0 - baseWeight) * edgeComponent')) {
        content = content.replace(
            /weight: baseWeight \+ \(1\.0 - baseWeight\) \* edgeComponent/g,
            'weight: baseWeight + (1.0 - baseWeight) * (1.0 - edgeComponent)'
        );
        patched = true;
    }

    if (patched) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`✅ Пропатчен: ${file}`);
    } else {
        console.log(`⚠️ В файле ${file} не найдены нужные строки (возможно, уже пропатчен).`);
    }
});

console.log('Готово! Логика Собеля инвертирована.');
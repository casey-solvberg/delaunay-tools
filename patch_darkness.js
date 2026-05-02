const fs = require('fs');

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
    let originalContent = content;

    // 1. Для браузерных HTML: Откатываем Собеля и инвертируем dark
    content = content.replace(
        /const cWeight = edgeWeightFactor \* \(1\.0 - edgeC\) \+ \(1\.0 - edgeWeightFactor\) \* dark;/g,
        'const cWeight = edgeWeightFactor * edgeC + (1.0 - edgeWeightFactor) * (1.0 - dark);'
    );
    // На случай, если какой-то файл остался в оригинальном виде:
    content = content.replace(
        /const cWeight = edgeWeightFactor \* edgeC \+ \(1\.0 - edgeWeightFactor\) \* dark;/g,
        'const cWeight = edgeWeightFactor * edgeC + (1.0 - edgeWeightFactor) * (1.0 - dark);'
    );

    // 2. Для Node.js скриптов (generate.js): Откатываем Собеля и инвертируем darknessComponent
    content = content.replace(
        /const combinedRawWeight = edgeWeightFactor \* \(1\.0 - edgeComponent\) \+ \(1\.0 - edgeWeightFactor\) \* darknessComponent;/g,
        'const combinedRawWeight = edgeWeightFactor * edgeComponent + (1.0 - edgeWeightFactor) * (1.0 - darknessComponent);'
    );
    content = content.replace(
        /const combinedRawWeight = edgeWeightFactor \* edgeComponent \+ \(1\.0 - edgeWeightFactor\) \* darknessComponent;/g,
        'const combinedRawWeight = edgeWeightFactor * edgeComponent + (1.0 - edgeWeightFactor) * (1.0 - darknessComponent);'
    );

    // 3. Для SVG скриптов: там нет параметра темноты, просто откатываем Собеля обратно
    content = content.replace(
        /weight: baseWeight \+ \(1\.0 - baseWeight\) \* \(1\.0 - edgeComponent\)/g,
        'weight: baseWeight + (1.0 - baseWeight) * edgeComponent'
    );

    if (content !== originalContent) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`✅ Пропатчен: ${file}`);
    } else {
        console.log(`⚠️ В файле ${file} изменения не требуются.`);
    }
});

console.log('Готово! Сглаживание по контрасту возвращено, а по темноте — инвертировано.');
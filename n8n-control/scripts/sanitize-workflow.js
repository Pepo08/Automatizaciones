const fs = require('fs');
const path = require('path');

function sanitizeFileName(name) {
    return String(name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\- ]+/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase();
}

function sortObjectDeep(value) {
    if (Array.isArray(value)) {
        return value.map(sortObjectDeep);
    }

    if (value && typeof value === 'object') {
        const sorted = {};
        for (const key of Object.keys(value).sort()) {
            sorted[key] = sortObjectDeep(value[key]);
        }
        return sorted;
    }

    return value;
}

function cleanWorkflow(raw) {
    return {
        id: raw.id ?? null,
        name: raw.name ?? null,
        active: raw.active ?? false,
        versionId: raw.versionId ?? null,
        settings: sortObjectDeep(raw.settings || {}),
        nodes: Array.isArray(raw.nodes) ? raw.nodes : [],
        connections: sortObjectDeep(raw.connections || {}),
    };
}

function main() {
    const inputPath = process.argv[2];

    if (!inputPath) {
        throw new Error('Uso: node scripts/sanitize-workflow.js <ruta-del-raw.json>');
    }

    const absoluteInput = path.resolve(process.cwd(), inputPath);

    if (!fs.existsSync(absoluteInput)) {
        throw new Error(`No existe el archivo: ${absoluteInput}`);
    }

    const raw = JSON.parse(fs.readFileSync(absoluteInput, 'utf8'));
    const clean = cleanWorkflow(raw);

    const safeName = sanitizeFileName(clean.name || path.basename(absoluteInput, '.raw.json'));
    const outDir = path.join(process.cwd(), 'workflows', 'clean');
    const outPath = path.join(outDir, `${safeName}.json`);

    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(outPath, JSON.stringify(clean, null, 2), 'utf8');

    console.log(`Sanitizado en: ${outPath}`);
}

try {
    main();
} catch (err) {
    console.error(err.message);
    process.exit(1);
}
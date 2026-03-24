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

function uniqueSorted(arr) {
    return [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function detectTriggerNodes(nodes) {
    return nodes
        .filter((node) => typeof node.type === 'string' && node.type.toLowerCase().includes('trigger'))
        .map((node) => ({
            name: node.name,
            type: node.type,
        }));
}

function detectExternalServices(nodes) {
    const services = [];

    for (const node of nodes) {
        const type = String(node.type || '').toLowerCase();
        const name = String(node.name || '');

        if (type.includes('telegram')) services.push('Telegram');
        if (type.includes('google')) services.push('Google');
        if (type.includes('gmail')) services.push('Gmail');
        if (type.includes('sheets')) services.push('Google Sheets');
        if (type.includes('openai')) services.push('OpenAI');
        if (type.includes('anthropic')) services.push('Anthropic');
        if (type.includes('httprequest')) services.push('HTTP Request');
        if (type.includes('webhook')) services.push('Webhook');
        if (type.includes('mysql')) services.push('MySQL');
        if (type.includes('postgres')) services.push('Postgres');
        if (type.includes('slack')) services.push('Slack');
        if (type.includes('mailchimp')) services.push('Mailchimp');

        if (name.toLowerCase().includes('telegram')) services.push('Telegram');
        if (name.toLowerCase().includes('mailchimp')) services.push('Mailchimp');
    }

    return uniqueSorted(services);
}

function buildConnectionSummary(connections) {
    const edges = [];

    for (const sourceNodeName of Object.keys(connections || {})) {
        const sourceNode = connections[sourceNodeName];

        for (const outputType of Object.keys(sourceNode || {})) {
            const outputGroups = sourceNode[outputType];

            if (!Array.isArray(outputGroups)) continue;

            outputGroups.forEach((group, groupIndex) => {
                if (!Array.isArray(group)) return;

                group.forEach((target) => {
                    edges.push({
                        from: sourceNodeName,
                        to: target.node,
                        type: outputType,
                        outputIndex: groupIndex,
                    });
                });
            });
        }
    }

    return edges;
}

function main() {
    const inputPath = process.argv[2];

    if (!inputPath) {
        throw new Error('Uso: node scripts/summarize-workflow.js <ruta-del-clean.json>');
    }

    const absoluteInput = path.resolve(process.cwd(), inputPath);

    if (!fs.existsSync(absoluteInput)) {
        throw new Error(`No existe el archivo: ${absoluteInput}`);
    }

    const workflow = JSON.parse(fs.readFileSync(absoluteInput, 'utf8'));
    const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
    const nodeTypes = uniqueSorted(nodes.map((node) => node.type));
    const nodeNames = nodes.map((node) => node.name).filter(Boolean);
    const triggerNodes = detectTriggerNodes(nodes);
    const externalServices = detectExternalServices(nodes);
    const connections = buildConnectionSummary(workflow.connections || {});

    const summary = {
        id: workflow.id ?? null,
        name: workflow.name ?? null,
        active: workflow.active ?? false,
        versionId: workflow.versionId ?? null,
        nodeCount: nodes.length,
        triggerCount: triggerNodes.length,
        triggerNodes,
        externalServices,
        nodeNames,
        nodeTypes,
        connections,
    };

    const safeName = sanitizeFileName(workflow.name || path.basename(absoluteInput, '.json'));
    const outDir = path.join(process.cwd(), 'workflows', 'summaries');
    const outPath = path.join(outDir, `${safeName}.summary.json`);

    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');

    console.log(`Resumen generado en: ${outPath}`);
}

try {
    main();
} catch (err) {
    console.error(err.message);
    process.exit(1);
}
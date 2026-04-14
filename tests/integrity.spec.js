// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// ============================================================
// DATA INTEGRITY TESTS
// Validates cross-references between JSON data files.
// These run as fast Node assertions — no browser needed.
// ============================================================

const DATA_DIR = path.join(__dirname, '..', 'data');

function loadJSON(filename) {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf-8'));
}

let instruments, changelog, wiring, preflight, governance, models;

test.beforeAll(() => {
    instruments = loadJSON('copilot-instruments.json');
    changelog = loadJSON('known-changelog-entries.json');
    wiring = loadJSON('wiring-diagram.json');
    preflight = loadJSON('preflight-checklist.json');
    governance = loadJSON('governance-controls.json');
    models = loadJSON('copilot-models.json');
});

const instrumentIds = () => new Set(instruments.instruments.map(i => i.id));
const controlIds = () => new Set(governance.controls.map(c => c.id));

test.describe('Data Integrity — cross-references', () => {

    test('all changelog instrument references point to valid instruments', () => {
        const ids = instrumentIds();
        const invalid = [];
        for (const entry of changelog.entries) {
            for (const ref of (entry.instruments || [])) {
                if (!ids.has(ref)) {
                    invalid.push({ entry: entry.id, ref });
                }
            }
        }
        expect(invalid, `Invalid changelog refs: ${JSON.stringify(invalid)}`).toHaveLength(0);
    });

    test('all wiring connection endpoints point to valid instruments or controls', () => {
        const ids = instrumentIds();
        const cids = controlIds();
        const allIds = new Set([...ids, ...cids]);
        const invalid = [];
        for (const conn of wiring.connections) {
            if (!allIds.has(conn.from)) invalid.push({ field: 'from', value: conn.from, label: conn.label });
            if (!allIds.has(conn.to)) invalid.push({ field: 'to', value: conn.to, label: conn.label });
        }
        expect(invalid, `Invalid wiring refs: ${JSON.stringify(invalid)}`).toHaveLength(0);
    });

    test('all relatedInstruments references point to valid instruments', () => {
        const ids = instrumentIds();
        const invalid = [];
        for (const inst of instruments.instruments) {
            for (const ref of (inst.relatedInstruments || [])) {
                if (!ids.has(ref)) {
                    invalid.push({ instrument: inst.id, ref });
                }
            }
        }
        expect(invalid, `Invalid related refs: ${JSON.stringify(invalid)}`).toHaveLength(0);
    });

    test('no duplicate instrument IDs', () => {
        const seen = new Set();
        const dupes = [];
        for (const inst of instruments.instruments) {
            if (seen.has(inst.id)) dupes.push(inst.id);
            seen.add(inst.id);
        }
        expect(dupes, `Duplicate IDs: ${dupes.join(', ')}`).toHaveLength(0);
    });

    test('every instrument has required fields', () => {
        const required = ['id', 'symbol', 'name', 'zone', 'status'];
        const invalid = [];
        for (const inst of instruments.instruments) {
            for (const field of required) {
                if (!inst[field]) invalid.push({ id: inst.id, missing: field });
            }
        }
        expect(invalid, `Missing fields: ${JSON.stringify(invalid)}`).toHaveLength(0);
    });

    test('every instrument zone references a valid zone', () => {
        const zoneIds = new Set(instruments.zones.map(z => z.id));
        const invalid = instruments.instruments
            .filter(i => !zoneIds.has(i.zone))
            .map(i => ({ id: i.id, zone: i.zone }));
        expect(invalid, `Invalid zones: ${JSON.stringify(invalid)}`).toHaveLength(0);
    });

    test('all changelog entry types are defined in entryTypes', () => {
        const validTypes = new Set(Object.keys(changelog.entryTypes));
        const invalid = changelog.entries
            .filter(e => !validTypes.has(e.type))
            .map(e => ({ id: e.id, type: e.type }));
        expect(invalid, `Invalid entry types: ${JSON.stringify(invalid)}`).toHaveLength(0);
    });

    test('all wiring connection types are defined in connectionTypes', () => {
        const validTypes = new Set(wiring.connectionTypes.map(t => t.id));
        const invalid = wiring.connections
            .filter(c => !validTypes.has(c.type))
            .map(c => ({ from: c.from, to: c.to, type: c.type }));
        expect(invalid, `Invalid connection types: ${JSON.stringify(invalid)}`).toHaveLength(0);
    });

    test('model JSON has no duplicate model IDs', () => {
        const seen = new Set();
        const dupes = [];
        for (const m of models.models) {
            if (seen.has(m.id)) dupes.push(m.id);
            seen.add(m.id);
        }
        expect(dupes, `Duplicate model IDs: ${dupes.join(', ')}`).toHaveLength(0);
    });
});

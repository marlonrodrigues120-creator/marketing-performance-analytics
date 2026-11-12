/**
 * Exporta a base demonstrativa gerada pelo frontend para o seed do backend,
 * garantindo que API e frontend mostrem exatamente os mesmos números.
 * Uso: npm run export:demo
 */
import { writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { CHANNELS, generateDemo } from '../src/data/seed'

const { campaigns, metrics } = generateDemo()
const payload = { generatedAt: new Date().toISOString(), channels: CHANNELS, campaigns, metrics }
writeFileSync('backend/seed/demo.json.gz', gzipSync(JSON.stringify(payload)))
console.log(`OK: ${campaigns.length} campanhas, ${metrics.length} linhas diárias → backend/seed/demo.json.gz`)

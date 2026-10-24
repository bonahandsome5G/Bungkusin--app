// Gabungkan hasil build (dist/) menjadi SATU file HTML yang bisa dibuka langsung
// dengan dobel-klik, tanpa server. Jalankan: npm run build:standalone
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'

const assets = readdirSync('dist/assets')
const js = readFileSync(`dist/assets/${assets.find((f) => f.endsWith('.js'))}`, 'utf8').replaceAll('</script', '<\\/script')
const css = readFileSync(`dist/assets/${assets.find((f) => f.endsWith('.css'))}`, 'utf8')
const fonts = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@500;700&family=Source+Serif+4:opsz,wght@8..60,700&display=swap'

const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#1D2A21">
<title>Bungkus! — Food Rescue</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${fonts}" rel="stylesheet">
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script type="module">${js}</script>
</body>
</html>
`
writeFileSync('bungkus-standalone.html', html)
console.log(`bungkus-standalone.html dibuat (${Math.round(html.length / 1024)} KB)`)

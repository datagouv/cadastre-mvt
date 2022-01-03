#!/usr/bin/env node
const {join} = require('path')
const {Transform} = require('stream')
const MultiStream = require('multistream')
const {ensureDir, createReadStream} = require('fs-extra')
const got = require('got')
const execa = require('execa')
const {stringify} = require('ndjson')
const {parse} = require('JSONStream')
const {createGunzip} = require('gunzip-stream')
const pumpify = require('pumpify')
const departements = require('@etalab/decoupage-administratif/data/departements.json')
const args = require('minimist')(process.argv.slice(2))

const codesDepartements = args._.length > 0 ?
  args._.map(el => {return String(el).startsWith('97') ? String(el) : String(el).padStart(2, '0')}) :
  departements.map(d => d.code)

const baseURL = args.baseurl || "https://cadastre.data.gouv.fr/data/etalab-cadastre/latest/geojson/departements"
function getCadastreLayerURL(layerName, codeDepartement) {
  return `${baseURL}/${codeDepartement}/cadastre-${codeDepartement}-${layerName}.json.gz`
}

function featuresToString(inputStream) {
  return pumpify(
    inputStream,
    new Transform({
      transform({type, geometry, properties}, enc, done) {
        done(null, {type, geometry, properties})
      },
      objectMode: true
    }),
    stringify()
  )
}

function getCadastreFeatureStream(layerName, codesDepartements) {
  const remainingDepartements = [...codesDepartements]

  async function streamFactory(cb) {
    if (remainingDepartements.length === 0) {
      return cb(null, null)
    }

    try {
      const codeDepartement = remainingDepartements.shift()
      let params = [
        createGunzip(),
        parse('features.*')
      ]
      if (getCadastreLayerURL(layerName, codeDepartement).startsWith('http')) {
        params = [got.stream(getCadastreLayerURL(layerName, codeDepartement)), ...params]
      } else {
        params = [createReadStream(getCadastreLayerURL(layerName, codeDepartement)), ...params]
      }
      const stream = pumpify.obj(...params)

      cb(null, stream)
    } catch (error) {
      cb(error)
    }
  }

  return MultiStream.obj(streamFactory)
}

const COMMON_OPTIONS = [
  '--no-tile-stats',
  '--detect-shared-borders',
  '--simplify-only-low-zooms',
  '--generate-ids',
  '--read-parallel',
  '--force'
]

async function buildParcellesTiles() {
  console.log('Génération des tuiles pour les parcelles')
  const stream = await getCadastreFeatureStream('parcelles', codesDepartements)

  const tippecanoeOptions = [
    ...COMMON_OPTIONS,
    '--layer',
    'parcelles',
    '--coalesce-densest-as-needed',
    '-Z13',
    '-z16',
    '--output',
    'dist/parcelles.mbtiles'
  ]
  await execa('tippecanoe', tippecanoeOptions, {input: featuresToString(stream), stdout: 'inherit', stderr: 'inherit'})
}

async function buildBatimentsTiles() {
  console.log('Génération des tuiles pour les bâtiments')
  const stream = await getCadastreFeatureStream('batiments', codesDepartements)

  const tippecanoeOptions = [
    ...COMMON_OPTIONS,
    '--layer',
    'batiments',
    '--drop-densest-as-needed',
    '-Z14',
    '-z16',
    '--output',
    'dist/batiments.mbtiles'
  ]
  await execa('tippecanoe', tippecanoeOptions, {input: featuresToString(stream), stdout: 'inherit', stderr: 'inherit'})
}

async function buildSectionsTiles() {
  console.log('Génération des tuiles pour les sections')
  const stream = await getCadastreFeatureStream('sections', codesDepartements)

  const tippecanoeOptions = [
    ...COMMON_OPTIONS,
    '--layer',
    'sections',
    '--coalesce-densest-as-needed',
    '-Z11',
    '-z16',
    '--output',
    'dist/sections.mbtiles'
  ]
  await execa('tippecanoe', tippecanoeOptions, {input: featuresToString(stream), stdout: 'inherit', stderr: 'inherit'})
}

async function mergeTiles() {
  await execa('tile-join', [
    '--attribution=Etalab',
    '--name=cadastre',
    '--no-tile-size-limit',
    '--no-tile-stats',
    '--force',
    '--output',
    'dist/cadastre.mbtiles',
    'dist/parcelles.mbtiles',
    'dist/sections.mbtiles',
    'dist/batiments.mbtiles'
  ], {stdout: 'inherit', stderr: 'inherit'})
}

async function main() {
  await ensureDir(join(__dirname, 'dist'))
  await buildParcellesTiles()
  await buildBatimentsTiles()
  await buildSectionsTiles()
  await mergeTiles()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})

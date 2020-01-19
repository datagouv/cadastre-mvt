#!/usr/bin/env node
const {join} = require('path')
const {Transform} = require('stream')
const MultiStream = require('multistream')
const {ensureDir} = require('fs-extra')
const got = require('got')
const Keyv = require('keyv')
const execa = require('execa')
const {stringify} = require('ndjson')
const {parse} = require('JSONStream')
const {createGunzip} = require('gunzip-stream')
const intoStream = require('into-stream')
const pumpify = require('pumpify')
const departements = require('@etalab/decoupage-administratif/data/departements.json')

const cache = new Keyv('sqlite://cadastre-cache.sqlite')
const codesDepartements = departements.map(d => d.code)

function getCadastreLayerURL(layerName, codeDepartement) {
  return `https://cadastre.data.gouv.fr/data/etalab-cadastre/latest/geojson/departements/${codeDepartement}/cadastre-${codeDepartement}-${layerName}.json.gz`
}

async function getCadastreLayerFile(layerName, codeDepartement) {
  const response = await got(getCadastreLayerURL(layerName, codeDepartement), {cache, responseType: 'buffer'})
  return response.body
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
      const file = await getCadastreLayerFile(layerName, codeDepartement)
      const stream = pumpify.obj(
        intoStream(file),
        createGunzip(),
        parse('features.*')
      )

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

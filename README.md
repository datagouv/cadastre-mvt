# @etalab/cadastre-mvt

Script permettant la génération de tuiles vectorielles représentant le [plan cadastral](https://cadastre.data.gouv.fr).

## Pré-requis

* [Node.js](https://nodejs.org) version 12 ou supérieure
* [tippecanoe](https://github.com/mapbox/tippecanoe) version 1.34 ou supérieure

## Utilisation

### Installation

```bash
yarn --prod
```

### Génération des tuiles

```bash
# France entière
yarn generate-mvt

# Liste de départements
yarn generate-mvt 971 972
```

## Licence

MIT

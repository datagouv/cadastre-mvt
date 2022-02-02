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

Par défaut, l'outil télécharge les fichiers à distance. Il est possible avec l'option `--baseurl` de travailler avec des fichiers en local. Ce cas de figure est utile avant tout pour Etalab dans ses traitements.

```bash
# France entière
yarn generate-mvt

# Liste de départements
yarn generate-mvt 971 972

# Avec une structure similaire de l'arborescence à https://cadastre.data.gouv.fr/data/etalab-cadastre/latest/geojson/departements/, vous pouvez aussi faire
yarn generate-mvt --baseurl /srv/cadastre/etalab-cadastre/etalab-cadastre/geojson/departements
# ou
yarn generate-mvt --baseurl /srv/cadastre/etalab-cadastre/etalab-cadastre/geojson/departements 44 35
```

## Aperçu des tuiles

Le plus simple est d'utiliser [mbview](https://github.com/mapbox/mbview).

```
mbview dist/cadastre.mbtiles
```

## Licence

MIT

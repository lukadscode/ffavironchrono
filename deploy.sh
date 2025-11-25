#!/bin/bash

# Script de déploiement pour timing.ffaviron.fr
# Usage: ./deploy.sh

set -e

echo "🚀 Début du déploiement..."

# Aller dans le répertoire de l'application
cd /var/www/timing.ffaviron.fr

# Récupérer les dernières modifications
echo "📥 Récupération du code depuis Git..."
git pull origin main

# Installer les nouvelles dépendances (si nécessaire)
echo "📦 Installation des dépendances..."
npm install

# Builder l'application
echo "🔨 Build de l'application..."
npm run build

# Mettre à jour les permissions
echo "🔐 Mise à jour des permissions..."
sudo chown -R www-data:www-data /var/www/timing.ffaviron.fr/dist
sudo chmod -R 755 /var/www/timing.ffaviron.fr/dist

# Recharger Apache
echo "🔄 Rechargement d'Apache..."
sudo systemctl reload apache2

echo "✅ Déploiement terminé avec succès !"
echo "🌐 Votre application est disponible sur https://timing.ffaviron.fr"


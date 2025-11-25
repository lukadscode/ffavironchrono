# Guide de déploiement complet - timing.ffaviron.fr

Guide étape par étape pour déployer l'application front-end sur un serveur VPS Debian 12 avec Apache, en utilisant Git pour le déploiement.

## 📋 Prérequis

- Serveur VPS Debian 12
- Accès SSH au serveur avec droits sudo
- Node.js et npm installés (version 18+ recommandée)
- Git installé sur le serveur
- Apache installé et configuré
- Domaines `timing.ffaviron.fr` et `www.timing.ffaviron.fr` pointant vers l'IP du serveur
- Repository Git contenant votre code (GitHub, GitLab, etc.)

## 🚀 Étapes de déploiement

### Étape 1 : Préparer le repository Git

#### 1.1 Créer un fichier `.env.example` (si pas déjà fait)

Créez un fichier `.env.example` à la racine du projet :

```bash
# .env.example
VITE_API_URL=http://localhost:3010
```

#### 1.2 S'assurer que `.env` est dans `.gitignore`

Vérifiez que votre `.gitignore` contient :

```
.env
.env.local
.env.production
node_modules/
dist/
```

#### 1.3 Pousser le code sur votre repository Git

```bash
git add .
git commit -m "Préparation pour déploiement"
git push origin main
```

### Étape 2 : Se connecter au serveur VPS

```bash
ssh utilisateur@votre-serveur-ip
# Remplacez 'utilisateur' par votre nom d'utilisateur et 'votre-serveur-ip' par l'IP de votre serveur
```

### Étape 3 : Installer les dépendances système

```bash
# Mettre à jour le système
sudo apt update
sudo apt upgrade -y

# Installer Node.js et npm (si pas déjà installé)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Vérifier les versions installées
node --version
npm --version

# Installer Git (si pas déjà installé)
sudo apt install -y git

# Installer Apache et Certbot
sudo apt install -y apache2 certbot python3-certbot-apache

# Installer les modules Apache nécessaires
sudo a2enmod rewrite
sudo a2enmod ssl
sudo a2enmod headers
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
```

### Étape 4 : Cloner le repository sur le serveur

```bash
# Créer un répertoire pour l'application
sudo mkdir -p /var/www
cd /var/www

# Cloner votre repository (remplacez par l'URL de votre repo)
sudo git clone https://github.com/votre-username/votre-repo.git timing.ffaviron.fr
# OU si vous utilisez SSH :
# sudo git clone git@github.com:votre-username/votre-repo.git timing.ffaviron.fr

# Donner les permissions appropriées
sudo chown -R $USER:$USER /var/www/timing.ffaviron.fr
cd /var/www/timing.ffaviron.fr
```

### Étape 5 : Configurer les variables d'environnement

```bash
# Créer le fichier .env pour la production
nano .env
```

Ajoutez le contenu suivant (ajustez selon votre configuration) :

```bash
# URL de l'API backend
# Si votre API est sur un autre domaine :
VITE_API_URL=https://api.ffaviron.fr

# OU si votre API est sur le même serveur (via reverse proxy) :
# VITE_API_URL=https://timing.ffaviron.fr
```

Sauvegardez avec `Ctrl+O`, puis `Enter`, puis `Ctrl+X`.

### Étape 6 : Installer les dépendances et builder l'application

```bash
# Installer les dépendances npm
npm install

# Builder l'application pour la production
npm run build
```

Le dossier `dist/` sera créé avec les fichiers statiques à servir.

### Étape 7 : Configurer Apache - Virtual Host HTTP

```bash
# Créer le fichier de configuration Apache
sudo nano /etc/apache2/sites-available/timing.ffaviron.fr.conf
```

Ajoutez la configuration suivante :

```apache
<VirtualHost *:80>
    ServerName timing.ffaviron.fr
    ServerAlias www.timing.ffaviron.fr
    
    DocumentRoot /var/www/timing.ffaviron.fr/dist
    
    <Directory /var/www/timing.ffaviron.fr/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Configuration pour React Router (SPA)
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
    
    # Logs
    ErrorLog ${APACHE_LOG_DIR}/timing.ffaviron.fr_error.log
    CustomLog ${APACHE_LOG_DIR}/timing.ffaviron.fr_access.log combined
</VirtualHost>
```

Sauvegardez et quittez (`Ctrl+O`, `Enter`, `Ctrl+X`).

### Étape 8 : Activer le site Apache

```bash
# Activer le site
sudo a2ensite timing.ffaviron.fr.conf

# Désactiver le site par défaut (optionnel)
sudo a2dissite 000-default.conf

# Tester la configuration Apache
sudo apache2ctl configtest

# Recharger Apache
sudo systemctl reload apache2
```

### Étape 9 : Configurer le certificat SSL avec Let's Encrypt

```bash
# Obtenir le certificat SSL
sudo certbot --apache -d timing.ffaviron.fr -d www.timing.ffaviron.fr
```

Suivez les instructions interactives :
- Entrez votre email
- Acceptez les conditions
- Choisissez si vous voulez rediriger HTTP vers HTTPS (recommandé : option 2)

Certbot va automatiquement :
- Générer le certificat SSL
- Configurer Apache pour HTTPS
- Configurer le renouvellement automatique

### Étape 10 : Vérifier la configuration HTTPS

```bash
# Vérifier que le fichier SSL a été créé
sudo nano /etc/apache2/sites-available/timing.ffaviron.fr-le-ssl.conf
```

La configuration devrait ressembler à ceci (Certbot l'a générée automatiquement) :

```apache
<VirtualHost *:443>
    ServerName timing.ffaviron.fr
    ServerAlias www.timing.ffaviron.fr
    
    DocumentRoot /var/www/timing.ffaviron.fr/dist
    
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/timing.ffaviron.fr/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/timing.ffaviron.fr/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf
    
    <Directory /var/www/timing.ffaviron.fr/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Configuration pour React Router (SPA)
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
    
    # Headers de sécurité
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-XSS-Protection "1; mode=block"
    
    # Logs
    ErrorLog ${APACHE_LOG_DIR}/timing.ffaviron.fr_error.log
    CustomLog ${APACHE_LOG_DIR}/timing.ffaviron.fr_access.log combined
</VirtualHost>
```

### Étape 11 : Configurer le reverse proxy pour l'API (si nécessaire)

Si votre API backend tourne sur le même serveur (par exemple sur le port 3010 avec PM2), ajoutez cette configuration dans le VirtualHost HTTPS :

```bash
sudo nano /etc/apache2/sites-available/timing.ffaviron.fr-le-ssl.conf
```

Ajoutez ces lignes dans la section `<VirtualHost *:443>`, avant la balise de fermeture :

```apache
    # Reverse proxy pour l'API
    ProxyPreserveHost On
    ProxyPass /api http://localhost:3010/api
    ProxyPassReverse /api http://localhost:3010/api
    
    # Pour WebSocket (si utilisé)
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/socket.io/(.*)$ ws://localhost:3010/socket.io/$1 [P,L]
```

**Important** : Si vous utilisez cette option, modifiez votre `.env` pour utiliser :
```bash
VITE_API_URL=https://timing.ffaviron.fr
```

Puis rebuilder l'application :
```bash
cd /var/www/timing.ffaviron.fr
npm run build
```

### Étape 12 : Configurer les permissions

```bash
# Donner les bonnes permissions au répertoire
sudo chown -R www-data:www-data /var/www/timing.ffaviron.fr/dist
sudo chmod -R 755 /var/www/timing.ffaviron.fr

# S'assurer que le répertoire dist est accessible
sudo chmod -R 755 /var/www/timing.ffaviron.fr/dist
```

### Étape 13 : Tester la configuration

```bash
# Tester la configuration Apache
sudo apache2ctl configtest

# Vérifier le statut d'Apache
sudo systemctl status apache2

# Tester avec curl
curl -I http://timing.ffaviron.fr
curl -I https://timing.ffaviron.fr

# Vérifier les logs en cas de problème
sudo tail -f /var/log/apache2/timing.ffaviron.fr_error.log
```

### Étape 14 : Vérifier le renouvellement automatique du certificat SSL

```bash
# Tester le renouvellement automatique
sudo certbot renew --dry-run

# Vérifier que le service de renouvellement est actif
sudo systemctl status certbot.timer
```

Le certificat sera renouvelé automatiquement avant expiration.

## 🔄 Mises à jour futures

### Script de déploiement automatisé

Créez un script pour faciliter les mises à jour :

```bash
nano /var/www/timing.ffaviron.fr/deploy.sh
```

Ajoutez ce contenu :

```bash
#!/bin/bash

# Script de déploiement
set -e

echo "🚀 Début du déploiement..."

# Aller dans le répertoire de l'application
cd /var/www/timing.ffaviron.fr

# Récupérer les dernières modifications
echo "📥 Récupération du code..."
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
```

Rendez le script exécutable :

```bash
chmod +x /var/www/timing.ffaviron.fr/deploy.sh
```

### Utilisation du script de déploiement

Pour mettre à jour l'application :

```bash
cd /var/www/timing.ffaviron.fr
./deploy.sh
```

## 🔧 Configuration avancée

### Configuration du firewall (UFW)

Si vous utilisez UFW, ouvrez les ports nécessaires :

```bash
# Autoriser HTTP
sudo ufw allow 80/tcp

# Autoriser HTTPS
sudo ufw allow 443/tcp

# Vérifier le statut
sudo ufw status
```

### Optimisation Apache

Pour améliorer les performances, vous pouvez ajouter ces configurations dans votre VirtualHost HTTPS :

```apache
    # Compression Gzip
    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
    </IfModule>
    
    # Cache des fichiers statiques
    <IfModule mod_expires.c>
        ExpiresActive On
        ExpiresByType image/jpg "access plus 1 year"
        ExpiresByType image/jpeg "access plus 1 year"
        ExpiresByType image/png "access plus 1 year"
        ExpiresByType image/gif "access plus 1 year"
        ExpiresByType text/css "access plus 1 month"
        ExpiresByType application/javascript "access plus 1 month"
    </IfModule>
```

### Variables d'environnement selon l'environnement

Vous pouvez créer différents fichiers `.env` :

- `.env.production` pour la production
- `.env.staging` pour le staging

Et utiliser un script de build conditionnel dans `package.json` :

```json
"scripts": {
  "build": "tsc -b && vite build",
  "build:prod": "cp .env.production .env && npm run build",
  "build:staging": "cp .env.staging .env && npm run build"
}
```

## 🐛 Dépannage

### Vérifier les logs Apache

```bash
# Logs d'erreur
sudo tail -f /var/log/apache2/timing.ffaviron.fr_error.log

# Logs d'accès
sudo tail -f /var/log/apache2/timing.ffaviron.fr_access.log
```

### Vérifier les permissions

```bash
# Vérifier les propriétaires
ls -la /var/www/timing.ffaviron.fr/

# Corriger les permissions si nécessaire
sudo chown -R www-data:www-data /var/www/timing.ffaviron.fr
sudo chmod -R 755 /var/www/timing.ffaviron.fr
```

### Vérifier la configuration Apache

```bash
# Tester la syntaxe
sudo apache2ctl configtest

# Voir la configuration active
sudo apache2ctl -S
```

### Problèmes de certificat SSL

```bash
# Vérifier le statut du certificat
sudo certbot certificates

# Renouveler manuellement si nécessaire
sudo certbot renew

# Vérifier les logs de certbot
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

### Problèmes de build

```bash
# Nettoyer et rebuilder
cd /var/www/timing.ffaviron.fr
rm -rf node_modules dist
npm install
npm run build
```

### Vérifier que le site répond

```bash
# Depuis le serveur
curl -I https://timing.ffaviron.fr

# Depuis votre machine locale
curl -I https://timing.ffaviron.fr
```

## 📝 Checklist de déploiement

- [ ] Repository Git configuré et code poussé
- [ ] Serveur VPS accessible via SSH
- [ ] Node.js et npm installés
- [ ] Git installé sur le serveur
- [ ] Apache installé et modules activés
- [ ] Repository cloné sur le serveur
- [ ] Fichier `.env` créé avec la bonne URL API
- [ ] `npm install` exécuté
- [ ] `npm run build` exécuté avec succès
- [ ] Virtual Host Apache configuré
- [ ] Site Apache activé
- [ ] Certificat SSL obtenu avec Certbot
- [ ] Configuration HTTPS vérifiée
- [ ] Reverse proxy configuré (si nécessaire)
- [ ] Permissions correctes sur les fichiers
- [ ] Firewall configuré (ports 80 et 443 ouverts)
- [ ] Site accessible via HTTPS
- [ ] Redirection HTTP → HTTPS fonctionnelle
- [ ] Renouvellement automatique SSL testé

## 🔐 Sécurité

### Recommandations

1. **Ne jamais commiter le fichier `.env`** - Il contient des informations sensibles
2. **Utiliser des clés SSH** pour Git au lieu de mots de passe
3. **Maintenir le système à jour** : `sudo apt update && sudo apt upgrade`
4. **Configurer un firewall** pour limiter l'accès
5. **Surveiller les logs** régulièrement pour détecter des activités suspectes
6. **Utiliser des mots de passe forts** pour les comptes système

## 📞 Support

En cas de problème, vérifiez :
1. Les logs Apache (`/var/log/apache2/`)
2. Les logs de Certbot (`/var/log/letsencrypt/`)
3. Le statut des services (`sudo systemctl status apache2`)
4. La configuration Apache (`sudo apache2ctl configtest`)

---

**Note importante** : Ce guide suppose que vous avez déjà un backend API déployé. Si ce n'est pas le cas, vous devrez également déployer votre backend avant de configurer le front-end.

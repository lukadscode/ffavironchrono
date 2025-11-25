# Guide de déploiement - timing.ffaviron.fr

Ce guide vous explique comment déployer l'application front-end sur votre serveur VPS Debian 12 avec Apache.

## Prérequis

- Serveur VPS Debian 12
- Apache installé et configuré
- PM2 installé
- Node.js et npm installés
- Accès SSH au serveur
- Domaines `timing.ffaviron.fr` et `www.timing.ffaviron.fr` pointant vers l'IP du serveur

## Étapes de déploiement

### 1. Configurer les variables d'environnement

Créez un fichier `.env` à la racine du projet avec l'URL de votre API backend :

```bash
# .env
VITE_API_URL=https://api.ffaviron.fr
# ou si votre API est sur le même serveur :
# VITE_API_URL=https://timing.ffaviron.fr/api
```

**Important** : Remplacez `https://api.ffaviron.fr` par l'URL réelle de votre backend API.

### 2. Préparer l'application en local

Sur votre machine locale, construisez l'application pour la production :

```bash
npm install
npm run build
```

Cela créera un dossier `dist/` contenant les fichiers statiques à déployer. Les variables d'environnement seront intégrées dans le build.

### 3. Transférer les fichiers sur le serveur

Utilisez `scp` ou `rsync` pour transférer le dossier `dist/` sur votre serveur :

```bash
# Depuis votre machine locale
scp -r dist/ utilisateur@votre-serveur-ip:/var/www/timing.ffaviron.fr/
```

Ou avec rsync (plus efficace) :

```bash
rsync -avz --delete dist/ utilisateur@votre-serveur-ip:/var/www/timing.ffaviron.fr/
```

### 4. Se connecter au serveur VPS

```bash
ssh utilisateur@votre-serveur-ip
```

### 5. Installer les dépendances système (si nécessaire)

```bash
sudo apt update
sudo apt install -y apache2 certbot python3-certbot-apache
```

### 6. Créer le répertoire de déploiement

```bash
sudo mkdir -p /var/www/timing.ffaviron.fr
sudo chown -R $USER:$USER /var/www/timing.ffaviron.fr
```

### 7. Configurer Apache - Virtual Host

Créez le fichier de configuration Apache :

```bash
sudo nano /etc/apache2/sites-available/timing.ffaviron.fr.conf
```

Ajoutez la configuration suivante :

```apache
<VirtualHost *:80>
    ServerName timing.ffaviron.fr
    ServerAlias www.timing.ffaviron.fr
    
    DocumentRoot /var/www/timing.ffaviron.fr
    
    <Directory /var/www/timing.ffaviron.fr>
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

### 8. Activer les modules Apache nécessaires

```bash
sudo a2enmod rewrite
sudo a2enmod ssl
sudo a2enmod headers
sudo systemctl restart apache2
```

### 9. Activer le site

```bash
sudo a2ensite timing.ffaviron.fr.conf
sudo systemctl reload apache2
```

### 10. Configurer SSL avec Let's Encrypt

```bash
sudo certbot --apache -d timing.ffaviron.fr -d www.timing.ffaviron.fr
```

Suivez les instructions pour configurer le certificat SSL. Certbot modifiera automatiquement votre configuration Apache pour utiliser HTTPS.

### 11. Vérifier la configuration Apache

Après l'installation de SSL, vérifiez que la configuration HTTPS est correcte :

```bash
sudo nano /etc/apache2/sites-available/timing.ffaviron.fr-le-ssl.conf
```

Assurez-vous que la configuration inclut bien les deux domaines et la redirection www :

```apache
<VirtualHost *:443>
    ServerName timing.ffaviron.fr
    ServerAlias www.timing.ffaviron.fr
    
    DocumentRoot /var/www/timing.ffaviron.fr
    
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/timing.ffaviron.fr/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/timing.ffaviron.fr/privkey.pem
    
    <Directory /var/www/timing.ffaviron.fr>
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

### 12. Rediriger HTTP vers HTTPS

Créez ou modifiez le fichier de configuration HTTP pour rediriger vers HTTPS :

```bash
sudo nano /etc/apache2/sites-available/timing.ffaviron.fr.conf
```

Remplacez par :

```apache
<VirtualHost *:80>
    ServerName timing.ffaviron.fr
    ServerAlias www.timing.ffaviron.fr
    
    # Redirection vers HTTPS
    Redirect permanent / https://timing.ffaviron.fr/
</VirtualHost>
```

### 13. Recharger Apache

```bash
sudo systemctl reload apache2
```

### 14. Vérifier les permissions

```bash
sudo chown -R www-data:www-data /var/www/timing.ffaviron.fr
sudo chmod -R 755 /var/www/timing.ffaviron.fr
```

### 15. Tester la configuration

```bash
# Tester la configuration Apache
sudo apache2ctl configtest

# Vérifier que le site répond
curl -I http://timing.ffaviron.fr
curl -I https://timing.ffaviron.fr
```

## Configuration de l'API backend

Votre application front-end communique avec une API backend. Vous avez deux options :

### Option 1 : API sur un sous-domaine différent (recommandé)

Si votre API est sur un autre domaine (ex: `api.ffaviron.fr`), configurez simplement la variable d'environnement `VITE_API_URL` lors du build (voir étape 1).

### Option 2 : API sur le même domaine avec reverse proxy

Si votre API backend tourne sur le même serveur (par exemple sur le port 3010 avec PM2), vous pouvez configurer un reverse proxy dans Apache. Ajoutez cette configuration dans votre VirtualHost HTTPS :

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

N'oubliez pas d'activer les modules proxy :

```bash
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
sudo a2enmod rewrite
sudo systemctl reload apache2
```

**Important** : Si vous utilisez cette option, configurez `VITE_API_URL=https://timing.ffaviron.fr` dans votre fichier `.env` avant de builder l'application.

## Mises à jour futures

Pour mettre à jour l'application :

1. Sur votre machine locale : `npm run build`
2. Transférer les nouveaux fichiers : `rsync -avz --delete dist/ utilisateur@serveur:/var/www/timing.ffaviron.fr/`
3. Vérifier les permissions : `sudo chown -R www-data:www-data /var/www/timing.ffaviron.fr`

## Dépannage

### Vérifier les logs Apache

```bash
sudo tail -f /var/log/apache2/timing.ffaviron.fr_error.log
sudo tail -f /var/log/apache2/timing.ffaviron.fr_access.log
```

### Vérifier le statut d'Apache

```bash
sudo systemctl status apache2
```

### Tester la configuration

```bash
sudo apache2ctl configtest
```

## Notes importantes

- Les fichiers statiques sont servis directement par Apache (pas besoin de PM2 pour le front-end)
- PM2 peut être utilisé pour votre backend API si vous en avez un
- Le certificat SSL sera renouvelé automatiquement par certbot
- Assurez-vous que les ports 80 et 443 sont ouverts dans votre firewall


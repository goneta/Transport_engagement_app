# Engagement de transport – application complète
Node.js + Express + SQLite. Pas de build.
1. `cp .env.example .env` puis modifiez JWT_SECRET, ADMIN_PASSWORD, BASE_URL
2. `npm install`
3. `export $(grep -v '^#' .env | xargs) && node server.js`  (ou pm2 / systemd)
4. Mettez Nginx/Caddy devant (HTTPS obligatoire, requis aussi pour le micro).
Premier compte : admin / ADMIN_PASSWORD (à changer). L'admin crée ensuite les comptes donneur d'ordre et transporteur.
Sauvegarde : copiez le fichier data.db.

## Compte administrateur par défaut
Identifiant : valeur de ADMIN_USER dans .env (défaut : admin). Mot de passe : valeur de ADMIN_PASSWORD (défaut si absent : ChangeMe!123).
Le compte n'est créé qu'au premier démarrage. Changez le mot de passe dès la première connexion.
## Rôles et droits
Rôles : admin, donneur d'ordre, transporteur, chauffeur. L'admin coche, pour chaque utilisateur, les droits : créer, modifier, partager à un utilisateur, partager par email/WhatsApp/Telegram, signer, télécharger/imprimer (onglet Utilisateurs > Droits).

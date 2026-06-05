# Déploiement — COSYL Video Engine

Déploiement **tout-en-un via Docker**. Une image partagée fait tourner deux
services : l'**API** (Express + worker de rendu in-process + ffmpeg) et le
**Web** (Next.js). Tout le contenu lourd reste sur un **volume local persistant** ;
Supabase ne stocke que les métadonnées et les templates.

## Architecture

```
                 navigateur
                /          \
         (3000) web        (4000) api ── ffmpeg
                              │
                    volume cosyl-data
              apps/api/data/ (médias générés,
              renders, uploads de référence)
                              │
                     Supabase (DB only)
        projects · templates · render_jobs ·
        project_assets · thumbnail_reference_library
```

- L'API **ne peut pas** tourner en serverless : elle écrit sur disque, appelle le
  binaire `ffmpeg`, et exécute des rendus longs in-process.
- Le navigateur appelle l'API **directement** via `NEXT_PUBLIC_API_URL` (valeur
  compilée dans le bundle web au build).

## Prérequis

- Docker + Docker Compose v2
- Un projet Supabase avec le schéma appliqué (voir ci-dessous)
- Une clé **AIML API** (https://aimlapi.com)

## 1. Base de données Supabase

Exécuter `infra/supabase/schema.sql` dans **Supabase → SQL Editor**. Tables
requises (idempotent, `create table if not exists`) :

- `projects`, `project_assets`, `templates`, `render_jobs`,
  `thumbnail_reference_library`

> Les buckets Storage (`project-assets`, `render-outputs`, `voice-samples`)
> déclarés dans `schema.sql` ne sont **plus utilisés** (le contenu est local).
> Tu peux les ignorer ou les supprimer.

## 2. Variables d'environnement

Copier le modèle puis remplir :

```bash
cp .env.example .env
```

| Variable | Rôle | Côté |
|---|---|---|
| `AIML_API_KEY` | Clé unique LLM/images/vidéo/voix/musique | API (runtime) |
| `SUPABASE_URL` | URL du projet Supabase | API (runtime) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service (DB) — **secret** | API (runtime) |
| `NEXT_PUBLIC_API_URL` | URL publique de l'API vue par le navigateur | Web (**build**) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase publique | Web (**build**) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anonyme publique | Web (**build**) |
| `REDIS_URL` | Optionnel — non requis (worker in-process) | API (runtime) |
| `PORT` | Port API (défaut 4000, fixé par compose) | API (runtime) |
| `APP_DOMAIN` | Sous-domaine du web (mode HTTPS uniquement) | Caddy (runtime) |
| `API_DOMAIN` | Sous-domaine de l'API (mode HTTPS uniquement) | Caddy (runtime) |

> ⚠️ Les `NEXT_PUBLIC_*` sont **compilés au build** de l'image. Si tu changes
> l'URL publique de l'API, il faut **rebuilder** (`docker compose build`).
> En prod, mets `NEXT_PUBLIC_API_URL` au domaine réel de l'API (ex.
> `https://api.mondomaine.com`), pas `localhost`.

## 3. Démarrage

```bash
docker compose up --build -d
```

- Web : http://localhost:3000
- API : http://localhost:4000/health → `{ "status": "ok" }`

Voir les logs : `docker compose logs -f api`
Arrêter : `docker compose down` (le volume `cosyl-data` est conservé).

## 4. Stockage persistant

Tout le contenu vit dans le volume `cosyl-data` monté sur
`/app/apps/api/data` :

- `generated-media/` — images & audio générés
- `render-outputs/` — vidéos / shorts / slideshows rendus
- `uploads/` — fichiers de référence, narration, musique uploadés

**Sauvegarde** = sauvegarder ce volume + la base Supabase. Ne jamais le supprimer
lors d'un redéploiement (`docker compose down` le préserve ; `down -v` l'efface).

## 5. HTTPS / domaine (VPS public)

Pour une mise en ligne réelle (ex. **VPS Hetzner**), ne pas exposer les ports
3000/4000 en clair. Le fichier `docker-compose.tls.yml` ajoute un **reverse-proxy
Caddy** qui obtient et renouvelle automatiquement les certificats **Let's Encrypt**.

**Prérequis DNS** : deux sous-domaines en enregistrement `A` vers l'IP du serveur :

```
app.exemple.com  → <IP du VPS>     (web)
api.exemple.com  → <IP du VPS>     (api)
```

**`.env`** :

```bash
APP_DOMAIN=app.exemple.com
API_DOMAIN=api.exemple.com
NEXT_PUBLIC_API_URL=https://api.exemple.com   # ← HTTPS + domaine API (compilé au build)
```

**Démarrage en HTTPS** :

```bash
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build
```

- Caddy écoute sur 80/443, route `APP_DOMAIN → web:3000` et `API_DOMAIN → api:4000`.
- Les services `web`/`api` ne publient plus de port public (joignables uniquement
  par Caddy sur le réseau interne Docker).
- Certificats TLS automatiques au premier démarrage (les ports 80 et 443 doivent
  être ouverts dans le firewall du VPS).

> Déploiement type sur un VPS Linux nu :
> ```bash
> # 1. installer Docker + plugin compose
> curl -fsSL https://get.docker.com | sh
> # 2. récupérer le code + configurer
> git clone <repo> cosyl && cd cosyl
> cp .env.example .env && nano .env        # remplir AIML/Supabase/domaines
> # 3. lancer en HTTPS
> docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build
> ```

## Checklist de mise en ligne

- [ ] `infra/supabase/schema.sql` exécuté (5 tables présentes)
- [ ] `.env` rempli (jamais commité — il est dans `.gitignore` + `.dockerignore`)
- [ ] `NEXT_PUBLIC_API_URL` = domaine public réel de l'API (sinon le navigateur
      ne joindra pas l'API)
- [ ] `AIML_API_KEY` valide (sinon toute génération renvoie une erreur claire)
- [ ] Volume `cosyl-data` sur un disque persistant et sauvegardé
- [ ] `docker compose up --build -d` → `/health` OK + web accessible
- [ ] (Sécurité) restreindre le CORS de l'API si l'API est exposée publiquement
      (actuellement `Access-Control-Allow-Origin: *`)
- [ ] (Sécurité) ne pas exposer le port API publiquement sans contrôle d'accès —
      il n'y a pas d'authentification (outil personnel)
- [ ] (HTTPS) DNS `APP_DOMAIN`/`API_DOMAIN` → IP du VPS, ports 80/443 ouverts,
      lancé avec `-f docker-compose.tls.yml` (Caddy gère les certificats)

## Notes de sécurité

- L'API n'a **pas d'authentification** : c'est un outil personnel. Si tu
  l'exposes sur Internet, place-la derrière un reverse-proxy avec auth (basic
  auth / VPN / liste d'IP) et restreins le CORS.
- `SUPABASE_SERVICE_ROLE_KEY` contourne la RLS : ne l'expose jamais côté client
  ni dans le bundle web (elle reste côté API uniquement).

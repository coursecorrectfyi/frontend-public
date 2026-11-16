# Deploying to Google Cloud

This guide builds the frontend image with Cloud Build and deploys it to Cloud Run. It assumes the [backend](https://github.com/coursecorrectfyi/backend-public) is already deployed and that you have a Firebase web app.

## 0. Variables

Every command below uses these shell variables. Set them once per terminal session:

```sh
export PROJECT_ID=my-project
export REGION=us-central1
export AR_REPO=coursecorrect          # Artifact Registry repository
export SERVICE=cc-frontend            # Cloud Run service name
export SITE_URL=https://example.com   # public URL of the site
export API_URL=https://my-backend-xxxxx-uc.a.run.app
export GTM_ID=GTM-XXXXXXX
```

## 1. One-time setup

```sh
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com --project=$PROJECT_ID

gcloud artifacts repositories create $AR_REPO \
  --repository-format=docker --location=$REGION --project=$PROJECT_ID

# NextAuth session secret
openssl rand -base64 32 | tr -d '\n' | \
  gcloud secrets create nextauth-secret --data-file=- --project=$PROJECT_ID

# Let the Cloud Run runtime service account (default: Compute Engine SA) read it
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding nextauth-secret --project=$PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor

# Relay secret shared with the backend (see "Relay secret" below). Generate it once, keep the value for the backend.
openssl rand -base64 32 | tr -d '\n' > /tmp/api-relay-secret
gcloud secrets create api-relay-secret --data-file=/tmp/api-relay-secret --project=$PROJECT_ID
gcloud secrets add-iam-policy-binding api-relay-secret --project=$PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor
# Give the same value to the backend's TRUSTED_RELAY_SECRETS (backend deployment guide), then delete the file.
rm /tmp/api-relay-secret
```

### Relay secret (`API_RELAY_SECRET`)

The backend limits requests per visitor IP. When this frontend's server calls the backend for a visitor (page
metadata for `/learn` and `/subjects`, the subjects sitemap, NextAuth token refresh and logout), it says which
visitor with two headers: `X-Relay-Secret` (this secret) and `X-Visitor-IP` (the last `X-Forwarded-For` entry,
which Cloud Run's front end appends). Without a matching secret, the calls still work but count against the
frontend server's own IP, so **all visitors share one set of limits** (e.g. 120 requests a minute for every
token refresh on the site).

- **Both sides hold the same value**: `api-relay-secret` in this project's Secret Manager, attached to the
  service as the runtime variable `API_RELAY_SECRET` (`cloudbuild.yaml`, substitution `_API_RELAY_SECRET_NAME`),
  and the backend's `TRUSTED_RELAY_SECRETS`. The backend's deployment guide covers its side; both are listed
  here on purpose, so neither gets missed.
- **Order doesn't matter for availability.** A secret the backend doesn't know yet is reported to its operators
  and ignored (the call counts as the server's own), so deploying either side first is safe.
- **Server-only.** Never a build substitution, a Docker build arg or a `NEXT_PUBLIC_*` variable: anyone holding
  it can claim any visitor IP and get around every per-visitor limit. `npm run verify` builds with a random
  value and fails if it appears anywhere in the build output.
- **Rotation without downtime** (the backend accepts two secrets at once): add the new value to the backend's
  `TRUSTED_RELAY_SECRETS` next to the old one, add a new version of `api-relay-secret`
  (`gcloud secrets versions add api-relay-secret --data-file=...`), redeploy the frontend (it reads `:latest` at
  start-up), then remove the old value from the backend.
- **Extra load balancer:** the visitor address is the *last* `X-Forwarded-For` entry, which is right when
  Cloud Run's front end is the only proxy (custom domains via domain mappings, as below). If you put an external
  HTTPS load balancer in front of the service, revisit `visitorIpFrom` in `src/lib/server/relay.ts` first.
- **Upgrading an existing deployment:** `cloudbuild.yaml` now attaches `api-relay-secret`, so the next deploy
  fails with `Secret ... not found` until you create it (step above). That's deliberate: failing loudly beats
  silently sharing limits.

The Cloud Build service account also needs `roles/run.admin` and `roles/iam.serviceAccountUser` to deploy.

In the Firebase console, add your domain (and the Cloud Run URL, if you use it) under **Authentication → Settings → Authorized domains**. Add the frontend origin to the backend's `ALLOWED_ORIGINS`.

## 2. Build and deploy

`NEXT_PUBLIC_*` values are compiled into the client bundle, so they are passed as substitutions at build time. Copy the Firebase values from **Project settings → Your apps**.

```sh
gcloud builds submit --config=cloudbuild.yaml --project=$PROJECT_ID \
  --substitutions=_TAG=$(git rev-parse --short HEAD),_REGION=$REGION,_AR_REPO=$AR_REPO,_SERVICE_NAME=$SERVICE,\
_NEXTAUTH_URL=$SITE_URL,_NEXT_PUBLIC_API_URL=$API_URL,_NEXT_PUBLIC_GTM_ID=$GTM_ID,\
_NEXT_PUBLIC_FIREBASE_API_KEY=...,_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$PROJECT_ID.firebaseapp.com,\
_NEXT_PUBLIC_FIREBASE_PROJECT_ID=$PROJECT_ID,_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$PROJECT_ID.firebasestorage.app,\
_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...,_NEXT_PUBLIC_FIREBASE_APP_ID=...,\
_NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```

`_API_RELAY_SECRET_NAME` defaults to `api-relay-secret`; set it if your secret has another name.

Optional: `_NEXT_PUBLIC_HOSTINGER_IP=<host>` proxies `/blog` to a WordPress site; `_NEXT_PUBLIC_EARLY_ACCESS_FORM_URL`, `_NEXT_PUBLIC_EARLY_ACCESS_INTENT_ENTRY_ID` and `_NEXT_PUBLIC_EARLY_ACCESS_EMAIL_ENTRY_ID` enable early-access signups via a Google Form.

The build pushes `$REGION-docker.pkg.dev/$PROJECT_ID/$AR_REPO/cc-frontend:<commit>` and deploys it as a public Cloud Run service: 1 vCPU, 1 GiB, concurrency 80, 0–3 instances (`_MAX_INSTANCES`), 30 s request timeout, startup CPU boost. These are the production settings; edit `cloudbuild.yaml` to change them.

## 3. Custom domain

```sh
gcloud beta run domain-mappings create --service=$SERVICE --domain=${SITE_URL#https://} \
  --region=$REGION --project=$PROJECT_ID
```

Create the DNS records it prints. `src/middleware.ts` redirects `www.` hosts to the bare domain, so map both if you want `www` to work.

## 4. Verify and troubleshoot

```sh
URL=$(gcloud run services describe $SERVICE --region=$REGION --project=$PROJECT_ID --format="value(status.url)")
curl -sI $URL | head -1

gcloud run services logs read $SERVICE --region=$REGION --project=$PROJECT_ID --limit=50
```

- **Build fails with `Missing required environment variable`**: `next.config.ts` requires `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_GTM_ID` at build time.
- **`Secret ... not found` on deploy**: create the secret (step 1) or set `_NEXTAUTH_SECRET_NAME` /
  `_API_RELAY_SECRET_NAME` to your secret's name.
- **Visitors hit rate limits too soon / the backend reports "wrong relay secret"**: the frontend's
  `api-relay-secret` and the backend's `TRUSTED_RELAY_SECRETS` differ, or the secret isn't attached (check the
  service's variables: `gcloud run services describe $SERVICE --region=$REGION --format=yaml | grep -A2 API_RELAY`).
- **Sign-in fails**: check Firebase authorized domains, `NEXTAUTH_URL` and the backend's `ALLOWED_ORIGINS`.

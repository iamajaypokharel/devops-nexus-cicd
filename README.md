# DevOps Nexus CI/CD 🚀

A hands-on DevOps project that takes a multi-container application (**Nginx frontend + Node.js backend + MongoDB**) and builds a CI/CD pipeline around it: **GitHub Actions builds Docker images and pushes them to a self-hosted Sonatype Nexus Repository** running on AWS EC2.

```
git push → GitHub Actions → build images → push to Nexus → pull & run anywhere
```

---

## 📌 Table of Contents

1. [Project Overview](#-project-overview)
2. [Architecture](#-architecture)
3. [Project Structure](#-project-structure)
4. [Technologies Used](#-technologies-used)
5. [Prerequisites](#-prerequisites)
6. [Getting Started (git clone to running app)](#-getting-started)
7. [Setting Up Nexus](#-setting-up-nexus)
8. [CI/CD Pipeline with GitHub Actions](#-cicd-pipeline-with-github-actions)
9. [Verifying the Result](#-verifying-the-result)
10. [Troubleshooting Log](#-troubleshooting-log)
11. [Security Notes](#-security-notes)
12. [What I Learned](#-what-i-learned)
13. [Roadmap](#-roadmap)
14. [Author](#-author)

---

## 📖 Project Overview

This repository has two goals:

1. **Application:** a small three-tier app, fully containerized with Docker Compose.
2. **DevOps pipeline:** automatically build the app's Docker images on every push to `main` and store them, versioned, in a private Nexus registry.

### What is Nexus and why use it?

**Sonatype Nexus Repository** is an *artifact repository manager*: a server that stores the packages, images and build outputs that software depends on or produces.

| Benefit | Why it matters |
|---------|----------------|
| Single source of truth | Every deployed image can be traced to a build |
| Private registry | No need to publish internal images publicly |
| Caching (proxy repos) | Faster builds, and builds survive upstream outages |
| Access control | Least-privilege users for CI instead of admin |

**Repository types**

| Type | Purpose | Used in this project |
|------|---------|----------------------|
| Hosted | Stores my own artifacts | `docker-hosted`, `my-files` |
| Proxy | Caches an external registry | `npm-proxy` (registry.npmjs.org) |
| Group | Combines several repos behind one URL | *(explored, not used yet)* |

---

## 🏗 Architecture

### Application

```
     Browser
        │  http://<host>:8080
        ▼
┌────────────────┐
│    Frontend    │  Nginx serves index.html
│     Nginx      │  and proxies /api
└───────┬────────┘
        │  /api
        ▼
┌────────────────┐
│    Backend     │  Node.js + Express
│     :5000      │
└───────┬────────┘
        │  MONGO_URI
        ▼
┌────────────────┐
│    MongoDB     │  data kept in a named volume
│     :27017     │
└────────────────┘
```

### CI/CD pipeline

```
Developer ──git push──► GitHub (main branch)
                            │
                            ▼
                   GitHub Actions runner
                   1. trust Nexus registry
                   2. docker login (secrets)
                   3. docker build (backend, frontend)
                   4. docker push :<commit-sha> and :latest
                            │
                            ▼
              Nexus (Docker on AWS EC2)
              docker-hosted registry, port 8082
                            │
                            ▼
              Any server: docker pull & run
```

---

## 📁 Project Structure

```
devops-nexus-cicd/
├── .github/
│   └── workflows/
│       └── nexus-push.yml      # CI pipeline (hidden folder, not shown by `tree`)
├── backend/
│   ├── Dockerfile              # Builds the Node.js backend image
│   ├── package.json            # Dependencies and scripts
│   ├── package-lock.json
│   ├── server.js               # Express API
│   └── tests/
│       └── server.test.js      # Backend tests
├── frontend/
│   ├── Dockerfile              # Builds the Nginx frontend image
│   ├── index.html              # Simple UI with a "Call Backend" button
│   └── nginx.conf              # Reverse proxy: /api → backend:5000
├── docker-compose.yml          # Runs frontend + backend + MongoDB
├── .env                        # Local secrets (NOT committed)
└── README.md
```

| Path | Purpose |
|------|---------|
| `backend/server.js` | Express API that connects to MongoDB using `MONGO_URI` |
| `backend/tests/server.test.js` | Automated tests for the backend |
| `frontend/nginx.conf` | Forwards `/api` requests to the backend container |
| `docker-compose.yml` | Defines the three services, network and volume |
| `.github/workflows/nexus-push.yml` | Builds and pushes images to Nexus on every push to `main` |

---

## 🛠 Technologies Used

- **Application:** HTML, JavaScript, Node.js, Express, Mongoose, MongoDB
- **Containers:** Docker, Docker Compose, Nginx
- **Artifact management:** Sonatype Nexus Repository (Community Edition)
- **CI/CD:** GitHub Actions
- **Cloud:** AWS EC2 (Ubuntu)
- **Version control:** Git, GitHub

---

## ✅ Prerequisites

- An Ubuntu machine with **Git** and **Docker** (with the Compose plugin) installed
- An **AWS EC2** instance for Nexus (this project used one with a public IP)
- A **GitHub** account and a Personal Access Token (for `git push` over HTTPS)
- Basic terminal knowledge

---

## 🚀 Getting Started

### 1. Create the GitHub repository

On GitHub: **+ → New repository** → name it `devops-nexus-cicd` → tick **Add a README file** → **Create repository**.

### 2. Clone it

```bash
cd ~
git clone https://github.com/iamajaypokharel/devops-nexus-cicd.git
cd devops-nexus-cicd
```

> GitHub does not accept account passwords for `git push`. Use a **Personal Access Token** (GitHub → Settings → Developer settings → Personal access tokens) as the password. Tick `repo`, and `workflow` if you push workflow files.

### 3. Add the project files

Copy `backend/`, `frontend/` and `docker-compose.yml` into the repo, and create the workflow folder:

```bash
mkdir -p .github/workflows
```

### 4. Configure environment variables

Create a `.env` file (never commit it):

```bash
nano .env
```

```env
MONGO_DB=dockercompose
MONGO_USER=admin
MONGO_PASSWORD=change-me

BACKEND_PORT=5000
FRONTEND_PORT=8080
```

Make sure `.gitignore` contains `.env`:

```bash
echo ".env" >> .gitignore
git status        # .env must NOT be listed
```

### 5. Run the app locally

```bash
docker compose config          # validate the compose file
docker compose up -d --build
docker compose ps
```

Open `http://localhost:8080` and click **Call Backend**. You should see `Hello from Backend! 🚀`.

Useful commands:

```bash
docker compose logs -f         # follow logs
docker compose logs backend
docker compose down            # stop
docker compose down -v         # stop AND delete the MongoDB volume
```

### 6. Commit and push

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"

git add .
git commit -m "Add app, compose file and Nexus CI workflow"
git push origin main
```

---

## 📦 Setting Up Nexus

### 1. Run Nexus in Docker on EC2

```bash
docker run -d --name nexus --restart unless-stopped \
  -p 8081:8081 -p 8082:8082 \
  -v nexus-data:/nexus-data \
  sonatype/nexus3
```

| Option | Meaning |
|--------|---------|
| `-p 8081:8081` | Nexus web UI |
| `-p 8082:8082` | Docker registry port |
| `-v nexus-data:/nexus-data` | Named volume so repos, users and settings survive container recreation |
| `--restart unless-stopped` | Starts automatically after a reboot |

Startup takes 1 to 3 minutes. Watch with `docker logs -f nexus`.

Get the initial admin password:

```bash
docker exec nexus cat /nexus-data/admin.password
```

### 2. Open the AWS security group

In the EC2 console, add inbound rules for **TCP 8081** (UI) and **TCP 8082** (Docker registry).

> Open to `0.0.0.0/0` here for practice only. See [Security Notes](#-security-notes).

### 3. Explore the UI (learning)

Open `http://<EC2-IP>:8081` and log in as `admin`.

| Menu | What it does |
|------|--------------|
| Dashboard | System status |
| Search | Finds *components* (packages), not repositories |
| Browse | Shows what is stored in each repo |
| Upload | Manual upload into a hosted repo |
| Settings (gear) | Repositories, security, tasks |

### 4. Practice repos

**Raw hosted repo** (`my-files`): upload a file, then download it:

```bash
curl -u admin:PASSWORD -O "http://<EC2-IP>:8081/repository/my-files/files/nepal.txt"
```

- Wrap URLs in quotes: bash treats `(` and `)` as special characters.
- Avoid spaces in file names (they must be written as `%20`).

**npm proxy repo** (`npm-proxy`, remote `https://registry.npmjs.org`): npm asks Nexus, Nexus fetches from the internet and caches a copy.

```bash
npm config set registry http://<EC2-IP>:8081/repository/npm-proxy/
```

Nexus requires login, so add credentials to `~/.npmrc`:

```
registry=http://<EC2-IP>:8081/repository/npm-proxy/
//<EC2-IP>:8081/repository/npm-proxy/:_auth=BASE64_OF_USER:PASSWORD
//<EC2-IP>:8081/repository/npm-proxy/:email=me@example.com
```

Test it:

```bash
curl -u user:pass -I http://<EC2-IP>:8081/repository/npm-proxy/lodash/   # expect 200
```

> ⚠️ **Typosquatting lesson:** I mistyped `lodash` as `loadsh`, and it installed. npm warned that it is a *typosquat*, a fake package with a name close to a popular one. Always check spelling. A private proxy lets a team audit or block such packages.
> Fix: `npm uninstall loadsh && npm install lodash`

### 5. Create the Docker registry (`docker-hosted`)

In **Settings → Repository → Repositories → Create repository → docker (hosted)**:

- **Name:** `docker-hosted`
- **HTTP connector:** tick it and enter `8082`
- **Deployment policy:** *Allow redeploy* (so the `latest` tag can be overwritten)

> Nexus only opens port 8082 once a Docker repo has an HTTP connector on that port. Without it, connections to 8082 are reset even if the container publishes the port.

### 6. Create a CI user (least privilege)

Never use `admin` in pipelines.

1. **Settings → Security → Roles → Create role** → e.g. `ci-docker`, with privilege `nx-repository-view-docker-docker-hosted-*`
2. **Settings → Security → Users → Create user** → `ci-user`, assigned that role

### 7. Trust the HTTP registry on machines that push or pull

Docker refuses plain HTTP registries by default:

```bash
echo '{"insecure-registries":["<EC2-IP>:8082"]}' | sudo tee /etc/docker/daemon.json
sudo systemctl restart docker
```

### 8. Test manually before automating

```bash
docker login <EC2-IP>:8082 -u ci-user
docker build -t <EC2-IP>:8082/compose-backend:v1 ./backend
docker push <EC2-IP>:8082/compose-backend:v1
```

Then check **Browse → docker-hosted** in the Nexus UI.

---

## ⚙️ CI/CD Pipeline with GitHub Actions

### 1. Add repository secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|--------|-------|
| `NEXUS_USER` | `ci-user` |
| `NEXUS_PASSWORD` | the CI user's password |

Secrets do not copy between repositories, so add them again in each new repo.

### 2. The workflow

`.github/workflows/nexus-push.yml`:

```yaml
name: Build and push to Nexus

on:
  push:
    branches: [main]

env:
  REGISTRY: <EC2-IP>:8082

jobs:
  build-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Trust Nexus (HTTP registry)
        run: |
          echo '{"insecure-registries":["${{ env.REGISTRY }}"]}' | sudo tee /etc/docker/daemon.json
          sudo systemctl restart docker

      - name: Login to Nexus
        run: echo "${{ secrets.NEXUS_PASSWORD }}" | docker login ${{ env.REGISTRY }} -u "${{ secrets.NEXUS_USER }}" --password-stdin

      - name: Build images
        run: |
          docker build -t ${{ env.REGISTRY }}/compose-backend:${{ github.sha }} -t ${{ env.REGISTRY }}/compose-backend:latest ./backend
          docker build -t ${{ env.REGISTRY }}/compose-frontend:${{ github.sha }} -t ${{ env.REGISTRY }}/compose-frontend:latest ./frontend

      - name: Push images
        run: |
          docker push --all-tags ${{ env.REGISTRY }}/compose-backend
          docker push --all-tags ${{ env.REGISTRY }}/compose-frontend
```

Replace `<EC2-IP>` with your Nexus server's address.

### Design decisions

| Decision | Reason |
|----------|--------|
| Plain `docker build` / `docker push` | `docker/build-push-action` uses a builder that ignores the daemon's `insecure-registries` setting |
| Two tags per image | The **commit SHA** traces an image to exact code; `latest` is a convenience tag |
| `--password-stdin` | Keeps the password out of process lists and shell history |
| Dedicated `ci-user` | Least privilege: it can only touch the Docker repo |

---

## 🔍 Verifying the Result

1. **GitHub → Actions:** the run shows a green tick.
2. **Nexus → Browse → docker-hosted:** `compose-backend` and `compose-frontend` appear, each with a `latest` tag and a commit-SHA tag.
3. **Round trip test** from any trusted server:

```bash
docker login <EC2-IP>:8082 -u ci-user
docker pull <EC2-IP>:8082/compose-backend:latest
```

To run the app from Nexus images, change `docker-compose.yml` to use `image:` instead of `build:`:

```yaml
backend:
  image: <EC2-IP>:8082/compose-backend:latest
frontend:
  image: <EC2-IP>:8082/compose-frontend:latest
```

```bash
docker compose pull && docker compose up -d
```

---

## 🧪 Troubleshooting Log

Real problems I hit while building this, and how each was solved.

| Symptom | Cause | Fix |
|---------|-------|-----|
| `bash: syntax error near unexpected token '('` | Unquoted filename with brackets | Quote the URL |
| Shell waits with a `>` prompt | Missing closing quote | `Ctrl+C`, retype the command |
| `npm ERR! E401 Unable to authenticate` | Nexus requires authentication | Put credentials in `~/.npmrc` |
| `npm ERR! ENYI Web login not supported` | npm tried browser-based login | `npm login --auth-type=legacy` |
| Docker login: `context deadline exceeded` | Firewall dropping traffic | Open TCP 8082 in the security group |
| Docker login: `connection refused` | Nothing listening on 8082 | Publish `-p 8082:8082` on the container |
| `Connection reset by peer` on 8082 | Port published, but no Docker repo connector | Create `docker-hosted` with HTTP port 8082 |
| No **Create repository** button | Not logged in as admin, or wrong page | Log in as admin (or use the Nexus REST API) |

### How to read network errors

- **Timeout:** traffic is being dropped (firewall or security group).
- **Connection refused:** the server was reached, but nothing is listening.
- **Connection reset:** the port is forwarded, but no service is behind it.
- **`401 Unauthorized` on `/v2/`:** healthy. The registry is up and wants credentials.

### Recreating the Nexus container without losing data

```bash
docker stop nexus
docker rm nexus          # removes the container only, not the volume
docker run -d --name nexus --restart unless-stopped \
  -p 8081:8081 -p 8082:8082 \
  -v nexus-data:/nexus-data \
  sonatype/nexus3
```

Check the data volume first with `docker inspect nexus --format '{{ json .Mounts }}'`. If there is no volume, back up before recreating.

### Health checks on the Nexus server

```bash
docker ps
curl -I http://localhost:8081        # expect 200 OK
curl -I http://localhost:8082/v2/    # expect 401 Unauthorized
```

---

## 🔐 Security Notes

This setup is for **learning**. Before treating anything like production:

- [ ] Change the `admin` password, and any password that was ever shared or pasted anywhere
- [ ] Never use `admin` in pipelines. Use a limited `ci-user`
- [ ] Never commit `.env` or passwords. Use GitHub Secrets
- [ ] Base64 in `~/.npmrc` is **encoding, not encryption**. Protect the file
- [ ] Ports 8081/8082 are open to the internet over plain HTTP, so credentials travel unencrypted. Put Nexus behind **Nginx with HTTPS**, restrict access, or use a self-hosted runner in the same network
- [ ] Allocate an **Elastic IP**, because a normal EC2 public IP changes when the instance is stopped and started (the workflow hardcodes the IP)
- [ ] Set a **cleanup policy** on `docker-hosted`, and a scheduled task to compact the blob store, so the disk doesn't fill up

---

## 📚 What I Learned

- **Nexus:** hosted, proxy and group repositories; blob stores; realms; roles and users
- **Docker:** registries, tags, `insecure-registries`, published ports, named volumes, `--restart` policies
- **CI/CD:** GitHub Actions workflows, secrets, tagging images with the commit SHA
- **Debugging:** reading timeout vs refused vs reset errors to find which layer is broken
- **Security:** least-privilege CI users, typosquatting, why base64 is not encryption
- **AWS:** security groups, why public IPs change, Elastic IPs

---

## 🗺 Roadmap

- [ ] Run `backend/tests/server.test.js` in CI before pushing images
- [ ] Add a **deploy job**: SSH to the app server, pull from Nexus, `docker compose up -d`
- [ ] Route the backend's `npm install` through `npm-proxy` inside the Dockerfile
- [ ] Add image vulnerability scanning (for example Trivy) before the push
- [ ] Add **Jenkins** with a Jenkinsfile using the same steps
- [ ] Put **Nginx + HTTPS** in front of Nexus and remove `insecure-registries`
- [ ] Try **Maven** hosted repos and `mvn deploy`
- [ ] Monitoring with Prometheus and Grafana
- [ ] Infrastructure as Code with Terraform and Ansible
- [ ] Kubernetes deployment

---

## 👨‍💻 Author

**Ajay Pokharel**
CSIT Graduate | Junior DevOps Learner | Developer & Educator

- GitHub: https://github.com/iamajaypokharel
- Portfolio: https://ajaypokharel.com.np/

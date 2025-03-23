# CI/CD for Docker Deployment

This document explains the CI/CD setup for the Trading App backend, including how to configure GitHub Actions for automatic deployment to a VPS and Docker Hub.

## Workflow Overview

Our CI/CD workflow performs the following steps:

1. Builds the Docker image
2. Pushes the image to Docker Hub
3. Deploys the latest image to a VPS
4. Verifies the deployment

## Required GitHub Secrets

To use this workflow, you need to set up the following secrets in your GitHub repository:

| Secret Name             | Description                             | Example                                                                     |
| ----------------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| `DOCKER_HUB_USERNAME`   | Your Docker Hub username                | `youruser`                                                                  |
| `DOCKER_HUB_TOKEN`      | Docker Hub personal access token        | `dckr_pat_xxxxxxxxxxxx`                                                     |
| `VPS_HOST`              | The IP address of your VPS              | `123.456.789.123`                                                           |
| `VPS_USERNAME`          | SSH username for your VPS               | `root`                                                                      |
| `VPS_SSH_KEY`           | Private SSH key for accessing your VPS  | `-----BEGIN OPENSSH PRIVATE KEY-----...`                                    |
| `VPS_PORT`              | SSH port for your VPS                   | `22`                                                                        |
| `DATABASE_URL`          | PostgreSQL connection string            | `postgresql://postgres:postgres@timescaledb:5432/trading_app?schema=public` |
| `BACKEND_PORT`          | Port for the backend service            | `3001`                                                                      |
| `JWT_SECRET`            | Secret for JWT tokens                   | `your-secure-jwt-secret`                                                    |
| `JWT_EXPIRES_IN`        | JWT token expiration time               | `7d`                                                                        |
| `BINANCE_WEBSOCKET_URL` | Binance WebSocket URL                   | `wss://stream.binance.com:9443/ws`                                          |
| `TRADING_SYMBOLS`       | Comma-separated list of trading symbols | `btcusdt,ethusdt,bnbusdt,solusdt,adausdt`                                   |

## Setting Up GitHub Secrets

1. Go to your GitHub repository
2. Click on "Settings" > "Secrets and variables" > "Actions"
3. Click "New repository secret"
4. Add each of the required secrets listed above

## Workflow File

The workflow is defined in `.github/workflows/backend-deploy.yml`:

```yaml
name: Backend CI/CD

on:
  push:
    branches: [main]
    paths:
      - "backend/**"
      - ".github/workflows/backend-deploy.yml"

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_HUB_USERNAME }}
          password: ${{ secrets.DOCKER_HUB_TOKEN }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: ./backend
          push: true
          tags: ${{ secrets.DOCKER_HUB_USERNAME }}/trading-app-backend:latest,${{ secrets.DOCKER_HUB_USERNAME }}/trading-app-backend:${{ github.sha }}
          cache-from: type=registry,ref=${{ secrets.DOCKER_HUB_USERNAME }}/trading-app-backend:buildcache
          cache-to: type=registry,ref=${{ secrets.DOCKER_HUB_USERNAME }}/trading-app-backend:buildcache,mode=max

      - name: Deploy to VPS
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USERNAME }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT }}
          script: |
            # Navigate to project directory
            cd /path/to/trading-app

            # Pull the latest code
            git pull

            # Login to Docker Hub
            echo "${{ secrets.DOCKER_HUB_TOKEN }}" | docker login -u ${{ secrets.DOCKER_HUB_USERNAME }} --password-stdin

            # Stop and remove the existing container if it exists
            docker stop trading-backend || true
            docker rm trading-backend || true

            # Pull the latest image
            docker pull ${{ secrets.DOCKER_HUB_USERNAME }}/trading-app-backend:latest

            # Create .env file from secrets
            cat > .env << EOL
            DATABASE_URL=${{ secrets.DATABASE_URL }}
            PORT=${{ secrets.BACKEND_PORT }}
            NODE_ENV=production
            JWT_SECRET=${{ secrets.JWT_SECRET }}
            JWT_EXPIRES_IN=${{ secrets.JWT_EXPIRES_IN }}
            BINANCE_WEBSOCKET_URL=${{ secrets.BINANCE_WEBSOCKET_URL }}
            TRADING_SYMBOLS=${{ secrets.TRADING_SYMBOLS }}
            EOL

            # Run the new container
            docker run -d \
              --name trading-backend \
              --restart unless-stopped \
              -p ${{ secrets.BACKEND_PORT }}:${{ secrets.BACKEND_PORT }} \
              --env-file .env \
              --network trading-network \
              ${{ secrets.DOCKER_HUB_USERNAME }}/trading-app-backend:latest

      - name: Verify Deployment
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USERNAME }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT }}
          script: |
            # Wait for the container to start
            sleep 15

            # Check if the container is running
            if docker ps | grep trading-backend; then
              echo "✅ Container is running"
              
              # Get the logs (last 10 lines)
              docker logs --tail 10 trading-backend
              
              # Test the health endpoint
              if curl -s http://localhost:${{ secrets.BACKEND_PORT }}/health | grep -q "ok"; then
                echo "✅ Health check passed"
              else
                echo "❌ Health check failed"
                exit 1
              fi
            else
              echo "❌ Container failed to start"
              docker logs trading-backend
              exit 1
            fi
```

## VPS Preparation

Before the CI/CD pipeline can deploy to your VPS, you need to prepare the server:

1. **Install Docker and Docker Compose**:

   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh

   # Install Docker Compose
   sudo apt-get update
   sudo apt-get install -y docker-compose
   ```

2. **Create Docker Network**:

   ```bash
   docker network create trading-network
   ```

3. **Set up Project Directory**:

   ```bash
   mkdir -p /path/to/trading-app
   ```

4. **Configure SSH Access**:
   - Generate an SSH key pair
   - Add the public key to your server's `~/.ssh/authorized_keys`
   - Add the private key to GitHub Secrets as `VPS_SSH_KEY`

## Testing the Workflow

To test the workflow:

1. Make a change in the backend code
2. Commit and push to the main branch
3. Watch the GitHub Actions tab in your repository
4. Verify the workflow completes successfully

## Troubleshooting

If the workflow fails, check:

1. **Docker Hub Credentials**: Ensure your Docker Hub credentials are correct
2. **SSH Access**: Verify SSH access to your VPS
3. **Docker Network**: Ensure the `trading-network` exists on your VPS
4. **Port Availability**: Make sure the specified port is available on your VPS
5. **VPS Firewall**: Check if your VPS firewall allows traffic on the backend port

## Advanced Configuration

### Scaling with Docker Swarm

For scaling to multiple nodes, consider using Docker Swarm:

```bash
# Initialize Docker Swarm
docker swarm init

# Deploy as a stack
docker stack deploy -c docker-compose.yml trading-app
```

### Setting up a Database Instance

For production, you may want to set up a managed database like AWS RDS or use a standalone TimescaleDB instance:

```bash
docker run -d \
  --name timescaledb \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=securepassword \
  -e POSTGRES_DB=trading_app \
  -v timescale_data:/var/lib/postgresql/data \
  --network trading-network \
  timescale/timescaledb:latest-pg14
```

### Setting up Nginx Reverse Proxy

For SSL termination and routing, configure Nginx:

```bash
# Install Nginx
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx

# Configure Nginx
cat > /etc/nginx/sites-available/trading-app << EOL
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOL

# Enable the site
ln -s /etc/nginx/sites-available/trading-app /etc/nginx/sites-enabled/

# Verify Nginx config
nginx -t

# Restart Nginx
systemctl restart nginx

# Obtain SSL certificate
certbot --nginx -d yourdomain.com
```

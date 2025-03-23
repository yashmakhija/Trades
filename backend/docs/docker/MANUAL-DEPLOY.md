# Manual Deployment to VPS

This document guides you through manually deploying the Trading App backend to a Virtual Private Server (VPS).

## Prerequisites

Before you begin the deployment process, ensure you have:

- SSH access to your VPS
- Docker installed on your VPS
- A properly configured `.env` file with all required environment variables
- Docker network named `trading-network` on your VPS (the script will create this if it doesn't exist)

## Usage

The deployment script is located at `scripts/deploy-to-vps.sh` and automates the following tasks:

1. Building a Docker image of the backend
2. Optionally pushing it to Docker Hub
3. Transferring necessary files to your VPS
4. Starting the container on your VPS

To use the script, run:

```bash
./deploy-to-vps.sh [user@host] [port] [directory]
```

### Parameters:

- `user@host` (required): SSH username and hostname/IP of your VPS
- `port` (optional): SSH port (default: 22)
- `directory` (optional): Deployment directory on VPS (default: `/yash-code/Trades`)

Example:

```bash
./deploy-to-vps.sh root@123.456.789.012 22 /yash-code/Trades
```

### Deployment Options:

During deployment, you'll be asked if you want to push the Docker image to Docker Hub:

- If you choose **Yes**, you'll need to provide your Docker Hub username, and the image will be pushed to Docker Hub and then pulled on the VPS.
- If you choose **No**, the image will be exported as a `.tar` file and transferred directly to the VPS.

## Environment Variables

The deployment requires the following environment variables in your `.env` file:

```
DATABASE_URL=postgresql://postgres:postgres@timescaledb:5432/trading_app?schema=public
PORT=3001
NODE_ENV=production
JWT_SECRET=your-secure-jwt-secret
```

Example values:

- `DATABASE_URL`: Connection string to your database
- `PORT`: Port on which the backend will run (default: 3001)
- `NODE_ENV`: Environment (production, development, test)
- `JWT_SECRET`: Secret key for JWT token generation

## VPS Preparation

### Installing Docker (if not already installed)

```bash
# Update system packages
apt update && apt upgrade -y

# Install Docker dependencies
apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -

# Add Docker repository
add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"

# Update repository information
apt update

# Install Docker
apt install -y docker-ce

# Start and enable Docker
systemctl start docker
systemctl enable docker
```

### Creating Docker Network

```bash
docker network create trading-network
```

### Setting up a TimescaleDB Database (Optional)

If you want to run a TimescaleDB container on the same VPS:

```bash
docker run -d \
  --name timescaledb \
  --network trading-network \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=trading_app \
  -v timescale_data:/var/lib/postgresql/data \
  --restart unless-stopped \
  timescale/timescaledb:latest-pg14
```

Then update your `.env` file's `DATABASE_URL` to point to this container:

```
DATABASE_URL=postgresql://postgres:postgres@timescaledb:5432/trading_app?schema=public
```

## Verifying Deployment

After deployment, you should verify that everything is working correctly.

### Check Container Status

```bash
docker ps | grep trading-backend-2
```

### View Container Logs

```bash
docker logs trading-backend-2
```

### Test Health Endpoint

```bash
curl http://localhost:3001/health
```

## Troubleshooting

### Connection Error

If you can't connect to the deployed API, ensure the port is open in your firewall:

```bash
ufw allow 3001/tcp
```

### Database Connection Error

If the application can't connect to the database, verify:

1. The database container is running (if using a containerized database)
2. The `DATABASE_URL` is correct
3. The Docker network is properly configured

### Permission Issues

If permission errors occur during deployment, ensure your SSH user has the necessary permissions.

### Docker Network Issues

If containers can't communicate, ensure they're on the same Docker network:

```bash
docker network inspect trading-network
```

## Security Considerations for Production

For production environments, consider:

1. Using non-root SSH access with key authentication
2. Setting up a firewall (ufw or firewalld)
3. Using HTTPS with a reverse proxy (Nginx, Traefik)
4. Regularly updating your server and Docker images
5. Using Docker Compose for managing multiple services
6. Implementing proper logging and monitoring

## Setting up a Reverse Proxy (Nginx)

For production, it's recommended to set up a reverse proxy:

```bash
# Install Nginx
apt install -y nginx

# Create Nginx configuration
cat > /etc/nginx/sites-available/trading-app << 'EOF'
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable the site
ln -s /etc/nginx/sites-available/trading-app /etc/nginx/sites-enabled/

# Test Nginx configuration
nginx -t

# Restart Nginx
systemctl restart nginx
```

### Setting up SSL with Certbot

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Obtain and install SSL certificate
certbot --nginx -d api.yourdomain.com
```

This will automatically configure HTTPS for your domain.

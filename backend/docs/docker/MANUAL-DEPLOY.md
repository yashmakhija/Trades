# Manual Deployment to VPS

This guide explains how to manually deploy the Trading App backend to a VPS using the provided deployment script.

## Prerequisites

Before you begin, make sure you have:

1. SSH access to your VPS
2. Docker installed on your local machine and VPS
3. Properly configured `.env` file with production settings
4. Docker network `trading-network` created on your VPS

## Deployment Script

We provide a deployment script in `scripts/deploy-to-vps.sh` which automates the process of:

1. Building a Docker image
2. Optionally pushing it to Docker Hub
3. Transferring necessary files to your VPS
4. Setting up and running the container on your VPS

## Usage

```bash
cd backend/scripts
./deploy-to-vps.sh [user@host] [port] [directory]
```

### Parameters

- `user@host`: (Required) SSH user and host of your VPS (e.g., `root@123.456.789.123`)
- `port`: (Optional) SSH port (default: `22`)
- `directory`: (Optional) Deployment directory on the VPS (default: `/opt/trading-app`)

### Example

```bash
./deploy-to-vps.sh root@123.456.789.123 22 /opt/trading-app
```

## Options During Deployment

The script will prompt you to decide whether to push the Docker image to Docker Hub:

- If you choose **Yes**, the image will be pushed to Docker Hub, and then pulled on your VPS
- If you choose **No**, the script will pack the image as a `.tar` file and transfer it directly to your VPS

## Environment Variables

Ensure your `.env` file is properly configured with all the necessary environment variables:

```
DATABASE_URL=postgresql://postgres:securepassword@timescaledb:5432/trading_app?schema=public
PORT=3001
NODE_ENV=production
JWT_SECRET=your-secure-jwt-secret
JWT_EXPIRES_IN=7d
BINANCE_WEBSOCKET_URL=wss://stream.binance.com:9443/ws
TRADING_SYMBOLS=btcusdt,ethusdt,bnbusdt,solusdt,adausdt
DOCKER_HUB_USERNAME=yourusername
```

## VPS Preparation

Before running the deployment script, prepare your VPS:

1. Install Docker:

   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   ```

2. Create the Docker network:

   ```bash
   docker network create trading-network
   ```

3. Set up a database (if you're using a local TimescaleDB):
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

## Verifying Deployment

After the script finishes, verify that everything is working correctly:

1. Check if the container is running:

   ```bash
   docker ps | grep trading-backend
   ```

2. Check the container logs:

   ```bash
   docker logs trading-backend
   ```

3. Test the health endpoint:
   ```bash
   curl http://localhost:3001/health
   ```

## Troubleshooting

If you encounter issues:

1. **Connection refused**:

   - Ensure the port is open in your firewall
   - Verify the Docker container is running

2. **Database connection error**:

   - Check your `DATABASE_URL` environment variable
   - Ensure the database is running and accessible on the Docker network

3. **Permission denied**:

   - Check your SSH key permissions
   - Ensure you have write access to the deployment directory

4. **Docker network issues**:
   - Verify the network exists: `docker network ls`
   - Check container network connections: `docker network inspect trading-network`

## Security Considerations

For enhanced security in production:

1. Use non-root user for SSH access
2. Set up a firewall (UFW or iptables)
3. Use HTTPS with a reverse proxy
4. Use strong, unique passwords for all services
5. Regularly update your system and Docker images

## Additional Configuration

### Setting up a Reverse Proxy

For production deployments, you should use a reverse proxy like Nginx:

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

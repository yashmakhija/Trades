# Deploying the Trading App Backend to a VPS

This guide provides step-by-step instructions for deploying the Trading App backend to a VPS using Docker.

## Prerequisites

- A VPS with at least 2GB RAM and 1 CPU core
- Ubuntu 20.04 or later installed on the VPS
- Root access to the VPS
- Domain name (optional)

## 1. Install Docker and Docker Compose

SSH into your VPS and install Docker and Docker Compose:

```bash
# Update system packages
sudo apt update
sudo apt upgrade -y

# Install required packages
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

# Add Docker repository
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.12.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add your user to the docker group (optional, for non-root users)
sudo usermod -aG docker $USER
```

After installing, you may need to log out and log back in for the group changes to take effect.

## 2. Clone the Repository

Clone the repository to your VPS:

```bash
# Create a directory for the application
mkdir -p /var/www/trading-app
cd /var/www/trading-app

# Clone the repository (if using Git)
git clone https://your-repository-url.git .

# Alternatively, upload the files via SFTP or SCP
```

## 3. Configure Environment Variables

The docker-compose.yml file includes default environment variables, but you should modify them for production use:

```bash
# Edit the docker-compose.yml file
nano docker-compose.yml
```

Important variables to change:

- `JWT_SECRET`: Set a strong, unique secret key
- `POSTGRES_PASSWORD`: Change the default database password
- Update the `DATABASE_URL` to match your new database credentials

## 4. Start the Application

Start the application using Docker Compose:

```bash
# Navigate to the backend directory
cd /var/www/trading-app/backend

# Start the services
docker-compose up -d

# Check if the containers are running
docker-compose ps
```

The `-d` flag runs the containers in detached mode (background).

## 5. View Logs

To view the logs of the running containers:

```bash
# View logs for all services
docker-compose logs

# View logs for a specific service
docker-compose logs backend

# Follow logs in real-time
docker-compose logs -f
```

## 6. Set Up a Reverse Proxy (Optional)

For production environments, it's recommended to set up a reverse proxy with SSL/TLS:

### Install Nginx

```bash
sudo apt update
sudo apt install -y nginx
```

### Configure Nginx as a Reverse Proxy

```bash
# Create a new Nginx configuration file
sudo nano /etc/nginx/sites-available/trading-app
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/trading-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Set Up SSL with Certbot

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain an SSL certificate
sudo certbot --nginx -d your-domain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

## 7. Updating the Application

To update the application:

```bash
# Navigate to the application directory
cd /var/www/trading-app/backend

# Pull the latest changes if using Git
git pull

# Rebuild and restart the containers
docker-compose down
docker-compose build
docker-compose up -d
```

## 8. Backup and Restore

### Backup the Database

```bash
# Create a backup script
nano backup.sh
```

Add the following content:

```bash
#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
BACKUP_DIR="/var/backups/trading-app"

mkdir -p $BACKUP_DIR

# Backup the database
docker exec -t trading-app_timescaledb_1 pg_dump -U postgres -d trading_app > $BACKUP_DIR/db_backup_$TIMESTAMP.sql

# Compress the backup
gzip $BACKUP_DIR/db_backup_$TIMESTAMP.sql

echo "Backup completed: $BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"
```

Make the script executable:

```bash
chmod +x backup.sh
```

### Restore from Backup

```bash
# Restore a database backup
gunzip -c /var/backups/trading-app/db_backup_TIMESTAMP.sql.gz | docker exec -i trading-app_timescaledb_1 psql -U postgres -d trading_app
```

## 9. Monitoring and Maintenance

Consider setting up monitoring for your VPS:

- **Basic monitoring**: Use `htop`, `docker stats`, and regular log checks
- **Advanced monitoring**: Set up Prometheus and Grafana for detailed metrics

## Troubleshooting

If you encounter issues:

1. Check container logs: `docker-compose logs -f`
2. Check container status: `docker-compose ps`
3. Restart containers: `docker-compose restart`
4. Rebuild if necessary: `docker-compose down && docker-compose up -d --build`

## Security Considerations

For production deployment, consider these additional security measures:

1. Use non-root Docker images
2. Secure the Docker daemon
3. Set up a firewall (UFW)
4. Configure regular security updates
5. Use secrets management for sensitive data
6. Regularly backup your database

## Support

If you encounter any issues with deployment, please refer to:

- [Docker Documentation](https://docs.docker.com/)
- [TimescaleDB Documentation](https://docs.timescale.com/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

#!/bin/bash
set -e

# Script to manually deploy the backend to a VPS
# Usage: ./deploy-to-vps.sh user@host [port] [directory]

# Default values
SSH_PORT=22
DEPLOY_DIR="/opt/trading-app"

# Process arguments
if [ -z "$1" ]; then
    echo "Error: SSH host is required."
    echo "Usage: ./deploy-to-vps.sh user@host [port] [directory]"
    exit 1
fi

SSH_HOST="$1"

if [ ! -z "$2" ]; then
    SSH_PORT="$2"
fi

if [ ! -z "$3" ]; then
    DEPLOY_DIR="$3"
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Trading App Backend Manual Deployment ===${NC}"
echo -e "${YELLOW}Host:${NC} $SSH_HOST"
echo -e "${YELLOW}Port:${NC} $SSH_PORT"
echo -e "${YELLOW}Directory:${NC} $DEPLOY_DIR"
echo

# Check if .env exists
if [ ! -f ../.env ]; then
    echo -e "${RED}Error: .env file not found in the parent directory.${NC}"
    echo "Please create a .env file with your production environment variables."
    exit 1
fi

# Build Docker image
echo -e "${YELLOW}Building Docker image...${NC}"
cd ..
docker build -t trading-app-backend:deploy .

# Tag the image
echo -e "${YELLOW}Tagging image...${NC}"
DOCKER_USERNAME=$(grep DOCKER_HUB_USERNAME .env | cut -d '=' -f2)
if [ -z "$DOCKER_USERNAME" ]; then
    echo -e "${YELLOW}DOCKER_HUB_USERNAME not found in .env, using 'local' as the username.${NC}"
    DOCKER_USERNAME="local"
fi
docker tag trading-app-backend:deploy $DOCKER_USERNAME/trading-app-backend:latest

# Ask if the user wants to push to Docker Hub
echo -e "${YELLOW}Do you want to push the image to Docker Hub? (y/n)${NC}"
read -r PUSH_TO_DOCKERHUB

if [[ "$PUSH_TO_DOCKERHUB" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Pushing to Docker Hub...${NC}"
    docker push $DOCKER_USERNAME/trading-app-backend:latest
    
    # Create deployment script with Docker Hub image
    DEPLOY_SCRIPT=$(cat <<EOF
#!/bin/bash
set -e

# Create directory if it doesn't exist
mkdir -p $DEPLOY_DIR
cd $DEPLOY_DIR

# Pull the latest image
docker pull $DOCKER_USERNAME/trading-app-backend:latest

# Stop and remove existing container
docker stop trading-backend || true
docker rm trading-backend || true

# Run the new container
docker run -d \\
  --name trading-backend \\
  --restart unless-stopped \\
  -p 3001:3001 \\
  --env-file .env \\
  --network trading-network \\
  $DOCKER_USERNAME/trading-app-backend:latest

echo "Deployment completed successfully!"
EOF
    )
else
    echo -e "${YELLOW}Skipping Docker Hub push. Will export image to tar file and transfer it.${NC}"
    
    # Save image to tar file
    echo -e "${YELLOW}Saving image to tar file...${NC}"
    docker save -o trading-app-backend.tar $DOCKER_USERNAME/trading-app-backend:latest
    
    # Create deployment script with local image
    DEPLOY_SCRIPT=$(cat <<EOF
#!/bin/bash
set -e

# Create directory if it doesn't exist
mkdir -p $DEPLOY_DIR
cd $DEPLOY_DIR

# Load the image from tar file
docker load -i trading-app-backend.tar

# Stop and remove existing container
docker stop trading-backend || true
docker rm trading-backend || true

# Run the new container
docker run -d \\
  --name trading-backend \\
  --restart unless-stopped \\
  -p 3001:3001 \\
  --env-file .env \\
  --network trading-network \\
  $DOCKER_USERNAME/trading-app-backend:latest

# Clean up
rm trading-app-backend.tar

echo "Deployment completed successfully!"
EOF
    )
fi

# Create temporary deployment script
echo "$DEPLOY_SCRIPT" > deploy-temp.sh
chmod +x deploy-temp.sh

# Copy .env file
echo -e "${YELLOW}Copying .env file...${NC}"
scp -P $SSH_PORT .env $SSH_HOST:$DEPLOY_DIR/.env

if [[ "$PUSH_TO_DOCKERHUB" =~ ^[Yy]$ ]]; then
    # Copy deployment script to server
    echo -e "${YELLOW}Copying deployment script to server...${NC}"
    scp -P $SSH_PORT deploy-temp.sh $SSH_HOST:$DEPLOY_DIR/deploy.sh
    
    # Execute deployment script
    echo -e "${YELLOW}Executing deployment script on server...${NC}"
    ssh -p $SSH_PORT $SSH_HOST "cd $DEPLOY_DIR && chmod +x deploy.sh && ./deploy.sh"
else
    # Copy tar file to server
    echo -e "${YELLOW}Copying image to server (this may take a while)...${NC}"
    scp -P $SSH_PORT trading-app-backend.tar $SSH_HOST:$DEPLOY_DIR/trading-app-backend.tar
    
    # Copy deployment script to server
    echo -e "${YELLOW}Copying deployment script to server...${NC}"
    scp -P $SSH_PORT deploy-temp.sh $SSH_HOST:$DEPLOY_DIR/deploy.sh
    
    # Execute deployment script
    echo -e "${YELLOW}Executing deployment script on server...${NC}"
    ssh -p $SSH_PORT $SSH_HOST "cd $DEPLOY_DIR && chmod +x deploy.sh && ./deploy.sh"
    
    # Clean up local tar file
    rm trading-app-backend.tar
fi

# Clean up temporary script
rm deploy-temp.sh

echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo -e "${YELLOW}To verify deployment:${NC}"
echo -e "1. SSH into your server: ssh -p $SSH_PORT $SSH_HOST"
echo -e "2. Check if container is running: docker ps | grep trading-backend"
echo -e "3. Check the logs: docker logs trading-backend"
echo -e "4. Test the health endpoint: curl http://localhost:3001/health" 
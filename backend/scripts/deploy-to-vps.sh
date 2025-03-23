#!/bin/bash
set -e

# Script to manually deploy the backend to a VPS
# Usage: ./deploy-to-vps.sh user@host [port] [directory]

# Default values
SSH_PORT=22
DEPLOY_DIR="/yash-code/Trades"
IMAGE_NAME="trading-app-backend"
CONTAINER_NAME="trading-backend-2"
TAG="latest"

# Check if at least host argument is provided
if [ $# -lt 1 ]; then
    echo "Usage: $0 [user@host] [port] [directory]"
    echo "Example: $0 user@example.com 22 /yash-code/Trades"
    exit 1
fi

# Parse arguments
SSH_HOST=$1
[ $# -ge 2 ] && SSH_PORT=$2
[ $# -ge 3 ] && DEPLOY_DIR=$3

# Display deployment info
echo "Deploying to:"
echo "  Host: $SSH_HOST"
echo "  Port: $SSH_PORT"
echo "  Directory: $DEPLOY_DIR"
echo

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if Docker is installed
if ! command_exists docker; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Change to backend directory
cd "$(dirname "$0")/.." || exit 1

# Build the Docker image
echo "🔨 Building Docker image..."
docker build -t $IMAGE_NAME:$TAG .

# Prompt for Docker Hub upload
read -p "Do you want to push the image to Docker Hub? (y/n): " PUSH_TO_DOCKER_HUB
if [[ $PUSH_TO_DOCKER_HUB =~ ^[Yy]$ ]]; then
    # Ask for Docker Hub username
    read -p "Enter your Docker Hub username: " DOCKER_USERNAME
    
    # Tag the image for Docker Hub
    DOCKER_HUB_IMAGE="$DOCKER_USERNAME/$IMAGE_NAME:$TAG"
    docker tag $IMAGE_NAME:$TAG $DOCKER_HUB_IMAGE
    
    # Push to Docker Hub
    echo "🚀 Pushing image to Docker Hub as $DOCKER_HUB_IMAGE..."
    docker push $DOCKER_HUB_IMAGE
    
    # Use this image for deployment
    REMOTE_IMAGE_NAME=$DOCKER_HUB_IMAGE
    DEPLOYMENT_METHOD="docker-hub"
else
    # Save image to tar file
    echo "📦 Saving Docker image to tar file..."
    docker save $IMAGE_NAME:$TAG > ${IMAGE_NAME}.tar
    
    # Use local image for deployment
    REMOTE_IMAGE_NAME=$IMAGE_NAME:$TAG
    DEPLOYMENT_METHOD="tar-file"
fi

# Transfer files to VPS
echo "🚢 Transferring files to $SSH_HOST..."
ssh -p $SSH_PORT $SSH_HOST "mkdir -p $DEPLOY_DIR"

# Copy .env file if it exists
if [ -f ".env" ]; then
    echo "📄 Copying .env file..."
    scp -P $SSH_PORT .env $SSH_HOST:$DEPLOY_DIR/.env
else
    echo "⚠️ No .env file found. Make sure environment variables are set on the remote server."
fi

# Handle deployment based on method
if [ "$DEPLOYMENT_METHOD" = "tar-file" ]; then
    echo "📤 Copying Docker image to server..."
    scp -P $SSH_PORT ${IMAGE_NAME}.tar $SSH_HOST:$DEPLOY_DIR/
    
    # Load the image on the remote server
    ssh -p $SSH_PORT $SSH_HOST "cd $DEPLOY_DIR && docker load < ${IMAGE_NAME}.tar && rm ${IMAGE_NAME}.tar"
else
    # Pull the image on the remote server
    echo "📥 Pulling Docker image on server..."
    ssh -p $SSH_PORT $SSH_HOST "docker pull $REMOTE_IMAGE_NAME"
fi

# Create deployment script
cat > deploy-remote.sh << EOL
#!/bin/bash
set -e

cd $DEPLOY_DIR

# Create Docker network if not exists
if ! docker network inspect trading-network >/dev/null 2>&1; then
  echo "🌐 Creating Docker network: trading-network"
  docker network create trading-network
fi

# Stop and remove existing container if it exists
if docker ps -a | grep -q $CONTAINER_NAME; then
  echo "🛑 Stopping and removing existing container..."
  docker stop $CONTAINER_NAME || true
  docker rm $CONTAINER_NAME || true
fi

# Run the new container
echo "🚀 Starting new container..."
docker run -d \\
  --name $CONTAINER_NAME \\
  --restart unless-stopped \\
  -p 3001:3001 \\
  --network trading-network \\
  --env-file .env \\
  $REMOTE_IMAGE_NAME

# Verify container is running
docker ps | grep $CONTAINER_NAME
echo "✅ Deployment complete!"
EOL

# Transfer and execute deployment script
chmod +x deploy-remote.sh
scp -P $SSH_PORT deploy-remote.sh $SSH_HOST:/tmp/deploy-remote.sh
ssh -p $SSH_PORT $SSH_HOST "bash /tmp/deploy-remote.sh && rm /tmp/deploy-remote.sh"

# Clean up
if [ "$DEPLOYMENT_METHOD" = "tar-file" ]; then
    rm ${IMAGE_NAME}.tar
fi
rm deploy-remote.sh

echo "✅ Deployment completed successfully!"
echo -e "${YELLOW}To verify deployment:${NC}"
echo -e "1. SSH into your server: ssh -p $SSH_PORT $SSH_HOST"
echo -e "2. Check if container is running: docker ps | grep trading-backend"
echo -e "3. Check the logs: docker logs trading-backend"
echo -e "4. Test the health endpoint: curl http://localhost:3001/health" 
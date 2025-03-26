#!/bin/bash

# Update system packages
echo "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Redis
echo "Installing Redis..."
sudo apt-get install -y redis-server

# Configure Redis
echo "Configuring Redis..."
sudo sed -i 's/supervised no/supervised systemd/' /etc/redis/redis.conf
sudo sed -i 's/# maxmemory <bytes>/maxmemory 512mb/' /etc/redis/redis.conf
sudo sed -i 's/# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
sudo sed -i 's/protected-mode yes/protected-mode no/' /etc/redis/redis.conf

# Start Redis service
echo "Starting Redis service..."
sudo systemctl enable redis-server
sudo systemctl restart redis-server

# Check Redis status
echo "Checking Redis status..."
sudo systemctl status redis-server

# Test Redis connection
echo "Testing Redis connection..."
redis-cli ping

echo "Redis setup completed!" 
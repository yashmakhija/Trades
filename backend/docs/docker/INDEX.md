# Docker Documentation

## Overview

This directory contains comprehensive documentation for setting up and working with Docker in the Trading App environment.

## Documents

- [README.md](./README.md) - General overview of Docker setup and workflow
- [SETUP-WORKFLOW.md](./SETUP-WORKFLOW.md) - Detailed steps taken to set up the Docker configuration
- [DATABASE-SETUP.md](./DATABASE-SETUP.md) - Guide for TimescaleDB integration and initialization
- [DATA-PERSISTENCE.md](./DATA-PERSISTENCE.md) - Guide for ensuring data persistence across rebuilds
- [DATA-PERSISTENCE-FIX.md](./DATA-PERSISTENCE-FIX.md) - Step-by-step guide to fix data persistence issues
- [MANUAL-DEPLOY.md](./MANUAL-DEPLOY.md) - Guide for manually deploying to a VPS
- [CICD-SETUP.md](./CICD-SETUP.md) - CI/CD setup guide for automated deployments

## Docker Configuration

- [Dockerfile](../../Dockerfile) - Multi-stage Dockerfile for the backend service
- [docker-compose.yml](../../docker-compose.yml) - Compose configuration for local development

## Database Setup

- [TimescaleDB Configuration](./DATABASE-SETUP.md#key-components)
- [Database Initialization](./DATABASE-SETUP.md#initialization-process)
- [Backup and Restore](./DATABASE-SETUP.md#backup-and-restore)
- [Troubleshooting](./DATABASE-SETUP.md#common-issues-and-troubleshooting)

## Data Persistence

- [Persistence Strategy](./DATA-PERSISTENCE.md#persistence-strategy)
- [Safe Rebuild Process](./DATA-PERSISTENCE.md#safe-rebuild-process)
- [Backup and Restore](./DATA-PERSISTENCE.md#backup-and-restore)
- [Volume Management](./DATA-PERSISTENCE.md#volume-management)
- [**Fix Data Loss Issues**](./DATA-PERSISTENCE-FIX.md) - Solutions for persistent volume problems

## Manual Deployment

- [Deployment Script Usage](./MANUAL-DEPLOY.md#usage)
- [VPS Preparation](./MANUAL-DEPLOY.md#vps-preparation)
- [Verification Steps](./MANUAL-DEPLOY.md#verifying-deployment)
- [Troubleshooting](./MANUAL-DEPLOY.md#troubleshooting)

## CI/CD Setup

- [GitHub Actions Configuration](./CICD-SETUP.md#github-actions-configuration)
- [Required Secrets](./CICD-SETUP.md#required-secrets)
- [Workflow Process](./CICD-SETUP.md#workflow-process)

## Quick Links

### Setup

- [Dockerfile Overview](./README.md#dockerfile)
- [Docker Compose Configuration](./README.md#docker-compose-configuration)
- [Core Features](./README.md#core-features)

### Commands

- [Basic Operations](./README.md#basic-operations)
- [Troubleshooting Commands](./README.md#troubleshooting)

### Workflow

- [Development Workflow](./README.md#development-workflow)
- [Production Deployment](./README.md#production-deployment)
- [Database Schema Migration](./README.md#database-schema-migration)

### CI/CD

- [Workflow Overview](./CICD-SETUP.md#workflow-overview)
- [Required GitHub Secrets](./CICD-SETUP.md#required-github-secrets)
- [VPS Preparation](./CICD-SETUP.md#vps-preparation)
- [Troubleshooting](./CICD-SETUP.md#troubleshooting)

### Manual Deployment

- [Deployment Script Usage](./MANUAL-DEPLOY.md#usage)
- [VPS Preparation](./MANUAL-DEPLOY.md#vps-preparation)
- [Verification Steps](./MANUAL-DEPLOY.md#verifying-deployment)
- [Troubleshooting](./MANUAL-DEPLOY.md#troubleshooting)

### Help

- [Common Issues](./README.md#common-issues)
- [Best Practices](./README.md#best-practices)
- [Step-by-Step Setup Guide](./SETUP-WORKFLOW.md)
- [Data Persistence Fixes](./DATA-PERSISTENCE-FIX.md)

## Directory Structure

```
docs/docker/
├── INDEX.md                # This file - Overview and navigation
├── README.md               # General Docker setup and commands
├── SETUP-WORKFLOW.md       # Detailed setup process
├── DATABASE-SETUP.md       # TimescaleDB setup guide
├── DATA-PERSISTENCE.md     # Data persistence guide
├── DATA-PERSISTENCE-FIX.md # Solutions for data persistence issues
├── CICD-SETUP.md           # CI/CD configuration for automated deployment
└── MANUAL-DEPLOY.md        # Manual deployment guide
```

## Getting Started

If you're new to this project's Docker setup, we recommend reading the documentation in this order:

1. Start with [SETUP-WORKFLOW.md](./SETUP-WORKFLOW.md) to understand the environment
2. Review [README.md](./README.md) for general usage and commands
3. For database setup, see [DATABASE-SETUP.md](./DATABASE-SETUP.md)
4. Learn about data persistence with [DATA-PERSISTENCE.md](./DATA-PERSISTENCE.md)
5. If experiencing data loss, see [DATA-PERSISTENCE-FIX.md](./DATA-PERSISTENCE-FIX.md)
6. If you're setting up CI/CD, refer to [CICD-SETUP.md](./CICD-SETUP.md)
7. For manual deployment, see [MANUAL-DEPLOY.md](./MANUAL-DEPLOY.md)
8. Refer to specific sections as needed during development

## Contributing to Documentation

When updating this documentation, please:

1. Keep information accurate and up-to-date
2. Follow the existing structure and formatting
3. Add cross-references between related sections
4. Include practical examples and code snippets

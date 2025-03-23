# Docker Documentation

Welcome to the Docker documentation for the Trading App. This directory contains comprehensive guides for setting up, operating, and troubleshooting the Docker environment.

## Available Documentation

- [README.md](./README.md) - General Docker setup and commands
- [SETUP-WORKFLOW.md](./SETUP-WORKFLOW.md) - Detailed steps to set up and fix the Docker environment
- [CICD-SETUP.md](./CICD-SETUP.md) - CI/CD configuration for automated Docker deployment
- [MANUAL-DEPLOY.md](./MANUAL-DEPLOY.md) - Guide for manually deploying to a VPS

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

## Directory Structure

```
docs/docker/
├── INDEX.md                # This file - Overview and navigation
├── README.md               # General Docker setup and commands
├── SETUP-WORKFLOW.md       # Detailed setup process
├── CICD-SETUP.md           # CI/CD configuration for automated deployment
└── MANUAL-DEPLOY.md        # Manual deployment guide
```

## Getting Started

If you're new to this project's Docker setup, we recommend reading the documentation in this order:

1. Start with [SETUP-WORKFLOW.md](./SETUP-WORKFLOW.md) to understand the environment
2. Review [README.md](./README.md) for general usage and commands
3. If you're setting up CI/CD, refer to [CICD-SETUP.md](./CICD-SETUP.md)
4. For manual deployment, see [MANUAL-DEPLOY.md](./MANUAL-DEPLOY.md)
5. Refer to specific sections as needed during development

## Contributing to Documentation

When updating this documentation, please:

1. Keep information accurate and up-to-date
2. Follow the existing structure and formatting
3. Add cross-references between related sections
4. Include practical examples and code snippets

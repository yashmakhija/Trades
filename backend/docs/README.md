# Trading App Backend Documentation

Welcome to the documentation for the Trading App Backend. This documentation provides comprehensive information about the backend architecture, API endpoints, features, and setup instructions.

## Documentation Structure

- [**API Documentation**](./api/README.md): Comprehensive documentation of the REST API endpoints and WebSocket API.
- [**Docker**](./docker/INDEX.md): Detailed documentation of Docker setup, workflow, and best practices.
- [**Features**](./features/): Documentation of specific features:
  - [Candle Data System](./features/candle-data.md): Documentation of the candle data management system.
  - [Order Matching System](./features/order-matching.md): Detailed explanation of how orders are processed, matched, and executed.
- [**TimescaleDB**](./timescaledb/README.md): Documentation of the TimescaleDB implementation.

## Quick Links

- [API Endpoints](./api/README.md#api-endpoints)
- [WebSocket API](./api/README.md#websocket-api)
- [Docker Setup](./docker/README.md)
- [Docker Workflow](./docker/SETUP-WORKFLOW.md)
- [TimescaleDB Setup](./timescaledb/TIMESCALEDB-SETUP.md)
- [Candle Data Management](./features/candle-data.md)
- [Order Matching System](./features/order-matching.md)

## Getting Started

For setup instructions and getting started with the backend, please refer to the main [README.md](../README.md) file in the root directory.

For Docker-specific setup and workflows, see the [Docker Documentation](./docker/INDEX.md).

## Contributing

If you'd like to contribute to the documentation, please follow these guidelines:

1. Place API documentation in the `docs/api` directory.
2. Place Docker-related documentation in the `docs/docker` directory.
3. Place feature-specific documentation in the `docs/features` directory.
4. Place database-related documentation in the appropriate database directory (e.g., `docs/timescaledb`).
5. Use Markdown for all documentation files.
6. Include code examples where appropriate.
7. Keep documentation up-to-date with code changes.

## License

This documentation is licensed under the MIT License. See the [LICENSE](../LICENSE) file for details.

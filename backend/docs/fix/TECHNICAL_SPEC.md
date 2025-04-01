# FIX Protocol Technical Specification

## Architecture Overview

### System Components

1. FIX Engine Layer

   - QuickFIX/n Implementation
   - Message Handlers
   - Session Management
   - Connection Pool

2. Business Logic Layer

   - Order Management
   - Market Data Processing
   - Position Management
   - Risk Controls

3. Data Layer
   - Database Integration
   - Caching Layer
   - Message Queue
   - Logging System

## Message Types

### Market Data Messages

1. Level 1 Data

   - Quote Request (35=Y)
   - Quote Response (35=W)
   - Market Data Request (35=V)
   - Market Data Snapshot (35=W)

2. Level 2 Data
   - Market Data Request (35=V)
   - Market Data Incremental Refresh (35=X)
   - Market Data Request Reject (35=Y)

### Trading Messages

1. Order Management

   - New Order Single (35=D)
   - Order Cancel Request (35=F)
   - Order Cancel Replace Request (35=G)
   - Order Status Request (35=H)

2. Execution Reports
   - Execution Report (35=8)
   - Order Cancel Reject (35=9)
   - Order Status Report (35=H)

## Database Schema Updates

### New Tables

1. fix_sessions

   ```sql
   CREATE TABLE fix_sessions (
     id SERIAL PRIMARY KEY,
     sender_comp_id VARCHAR(50),
     target_comp_id VARCHAR(50),
     session_type VARCHAR(20),
     status VARCHAR(20),
     last_sequence_number INTEGER,
     created_at TIMESTAMP,
     updated_at TIMESTAMP
   );
   ```

2. fix_messages

   ```sql
   CREATE TABLE fix_messages (
     id SERIAL PRIMARY KEY,
     session_id INTEGER REFERENCES fix_sessions(id),
     message_type VARCHAR(10),
     sequence_number INTEGER,
     message_content TEXT,
     status VARCHAR(20),
     created_at TIMESTAMP
   );
   ```

3. fix_orders
   ```sql
   CREATE TABLE fix_orders (
     id SERIAL PRIMARY KEY,
     cl_ord_id VARCHAR(50),
     fix_order_id VARCHAR(50),
     symbol VARCHAR(20),
     side VARCHAR(10),
     order_type VARCHAR(20),
     price DECIMAL,
     quantity DECIMAL,
     status VARCHAR(20),
     created_at TIMESTAMP,
     updated_at TIMESTAMP
   );
   ```

## API Changes

### New Endpoints

1. FIX Session Management

   ```typescript
   POST /api/fix/sessions
   GET /api/fix/sessions
   PUT /api/fix/sessions/:id
   DELETE /api/fix/sessions/:id
   ```

2. FIX Message Monitoring

   ```typescript
   GET /api/fix/messages
   GET /api/fix/messages/:id
   POST /api/fix/messages/resend
   ```

3. FIX Order Management
   ```typescript
   POST /api/fix/orders
   GET /api/fix/orders
   PUT /api/fix/orders/:id
   DELETE /api/fix/orders/:id
   ```

## Configuration

### QuickFIX/n Settings

```ini
[DEFAULT]
ConnectionType=initiator
ReconnectInterval=60
FileStorePath=./store
FileLogPath=./log
StartTime=00:00:00
EndTime=23:59:59
UseDataDictionary=Y
DataDictionary=FIX44.xml
ValidateUserDefinedFields=N
ValidateIncomingMessage=N

[SESSION]
BeginString=FIX.4.4
SenderCompID=xyz
TargetCompID=xyz
HeartBtInt=30
SocketConnectHost=cntuk.centroidsol.com
SocketConnectPort=43510
```

## Error Handling

### FIX Session Errors

1. Connection Errors

   - Network Issues
   - Authentication Failures
   - Session Timeouts

2. Message Errors
   - Invalid Message Format
   - Sequence Number Issues
   - Business Rejections

### Recovery Procedures

1. Session Recovery

   - Sequence Number Reset
   - Message Resend
   - Session Reset

2. Message Recovery
   - Gap Fill
   - Message Resend
   - State Recovery

## Monitoring

### Metrics

1. Connection Metrics

   - Session Status
   - Connection Latency
   - Reconnection Count

2. Message Metrics

   - Message Rate
   - Error Rate
   - Latency Distribution

3. Business Metrics
   - Order Success Rate
   - Execution Time
   - Error Types

### Logging

1. Session Logs

   - Connection Events
   - Session State Changes
   - Error Events

2. Message Logs
   - Incoming Messages
   - Outgoing Messages
   - Error Messages

## Testing Strategy

### Test Types

1. Unit Tests

   - Message Parsing
   - Business Logic
   - Error Handling

2. Integration Tests

   - Session Management
   - Order Flow
   - Market Data Flow

3. Performance Tests
   - Message Throughput
   - Latency
   - Resource Usage

### Test Environment

1. Development

   - Local FIX Simulator
   - Test Database
   - Mock Services

2. Staging
   - Production-like Environment
   - Test Data
   - Monitoring Tools

## Deployment

### Infrastructure

1. Servers

   - FIX Engine Server
   - Application Server
   - Database Server

2. Network
   - Load Balancer
   - Firewall
   - VPN

### Deployment Process

1. Pre-deployment

   - Backup
   - Configuration Review
   - Health Check

2. Deployment

   - Database Migration
   - Application Update
   - Configuration Update

3. Post-deployment
   - Verification
   - Monitoring
   - Rollback Plan

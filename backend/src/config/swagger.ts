import swaggerJsdoc from "swagger-jsdoc";
import { config } from "./index";

/**
 * Swagger configuration options
 */
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Trading App API",
      version: "1.0.0",
      description: "API documentation for the Trading App",
      contact: {
        name: "API Support",
        email: "support@tradingapp.com",
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: "Development server",
      },
    ],
    components: {
      schemas: {
        Symbol: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Symbol unique identifier",
            },
            name: {
              type: "string",
              description: "Symbol name (e.g., btcusdt)",
            },
            description: {
              type: "string",
              description: "Symbol description",
            },
            currentPrice: {
              type: "number",
              description: "Current price in USD",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Creation timestamp",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Last update timestamp",
            },
          },
        },
        Order: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Order unique identifier",
            },
            userId: {
              type: "string",
              description: "User who placed the order",
            },
            symbolId: {
              type: "string",
              description: "Symbol being traded",
            },
            price: {
              type: "number",
              description: "Order price",
            },
            quantity: {
              type: "number",
              description: "Order quantity",
            },
            type: {
              type: "string",
              enum: ["BUY", "SELL"],
              description: "Order type",
            },
            isShort: {
              type: "boolean",
              description: "Whether this is a short order",
            },
            stopLoss: {
              type: "number",
              nullable: true,
              description: "Stop loss price",
            },
            takeProfit: {
              type: "number",
              nullable: true,
              description: "Take profit price",
            },
            status: {
              type: "string",
              enum: ["OPEN", "CLOSED", "CANCELLED"],
              description: "Order status",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Creation timestamp",
            },
          },
        },
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "User unique identifier",
            },
            email: {
              type: "string",
              description: "User email",
            },
            name: {
              type: "string",
              nullable: true,
              description: "User name",
            },
            usdcBalance: {
              type: "number",
              description: "User USDC balance",
            },
          },
        },
      },
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts", "./src/types/*.ts"],
};

/**
 * Generate Swagger specification
 */
export const swaggerSpec = swaggerJsdoc(swaggerOptions); 
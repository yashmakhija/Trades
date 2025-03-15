import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import { config } from "./index";

// Load the Swagger YAML file
const swaggerDocument = YAML.load(path.join(__dirname, "swagger.yaml"));

// Export the Swagger UI setup
export const swaggerUiSetup = swaggerUi.setup(swaggerDocument);

// Export the Swagger specification for JSON endpoint
export const swaggerSpec = swaggerDocument;

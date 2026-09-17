const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Product Review Platform API",
      version: "1.0.0",
      description: "API for creating products, writing reviews, and uploading purchase evidence with automated verification.",
      contact: { name: "API Support" },
    },
    servers: [
      { url: "http://localhost:3000", description: "Development" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token from login endpoint",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            role: { type: "string", nullable: true },
            created_at: { type: "string", format: "date-time" },
          },
        },
        Product: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            user_id: { type: "string", format: "uuid" },
            name: { type: "string" },
            description: { type: "string", nullable: true },
            image_url: { type: "string", nullable: true },
            category: { type: "string", nullable: true },
            evidence_id: { type: "string", format: "uuid", nullable: true },
            evidence_score: { type: "integer", nullable: true },
            verification_status: { type: "string", nullable: true },
            avg_rating: { type: "number" },
            review_count: { type: "integer" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
            verification: { "$ref": "#/components/schemas/PublicVerification" },
          },
        },
        Review: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            user_id: { type: "string", format: "uuid" },
            product_id: { type: "string", format: "uuid" },
            status: { type: "string", enum: ["PUBLISHED", "REMOVED"] },
            duration_used: { type: "string", enum: ["a few days", "a few weeks", "a few months", "a year", "more than a year"] },
            review_text: { type: "string" },
            build_integrity: { type: "integer", minimum: 1, maximum: 10 },
            longevity: { type: "integer", minimum: 1, maximum: 10 },
            value_ratio: { type: "integer", minimum: 1, maximum: 10 },
            recommendation: { type: "string", enum: ["buy", "pass", "consider"] },
            goods: { type: "array", items: { type: "string" } },
            tradeoffs: { type: "array", items: { type: "string" } },
            evidence_id: { type: "string", format: "uuid", nullable: true },
            verification: { "$ref": "#/components/schemas/PublicVerification" },
            owner: { "$ref": "#/components/schemas/ReviewOwner" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        PublicVerification: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["NO_EVIDENCE", "STRONG_EVIDENCE", "GOOD_EVIDENCE", "WEAK_EVIDENCE", "SUSPICIOUS"] },
            hasEvidence: { type: "boolean" },
            badge: { type: "string", enum: ["PURCHASE_EVIDENCE", "null"], nullable: true },
          },
        },
        ReviewOwner: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            role: { type: "string", nullable: true },
          },
        },
        EvidenceUploadResponse: {
          type: "object",
          properties: {
            verification: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                status: { type: "string" },
                hasEvidence: { type: "boolean" },
                badge: { type: "string", nullable: true },
              },
            },
            receipt: { "$ref": "#/components/schemas/ReceiptData" },
            productMatch: { "$ref": "#/components/schemas/ProductMatch" },
          },
        },
        ReceiptData: {
          type: "object",
          properties: {
            documentType: { type: "string" },
            merchant: { type: "object", properties: { name: { type: "string" }, address: { type: "string" } } },
            purchaseDate: { type: "string", nullable: true },
            items: { type: "array", items: { "$ref": "#/components/schemas/ReceiptItem" } },
            total: { type: "number", nullable: true },
          },
        },
        ReceiptItem: {
          type: "object",
          properties: {
            name: { type: "string" },
            price: { type: "number" },
            quantity: { type: "integer" },
          },
        },
        ProductMatch: {
          type: "object",
          properties: {
            matched: { type: "boolean" },
            confidence: { type: "string" },
          },
        },
        EvidenceDetails: {
          type: "object",
          properties: {
            status: { type: "string" },
            badge: { type: "string", nullable: true },
            checks: { type: "array", items: { "$ref": "#/components/schemas/EvidenceCheck" } },
            disclaimer: { type: "string" },
          },
        },
        EvidenceCheck: {
          type: "object",
          properties: {
            code: { type: "string" },
            label: { type: "string" },
            passed: { type: "boolean" },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;

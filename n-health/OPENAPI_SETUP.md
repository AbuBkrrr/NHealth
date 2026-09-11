# 📖 OpenAPI/Swagger Documentation Setup

This guide shows how to add machine-readable API documentation to N-Health backend.

---

## Overview

OpenAPI (Swagger) provides:
- ✅ Interactive API documentation
- ✅ Automatic client code generation
- ✅ Request/response validation
- ✅ Team collaboration (API contracts)
- ✅ Sandbox testing in Swagger UI

---

## Implementation Steps

### 1. Install Dependencies

```bash
cd backend
npm install --save express-openapi-validator swagger-ui-express swagger-jsdoc
npm install --save-dev @types/swagger-ui-express @types/swagger-jsdoc
```

### 2. Create Swagger Configuration

Create `backend/src/config/swagger.ts`:

```typescript
import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'N-Health API',
      version: '1.0.0',
      description: 'Enterprise Healthcare Platform API',
      contact: {
        name: 'N-Health Support',
        email: 'support@nhealth.dev',
        url: 'https://nhealth.dev',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `${env.publicUrl}/api`,
        description: 'Production Server',
      },
      {
        url: 'http://localhost:4000/api',
        description: 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer token from /auth/login',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            role: {
              type: 'string',
              enum: ['PATIENT', 'DOCTOR', 'PHARMACY', 'LAB', 'AMBULANCE', 'NURSE', 'ADMIN'],
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'email', 'name', 'role'],
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: { type: 'object' },
          },
          required: ['error'],
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
```

### 3. Add Swagger to Express App

Update `backend/src/app.ts`:

```typescript
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

export function createApp() {
  const app = express();
  
  // ... existing middleware ...

  // API Documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
      persistAuthorization: true,
      displayOperationId: true,
    },
  }));

  // ... rest of app ...
}
```

### 4. Document Endpoints with JSDoc

Example: Update `backend/src/routes/authRoutes.ts`

```typescript
import { Router } from 'express';
import { register, login, me } from '../controllers/authController';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     description: Create a new account with email, password, and role
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: SecurePass123!
 *               name:
 *                 type: string
 *                 example: John Doe
 *               role:
 *                 type: string
 *                 enum: [PATIENT, DOCTOR, PHARMACY, LAB, AMBULANCE, NURSE]
 *                 example: PATIENT
 *               profile:
 *                 type: object
 *                 description: Role-specific profile data
 *                 example: { dateOfBirth: "1990-01-01" }
 *             required: [email, password, name, role]
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token for authentication
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Email already registered
 */
router.post('/register', asyncHandler(register));

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login user
 *     description: Authenticate with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *             required: [email, password]
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many login attempts
 */
router.post('/login', asyncHandler(login));

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Get current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
router.get('/me', requireAuth, asyncHandler(me));

export default router;
```

### 5. Document Patient Endpoints

Update `backend/src/routes/patientRoutes.ts`:

```typescript
/**
 * @swagger
 * /patient:
 *   get:
 *     tags: [Patient]
 *     summary: Get patient profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Patient profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 userId:
 *                   type: string
 *                 dateOfBirth:
 *                   type: string
 *                   format: date
 *                 bloodType:
 *                   type: string
 *                   enum: [O+, O-, A+, A-, B+, B-, AB+, AB-]
 *                 allergies:
 *                   type: array
 *                   items:
 *                     type: string
 *   patch:
 *     tags: [Patient]
 *     summary: Update patient profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               bloodType:
 *                 type: string
 *               allergies:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Updated patient profile
 *       400:
 *         description: Validation error
 */
```

### 6. Access Documentation

After setup, access at:
- Development: `http://localhost:4000/api-docs`
- Production: `https://your-backend.onrender.com/api-docs`

---

## OpenAPI Features

### Try It Out
- Click "Try it out" on any endpoint
- Fill in parameters
- See real-time responses

### Authentication
- Click lock icon to enter JWT token
- Token applied to all requests
- Persists in browser session

### Schema Export
- Download OpenAPI spec as JSON/YAML
- Use with Postman, Insomnia, etc.
- Generate client libraries

### Code Generation
Online tools:
- [Swagger Codegen](https://editor.swagger.io)
- [OpenAPI Generator](https://openapi-generator.tech)
- VS Code: OpenAPI extension

---

## Full Endpoint Documentation Template

```typescript
/**
 * @swagger
 * /path/{param}:
 *   method:
 *     tags: [Category]
 *     summary: Short description
 *     description: Longer description
 *     operationId: uniqueId
 *     parameters:
 *       - in: path
 *         name: param
 *         required: true
 *         schema:
 *           type: string
 *         description: Parameter description
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *             required: [field]
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *       429:
 *         description: Too many requests
 *       500:
 *         description: Server error
 */
```

---

## Integration with Frontend

### Automatic API Client Generation

```bash
# Generate TypeScript client from OpenAPI spec
npx openapi-generator-cli generate \
  -i http://localhost:4000/api-docs \
  -g typescript-axios \
  -o ./src/generated-api
```

### Using Generated Client

```typescript
// auto-generated client
import { AuthApi } from './generated-api';

const authApi = new AuthApi();

const response = await authApi.login({
  email: 'user@example.com',
  password: 'password',
});
```

---

## Best Practices

- ✅ Document all public endpoints
- ✅ Include request/response examples
- ✅ Document error codes
- ✅ Use consistent schema definitions
- ✅ Keep OpenAPI spec in git
- ✅ Version your API
- ✅ Test generated code

---

## Next Steps

1. Install swagger packages
2. Add swagger.ts config
3. Update app.ts with Swagger UI
4. Document all auth endpoints
5. Document all role endpoints
6. Test at `/api-docs`
7. Generate frontend clients

---

**Status:** Template provided (YOU MUST IMPLEMENT)


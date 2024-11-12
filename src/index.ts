import {GetSearch} from "./endpoints/search";
import {authenticateUser, AuthLogin, AuthRegister} from "./foundation/auth";
import {Hono} from "hono";
import {fromHono} from "chanfana";
import {Env} from "./types";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>()

// Setup OpenAPI registry
const openapi = fromHono(app, {
    schema: {
        info: {
            title: "Authentication using D1",
            version: '1.0',
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    docs_url: "/",
})
openapi.registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
})

// 1. Endpoints that don't require Auth
openapi.post('/api/auth/register', AuthRegister);
openapi.post('/api/auth/login', AuthLogin);


// 2. Authentication middleware
openapi.use('/api/*', authenticateUser)


// 3. Endpoints that require Auth
openapi.get("/api/search", GetSearch);


// 404 for everything else
openapi.all("*", () => new Response("Not Found.", {status: 404}));

// Export the Hono app
export default app

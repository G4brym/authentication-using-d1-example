import {z} from 'zod'
import {ApiException, OpenAPIRoute} from "chanfana";
import {D1QB} from "workers-qb";
import {AppContext, User, UserSession} from "../types";
import {Next} from "hono";


async function hashPassword(password: string, salt: string): Promise<string> {
    const utf8 = new TextEncoder().encode(`${salt}:${password}`);

    const hashBuffer = await crypto.subtle.digest({name: 'SHA-256'}, utf8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray
        .map((bytes) => bytes.toString(16).padStart(2, '0'))
        .join('');
}

export class AuthRegister extends OpenAPIRoute {
    schema = {
        tags: ['Auth'],
        summary: 'Register user',
        request: {
            body: {
                content: {
                    'application/json': {
                        schema: z.object({
                            name: z.string(),
                            email: z.string().email(),
                            password: z.string().min(8).max(16),
                        }),
                    },
                },
            },
        },
        responses: {
            '200': {
                description: "Successful response",
                content: {
                    'application/json': {
                        schema: z.object({
                            success: z.boolean(),
                            result: z.object({
                                user: z.object({
                                    email: z.string(),
                                    name: z.string()
                                })
                            })
                        }),
                    },
                },
            },
            '400': {
                description: "Error",
                content: {
                    'application/json': {
                        schema: z.object({
                            success: z.boolean(),
                            error: z.string()
                        }),
                    },
                },
            },
        },
    };

    async handle(c: AppContext) {

        // Validate inputs
        const data = await this.getValidatedData<typeof this.schema>()

        // Get query builder for D1
        const qb = new D1QB(c.env.DB)

        try {
            // Try to insert a new user
            await qb.insert<{ email: string, name: string, }>({
                tableName: 'users',
                data: {
                    email: data.body.email,
                    name: data.body.name,
                    password: await hashPassword(data.body.password, c.env.SALT_TOKEN),
                },
            }).execute()
        } catch (e) {
            // Insert failed due to unique constraint on the email column
            return Response.json({
                success: false,
                errors: "User with that email already exists"
            }, {
                status: 400,
            })
        }

        // Returning an object, automatically gets converted into a json response
        return {
            success: true,
            result: {
                user: {
                    email: data.body.email,
                    name: data.body.name,
                }
            }
        }
    }
}


export class AuthLogin extends OpenAPIRoute {
    schema = {
        tags: ['Auth'],
        summary: 'Login user',
        request: {
            body: {
                content: {
                    'application/json': {
                        schema: z.object({
                            email: z.string().email(),
                            password: z.string().min(8).max(16),
                        }),
                    },
                },
            },
        },
        responses: {
            '200': {
                description: "Successful response",
                content: {
                    'application/json': {
                        schema: z.object({
                            success: z.boolean(),
                            result: z.object({
                                session: z.object({
                                    token: z.string(),
                                    expires_at: z.number().int()
                                })
                            })
                        }),
                    },
                },
            },
            '400': {
                description: "Error",
                content: {
                    'application/json': {
                        schema: z.object({
                            success: z.boolean(),
                            error: z.string()
                        }),
                    },
                },
            },
        },
    };

    async handle(c: AppContext) {
        // Validate inputs
        const data = await this.getValidatedData<typeof this.schema>()

        // Get query builder for D1
        const qb = new D1QB(c.env.DB)

        // Try to fetch the user
        const user = await qb.fetchOne<User>({
            tableName: 'users',
            fields: '*',
            where: {
                conditions: [
                    'email = ?1',
                    'password = ?2'
                ],
                params: [
                    data.body.email,
                    await hashPassword(data.body.password, c.env.SALT_TOKEN)
                ]
            },
        }).execute()

        // User not found, provably wrong password
        if (!user.results) {
            return Response.json({
                success: false,
                errors: "Unknown user"
            }, {
                status: 400,
            })
        }

        // User found, define expiration date for new session token
        let expiration = new Date();
        expiration.setDate(expiration.getDate() + 7);

        // Insert session token
        const session = await qb.insert<UserSession>({
            tableName: 'users_sessions',
            data: {
                user_id: user.results.id,
                token: await hashPassword((Math.random() + 1).toString(3), c.env.SALT_TOKEN),
                expires_at: expiration.getTime()
            },
            returning: '*'
        }).execute()

        if (!session.results) {
            throw new ApiException('Unable to create user session')
        }

        // Returning an object, automatically gets converted into a json response
        return {
            success: true,
            result: {
                session: {
                    token: session.results.token,
                    expires_at: session.results.expires_at,
                }
            }
        }
    }
}


export function getBearer(request: Request): null | string {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || authHeader.substring(0, 6) !== 'Bearer') {
        return null
    }
    return authHeader.substring(6).trim()
}


export async function authenticateUser(c: AppContext, next: Next) {
    const token = getBearer(c.req.raw)

    if (!token) {
        return Response.json({
            success: false,
            errors: "No Authorization token received"
        }, {
            status: 401,
        })
    }

    // Get query builder for D1
    const qb = new D1QB(c.env.DB)

    const session = await qb.fetchOne<UserSession>({
        tableName: 'users_sessions',
        fields: '*',
        where: {
            conditions: [
                'token = ?1',
                'expires_at > ?2',
            ],
            params: [
                token,
                new Date().getTime()
            ]
        },
    }).execute()

    if (!session.results) {
        return Response.json({
            success: false,
            errors: "Authentication error"
        }, {
            status: 401,
        })
    }

    // This will be accessible from the endpoints as c.get('user_id')
    c.set('user_id', session.results.user_id)

    await next()
}

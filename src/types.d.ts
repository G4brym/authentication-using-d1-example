import {D1Database} from '@cloudflare/workers-types'
import {Context} from "hono";

export type Env = {
    DB: D1Database
    SALT_TOKEN: string
}

export type Vars = {
    user_id?: number
}

export type AppContext = Context<{ Bindings: Env, Variables: Vars }>

export type User = {
    id: number
    email: string
    password: string
    name: string
}

export type UserSession = {
    session_id: number
    user_id: number
    token: string
    expires_at: string
}

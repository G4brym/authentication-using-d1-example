import {D1Database} from '@cloudflare/workers-types'

export type Bindings = {
    DB: D1Database
    SALT_TOKEN: string
    user_uuid?: string
}

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

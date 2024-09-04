# Example code for implementing Register and Login in Cloudflare Workers using D1

This is the example code for the article `Implementing Register and Login in Cloudflare Workers with D1`
that you can [read here](https://massadas.com/posts/implementing-register-and-login-in-workers-d1/).

Technologies used:
- [hono](https://github.com/honojs/hono) for routing
- [chanfana](https://github.com/cloudflare/chanfana) for OpenAPI generation and validation
- [workers-qb](https://github.com/G4brym/workers-qb) for querying D1

## Getting started with this project

Install the dependencies

```bash
npm install
```

Create a new D1 database

```bash
wrangler d1 create <db-name>  --experimental-backend
```

Copy the `database_id` and place it in the `wrangler.toml` file

```toml
[[d1_databases]]
binding = "DB"
database_name = "<your-db-name>"
database_id = "<your-db-id>"
```

Apply initial migrations, that include the `users` and `users_sessions` tables

```bash
# Remote development
wrangler d1 migrations apply DB

# Local development
wrangler d1 migrations apply DB --local
```

Start the project

```bash
npm run serve
```

Now open your browser at [http://localhost:8787/](http://localhost:8787/)


## Images

Swagger interface
![Swagger interface](https://github.com/G4brym/authentication-using-d1-example/raw/main/docs/swagger.png)

Unauthenticated
![Unauthenticated](https://github.com/G4brym/authentication-using-d1-example/raw/main/docs/unauthenticated.png)

Authentication
![Authentication](https://github.com/G4brym/authentication-using-d1-example/raw/main/docs/authentication.png)

Endpoint results
![Endpoint results](https://github.com/G4brym/authentication-using-d1-example/raw/main/docs/results.png)

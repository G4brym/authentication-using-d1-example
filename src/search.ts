import {z} from "zod";
import {OpenAPIRoute} from "chanfana";

export class GetSearch extends OpenAPIRoute {
    schema = {
        tags: ["Search"],
        summary: "Search repositories by a query parameter",
        request: {
            query: z.object({
                q: z.string().default('cloudflare workers').openapi({
                    description: "The query to search for"
                })
            })
        },
        responses: {
            "200": {
                description: "Successful response",
                schema: {
                    repos: [
                        {
                            "name": "chanfana",
                            "description": "OpenAPI 3 and 3.1 schema generator and validator for Hono, itty-router and more!",
                            "stars": 287,
                            "url": "https://github.com/cloudflare/chanfana"
                        },
                    ],
                },
            },
            "401": {
                description: "Not authenticated",
                schema: {
                    "success": false,
                    "errors": "Authentication error"
                },
            },
        },
    };

    async handle(c) {
        // Validate inputs
        const data = await this.getValidatedData<typeof this.schema>()

        const url = `https://api.github.com/search/repositories?q=${data.query.q}`;

        const resp = await fetch(url, {
            headers: {
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "RepoAI - Cloudflare Workers ChatGPT Plugin Example",
            },
        });

        if (!resp.ok) {
            return new Response(await resp.text(), {status: 400});
        }

        const json = await resp.json();

        // @ts-ignore
        const repos = json.items.map((item: any) => ({
            name: item.name,
            description: item.description,
            stars: item.stargazers_count,
            url: item.html_url,
        }));

        // Returning an object, automatically gets converted into a json response
        return {
            repos: repos,
        };
    }
}

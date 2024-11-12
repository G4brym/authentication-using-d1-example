import {z} from "zod";
import {OpenAPIRoute} from "chanfana";
import {AppContext} from "../types";

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
                content: {
                    'application/json': {
                        schema: z.object({
                            success: z.boolean(),
                            result: z.object({
                                name: z.string(),
                                description: z.string(),
                                stars: z.number().int(),
                                url: z.string()
                            }).array()
                        }),
                    },
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

    async handle(c: AppContext) {
        // Validate inputs
        const data = await this.getValidatedData<typeof this.schema>()

        const resp = await fetch(`https://api.github.com/search/repositories?q=${data.query.q}`, {
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
            success: true,
            result: repos,
        };
    }
}

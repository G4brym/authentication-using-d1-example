import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

describe("Authentication API", () => {
	beforeAll(async () => {
		// Set up the database tables
		await env.DB.batch([
			env.DB.prepare(`
				CREATE TABLE IF NOT EXISTS users (
					id       integer primary key autoincrement,
					email    text not null unique,
					password text not null,
					name     text not null
				)
			`),
			env.DB.prepare(`
				CREATE TABLE IF NOT EXISTS users_sessions (
					session_id integer primary key autoincrement,
					user_id    integer not null
						references users
						on update cascade on delete cascade,
					token      text not null,
					expires_at integer not null
				)
			`),
		]);
	});

	describe("POST /api/auth/register", () => {
		it("should register a new user successfully", async () => {
			const response = await SELF.fetch("http://localhost/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Test User",
					email: "test@example.com",
					password: "password123",
				}),
			});

			expect(response.status).toBe(200);
			const data = await response.json() as { success: boolean; result: { user: { email: string; name: string } } };
			expect(data.success).toBe(true);
			expect(data.result.user.email).toBe("test@example.com");
			expect(data.result.user.name).toBe("Test User");
		});

		it("should reject duplicate email registration", async () => {
			// First registration
			await SELF.fetch("http://localhost/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "User One",
					email: "duplicate@example.com",
					password: "password123",
				}),
			});

			// Second registration with same email
			const response = await SELF.fetch("http://localhost/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "User Two",
					email: "duplicate@example.com",
					password: "password456",
				}),
			});

			expect(response.status).toBe(400);
			const data = await response.json() as { success: boolean; errors: string };
			expect(data.success).toBe(false);
		});

		it("should reject password shorter than 8 characters", async () => {
			const response = await SELF.fetch("http://localhost/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Short Pass User",
					email: "shortpass@example.com",
					password: "short",
				}),
			});

			expect(response.status).toBe(400);
		});

		it("should reject invalid email format", async () => {
			const response = await SELF.fetch("http://localhost/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Invalid Email User",
					email: "not-an-email",
					password: "password123",
				}),
			});

			expect(response.status).toBe(400);
		});
	});

	describe("POST /api/auth/login", () => {
		beforeAll(async () => {
			// Create a user for login tests
			await SELF.fetch("http://localhost/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Login Test User",
					email: "login@example.com",
					password: "password123",
				}),
			});
		});

		it("should login successfully with correct credentials", async () => {
			const response = await SELF.fetch("http://localhost/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: "login@example.com",
					password: "password123",
				}),
			});

			expect(response.status).toBe(200);
			const data = await response.json() as { success: boolean; result: { session: { token: string; expires_at: number } } };
			expect(data.success).toBe(true);
			expect(data.result.session.token).toBeDefined();
			expect(data.result.session.expires_at).toBeDefined();
		});

		it("should reject login with wrong password", async () => {
			const response = await SELF.fetch("http://localhost/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: "login@example.com",
					password: "wrongpassword",
				}),
			});

			expect(response.status).toBe(400);
			const data = await response.json() as { success: boolean; errors: string };
			expect(data.success).toBe(false);
		});

		it("should reject login with non-existent email", async () => {
			const response = await SELF.fetch("http://localhost/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: "nonexistent@example.com",
					password: "password123",
				}),
			});

			expect(response.status).toBe(400);
			const data = await response.json() as { success: boolean; errors: string };
			expect(data.success).toBe(false);
		});
	});

	describe("Authentication Middleware", () => {
		it("should reject requests without Authorization header", async () => {
			const response = await SELF.fetch("http://localhost/api/search");

			expect(response.status).toBe(401);
			const data = await response.json() as { success: boolean; errors: string };
			expect(data.success).toBe(false);
			expect(data.errors).toBe("No Authorization token received");
		});

		it("should reject requests with invalid token", async () => {
			const response = await SELF.fetch("http://localhost/api/search", {
				headers: { Authorization: "Bearer invalid-token-12345" },
			});

			expect(response.status).toBe(401);
			const data = await response.json() as { success: boolean; errors: string };
			expect(data.success).toBe(false);
			expect(data.errors).toBe("Authentication error");
		});

		it("should accept requests with valid token", async () => {
			// First register and login to get a valid token
			await SELF.fetch("http://localhost/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Auth Test User",
					email: "authtest@example.com",
					password: "password123",
				}),
			});

			const loginResponse = await SELF.fetch("http://localhost/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: "authtest@example.com",
					password: "password123",
				}),
			});

			const loginData = await loginResponse.json() as { result: { session: { token: string } } };
			const token = loginData.result.session.token;

			// Use the token to access protected endpoint
			const response = await SELF.fetch("http://localhost/api/search?q=test", {
				headers: { Authorization: `Bearer ${token}` },
			});

			// Should not be 401 (authentication passed)
			expect(response.status).not.toBe(401);
		});
	});

	describe("404 Handler", () => {
		it("should return 404 for unknown routes", async () => {
			const response = await SELF.fetch("http://localhost/unknown-route");

			expect(response.status).toBe(404);
			expect(await response.text()).toBe("Not Found.");
		});
	});
});

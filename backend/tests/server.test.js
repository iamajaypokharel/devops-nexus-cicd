const request = require("supertest");
const app = require("../server");

describe("Backend API", () => {

  test("GET / should return backend message", async () => {
    const response = await request(app).get("/");

    expect(response.statusCode).toBe(200);
    expect(response.text).toBe("Backend is running!");
  });

  test("GET /api should return API message", async () => {
    const response = await request(app).get("/api");

    expect(response.statusCode).toBe(200);
    expect(response.text).toBe("Hello from Backend! 🚀");
  });

});

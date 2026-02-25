const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Supabase Practice API",
    version: "1.0.0",
    description: "Posts API with Supabase auth and public image bucket helpers.",
  },
  servers: [
    {
      url: "http://localhost:3001",
      description: "Local development",
    },
  ],
  tags: [
    { name: "Health" },
    { name: "Posts" },
    { name: "Images" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      Post: {
        type: "object",
        properties: {
          id: { type: "string", example: "1" },
          title: { type: "string", example: "My first post" },
          body: { type: "string", example: "Hello from API" },
          user_id: { type: "string", example: "ba3f5f4d-2222-4444-9999-f3332b57838f" },
        },
      },
      ImageItem: {
        type: "object",
        properties: {
          name: { type: "string", example: "1700000000-sample.png" },
          path: { type: "string", example: "uploads/1700000000-sample.png" },
          url: { type: "string", example: "https://project.supabase.co/storage/v1/object/public/post-images/uploads/1700000000-sample.png" },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string", example: "Title and body are required." },
        },
      },
    },
  },
  paths: {
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: {
          200: {
            description: "Server is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        ok: { type: "boolean", example: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/posts": {
      get: {
        tags: ["Posts"],
        summary: "List posts",
        responses: {
          200: {
            description: "Posts list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Post" },
                    },
                  },
                },
              },
            },
          },
          500: {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      post: {
        tags: ["Posts"],
        summary: "Create post",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "body"],
                properties: {
                  title: { type: "string", example: "Post title" },
                  body: { type: "string", example: "Post body" },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Post created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/Post" },
                  },
                },
              },
            },
          },
          400: {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/posts/{id}": {
      delete: {
        tags: ["Posts"],
        summary: "Delete post",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Post id",
          },
        ],
        responses: {
          200: {
            description: "Deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        success: { type: "boolean", example: true },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/images/upload": {
      post: {
        tags: ["Images"],
        summary: "Upload image to public bucket",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["image"],
                properties: {
                  image: {
                    type: "string",
                    format: "binary",
                    description: "Image file",
                  },
                  folder: {
                    type: "string",
                    example: "uploads",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Image uploaded",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/ImageItem" },
                  },
                },
              },
            },
          },
          400: {
            description: "Upload error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/images": {
      get: {
        tags: ["Images"],
        summary: "List image files from public bucket",
        parameters: [
          {
            name: "prefix",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Optional folder/prefix",
          },
        ],
        responses: {
          200: {
            description: "Image list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ImageItem" },
                    },
                  },
                },
              },
            },
          },
          500: {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
};

export default openapi;

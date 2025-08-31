import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EmbeddingConfig } from "./EmbeddingConfig";

// Mock process.env for each test
const originalEnv = process.env;

beforeEach(() => {
  vi.stubGlobal("process", {
    env: {
      ...originalEnv,
      DOCS_MCP_EMBEDDING_MODEL: undefined,
    },
  });
  // Reset the singleton for each test to ensure isolation
  EmbeddingConfig.resetInstance();
});

afterEach(() => {
  vi.stubGlobal("process", { env: originalEnv });
  // Reset the singleton after each test
  EmbeddingConfig.resetInstance();
});

describe("parseEmbeddingConfig", () => {
  test("should parse OpenAI model without provider prefix", () => {
    const config = EmbeddingConfig.parseEmbeddingConfig("text-embedding-3-small");

    expect(config).toEqual({
      provider: "openai",
      model: "text-embedding-3-small",
      dimensions: 1536,
      modelSpec: "text-embedding-3-small",
    });
  });

  test("should parse OpenAI model with explicit provider", () => {
    const config = EmbeddingConfig.parseEmbeddingConfig("openai:text-embedding-3-large");

    expect(config).toEqual({
      provider: "openai",
      model: "text-embedding-3-large",
      dimensions: 3072,
      modelSpec: "openai:text-embedding-3-large",
    });
  });

  test("should parse Google Vertex AI model", () => {
    const config = EmbeddingConfig.parseEmbeddingConfig("vertex:text-embedding-004");

    expect(config).toEqual({
      provider: "vertex",
      model: "text-embedding-004",
      dimensions: 768,
      modelSpec: "vertex:text-embedding-004",
    });
  });

  test("should parse Google Gemini model", () => {
    const config = EmbeddingConfig.parseEmbeddingConfig("gemini:embedding-001");

    expect(config).toEqual({
      provider: "gemini",
      model: "embedding-001",
      dimensions: 768,
      modelSpec: "gemini:embedding-001",
    });
  });

  test("should parse AWS Bedrock model with colon in name", () => {
    const config = EmbeddingConfig.parseEmbeddingConfig(
      "aws:amazon.titan-embed-text-v2:0",
    );

    expect(config).toEqual({
      provider: "aws",
      model: "amazon.titan-embed-text-v2:0",
      dimensions: 1024,
      modelSpec: "aws:amazon.titan-embed-text-v2:0",
    });
  });

  test("should parse SageMaker model", () => {
    const config = EmbeddingConfig.parseEmbeddingConfig(
      "sagemaker:intfloat/multilingual-e5-large",
    );

    expect(config).toEqual({
      provider: "sagemaker",
      model: "intfloat/multilingual-e5-large",
      dimensions: 1024,
      modelSpec: "sagemaker:intfloat/multilingual-e5-large",
    });
  });
  test("should parse Microsoft Azure model", () => {
    const config = EmbeddingConfig.parseEmbeddingConfig(
      "microsoft:text-embedding-ada-002",
    );

    expect(config).toEqual({
      provider: "microsoft",
      model: "text-embedding-ada-002",
      dimensions: 1536,
      modelSpec: "microsoft:text-embedding-ada-002",
    });
  });

  test("should return null dimensions for unknown model", () => {
    const config = EmbeddingConfig.parseEmbeddingConfig("openai:unknown-model");

    expect(config).toEqual({
      provider: "openai",
      model: "unknown-model",
      dimensions: null,
      modelSpec: "openai:unknown-model",
    });
  });

  test("should use environment variable when no modelSpec provided", () => {
    vi.stubGlobal("process", {
      env: {
        ...originalEnv,
        DOCS_MCP_EMBEDDING_MODEL: "vertex:text-embedding-004",
      },
    });

    const config = EmbeddingConfig.parseEmbeddingConfig();

    expect(config).toEqual({
      provider: "vertex",
      model: "text-embedding-004",
      dimensions: 768,
      modelSpec: "vertex:text-embedding-004",
    });
  });

  test("should default to text-embedding-3-small when no env var set", () => {
    const config = EmbeddingConfig.parseEmbeddingConfig();

    expect(config).toEqual({
      provider: "openai",
      model: "text-embedding-3-small",
      dimensions: 1536,
      modelSpec: "text-embedding-3-small",
    });
  });
});

describe("getKnownModelDimensions", () => {
  test("should return known dimensions for various model types", () => {
    // OpenAI models
    expect(EmbeddingConfig.getKnownModelDimensions("text-embedding-3-small")).toBe(1536);
    expect(EmbeddingConfig.getKnownModelDimensions("text-embedding-3-large")).toBe(3072);

    // Google models
    expect(EmbeddingConfig.getKnownModelDimensions("text-embedding-004")).toBe(768);
    expect(EmbeddingConfig.getKnownModelDimensions("embedding-001")).toBe(768);

    // AWS models
    expect(EmbeddingConfig.getKnownModelDimensions("amazon.titan-embed-text-v1")).toBe(
      1536,
    );
    expect(EmbeddingConfig.getKnownModelDimensions("amazon.titan-embed-text-v2:0")).toBe(
      1024,
    );
    expect(EmbeddingConfig.getKnownModelDimensions("cohere.embed-english-v3")).toBe(1024);

    // SageMaker models
    expect(
      EmbeddingConfig.getKnownModelDimensions("intfloat/multilingual-e5-large"),
    ).toBe(1024);
    expect(
      EmbeddingConfig.getKnownModelDimensions("sentence-transformers/all-MiniLM-L6-v2"),
    ).toBe(384);
  });

  test("should return null for unknown model", () => {
    expect(EmbeddingConfig.getKnownModelDimensions("unknown-model")).toBeNull();
  });
});

describe("setKnownModelDimensions", () => {
  test("should cache new model dimensions", () => {
    const modelName = "new-test-model";
    const dimensions = 2048;

    // Initially unknown
    expect(EmbeddingConfig.getKnownModelDimensions(modelName)).toBeNull();

    // Cache the dimensions
    EmbeddingConfig.setKnownModelDimensions(modelName, dimensions);

    // Now should return cached value
    expect(EmbeddingConfig.getKnownModelDimensions(modelName)).toBe(dimensions);

    // Should also work in parseEmbeddingConfig
    const config = EmbeddingConfig.parseEmbeddingConfig(`openai:${modelName}`);
    expect(config.dimensions).toBe(dimensions);
  });

  test("should update existing model dimensions", () => {
    const modelName = "text-embedding-3-small";
    const newDimensions = 999;

    // Initial known value
    expect(EmbeddingConfig.getKnownModelDimensions(modelName)).toBe(1536);

    // Update the dimensions
    EmbeddingConfig.setKnownModelDimensions(modelName, newDimensions);

    // Should return updated value
    expect(EmbeddingConfig.getKnownModelDimensions(modelName)).toBe(newDimensions);
  });
});

describe("case-insensitive model lookups", () => {
  test("should find models with different capitalization", () => {
    // Use a model that wasn't modified by previous tests
    expect(EmbeddingConfig.getKnownModelDimensions("text-embedding-3-large")).toBe(3072);
    expect(EmbeddingConfig.getKnownModelDimensions("TEXT-EMBEDDING-3-LARGE")).toBe(3072);
    expect(EmbeddingConfig.getKnownModelDimensions("Text-Embedding-3-Large")).toBe(3072);
    expect(EmbeddingConfig.getKnownModelDimensions("TEXT-embedding-3-LARGE")).toBe(3072);
  });

  test("should find Hugging Face models with different capitalization", () => {
    // Test some MTEB models with different cases
    expect(EmbeddingConfig.getKnownModelDimensions("BAAI/bge-large-en-v1.5")).toBe(1024);
    expect(EmbeddingConfig.getKnownModelDimensions("baai/bge-large-en-v1.5")).toBe(1024);
    expect(EmbeddingConfig.getKnownModelDimensions("Baai/Bge-Large-En-V1.5")).toBe(1024);
  });

  test("should work in parseEmbeddingConfig with different capitalization", () => {
    const config1 = EmbeddingConfig.parseEmbeddingConfig("openai:TEXT-EMBEDDING-3-LARGE");
    const config2 = EmbeddingConfig.parseEmbeddingConfig("openai:text-embedding-3-large");

    expect(config1.dimensions).toBe(3072);
    expect(config2.dimensions).toBe(3072);
    expect(config1.model).toBe("TEXT-EMBEDDING-3-LARGE"); // Original case preserved
    expect(config2.model).toBe("text-embedding-3-large"); // Original case preserved
  });

  test("should cache models with case-insensitive lookup", () => {
    const modelName = "New-Test-Model";
    const dimensions = 512;

    // Set dimensions for one case
    EmbeddingConfig.setKnownModelDimensions(modelName, dimensions);

    // Should find it with different capitalization
    expect(EmbeddingConfig.getKnownModelDimensions("new-test-model")).toBe(dimensions);
    expect(EmbeddingConfig.getKnownModelDimensions("NEW-TEST-MODEL")).toBe(dimensions);
    expect(EmbeddingConfig.getKnownModelDimensions("New-Test-Model")).toBe(dimensions);
  });
});

describe("EmbeddingConfig class", () => {
  test("should allow creating isolated instances for testing", () => {
    const config1 = new EmbeddingConfig();
    const config2 = new EmbeddingConfig();

    // Add a model to one instance
    config1.setKnownDimensions("test-model-1", 1000);

    // Should be available in that instance
    expect(config1.getKnownDimensions("test-model-1")).toBe(1000);

    // Should not affect the other instance
    expect(config2.getKnownDimensions("test-model-1")).toBeNull();

    // Add a different model to the second instance
    config2.setKnownDimensions("test-model-2", 2000);

    // Verify isolation
    expect(config1.getKnownDimensions("test-model-2")).toBeNull();
    expect(config2.getKnownDimensions("test-model-2")).toBe(2000);
  });

  test("should support parsing with isolated instances", () => {
    const config = new EmbeddingConfig();

    // Add a custom model
    config.setKnownDimensions("custom-model", 512);

    // Parse using the instance
    const result = config.parse("openai:custom-model");

    expect(result).toEqual({
      provider: "openai",
      model: "custom-model",
      dimensions: 512,
      modelSpec: "openai:custom-model",
    });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

vi.mock("glob", () => ({
  glob: vi.fn(),
}));

vi.mock("js-yaml", () => ({
  default: {
    load: vi.fn(),
  },
}));

vi.mock("./bm25.js", () => ({
  initBM25: vi.fn(),
  searchBM25: vi.fn(),
  isBM25Ready: vi.fn(),
}));

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockRejectedValue(new Error("serena unavailable")),
    callTool: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: vi.fn(),
}));

import { readFile } from "node:fs/promises";
import { glob } from "glob";
import yaml from "js-yaml";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import {
  disconnectRegistrySerena,
  getCategories,
  getToolByName,
  listToolsInCategory,
  loadToolDefinition,
  searchTools,
} from "./search.js";

import { initBM25, isBM25Ready, searchBM25 } from "./bm25.js";

type ToolFixture = {
  name: string;
  server: string;
  category: string;
  description: string;
  inputSchema: Record<string, unknown>;
  example: string;
  notes?: string;
};

const mockReadFile = vi.mocked(readFile);
const mockGlob = vi.mocked(glob);
const mockYamlLoad = vi.mocked(yaml.load);
const mockInitBM25 = vi.mocked(initBM25);
const mockIsBM25Ready = vi.mocked(isBM25Ready);
const mockSearchBM25 = vi.mocked(searchBM25);
const mockClient = vi.mocked(Client);

const toolFixtures: Record<string, ToolFixture> = {
  "/registry/ui/diagram.yaml": {
    name: "diagram-generator",
    server: "gemini",
    category: "ui",
    description: "Generate diagrams from prompts",
    inputSchema: {},
    example: "gemini.generate",
  },
  "/registry/code-nav/search.yaml": {
    name: "code-search",
    server: "serena",
    category: "code-nav",
    description: "Search code quickly",
    inputSchema: {},
    example: "serena.search",
  },
};

afterEach(async () => {
  await disconnectRegistrySerena();
  vi.restoreAllMocks();
});

describe("loadToolDefinition", () => {
  it("loads valid YAML tool definitions", async () => {
    mockReadFile.mockResolvedValue("ok");
    mockYamlLoad.mockReturnValue(toolFixtures["/registry/ui/diagram.yaml"]);

    const tool = await loadToolDefinition("/registry/ui/diagram.yaml");

    expect(tool).toEqual(toolFixtures["/registry/ui/diagram.yaml"]);
    expect(mockReadFile).toHaveBeenCalledWith(
      "/registry/ui/diagram.yaml",
      "utf-8",
    );
  });

  it("returns null for invalid definitions", async () => {
    mockReadFile.mockResolvedValue("ok");
    mockYamlLoad.mockReturnValue({
      name: "diagram-generator",
      server: "gemini",
    });

    await expect(
      loadToolDefinition("/registry/ui/invalid.yaml"),
    ).resolves.toBeNull();
  });

  it("returns null when file read fails", async () => {
    mockReadFile.mockRejectedValue(new Error("missing"));

    await expect(
      loadToolDefinition("/registry/ui/missing.yaml"),
    ).resolves.toBeNull();
  });
});

describe("searchTools", () => {
  afterEach(() => {
    mockInitBM25.mockReset();
    mockIsBM25Ready.mockReset();
    mockSearchBM25.mockReset();
    mockReadFile.mockReset();
    mockGlob.mockReset();
    mockYamlLoad.mockReset();
  });

  it("uses local search when Serena is unavailable", async () => {
    mockInitBM25.mockReturnValue(undefined);
    mockIsBM25Ready.mockReturnValue(false);
    mockSearchBM25.mockReturnValue([]);

    mockGlob.mockImplementation((async (pattern: string | string[]) => {
      if (pattern === "*/") {
        return [];
      }
      return ["/registry/ui/diagram.yaml", "/registry/code-nav/search.yaml"];
    }) as typeof glob);

    mockReadFile.mockImplementation(async (path) => {
      return JSON.stringify(
        toolFixtures[path as keyof typeof toolFixtures] || {},
      );
    });

    mockYamlLoad.mockImplementation((content: string) => {
      if (!content || content === "{}") {
        return {} as ToolFixture;
      }
      return JSON.parse(content) as ToolFixture;
    });

    const response = await searchTools("diagram");

    expect(response.source).toBe("local");
    expect(response.fallbackReason).toBe(
      "Serena unavailable - using text search",
    );
    expect(response.results).toHaveLength(1);
    expect(response.results[0].tool.name).toBe("diagram-generator");
    expect(response.totalCount).toBe(1);
  });

  it("returns Serena results when registry search succeeds", async () => {
    const callTool = vi
      .fn()
      .mockResolvedValueOnce({ content: [] })
      .mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: "ui/gemini/generate-diagram.yaml: description: Generate diagrams",
          },
          {
            type: "text",
            text: "ui/gemini/generate-diagram.yaml: duplicate match",
          },
          {
            type: "text",
            text: "not a registry path",
          },
        ],
      });
    const close = vi.fn().mockResolvedValue(undefined);
    mockClient.mockImplementationOnce(function () {
      return {
        connect: vi.fn().mockResolvedValue(undefined),
        callTool,
        close,
      } as unknown as Client;
    });
    mockReadFile.mockResolvedValue(
      JSON.stringify(toolFixtures["/registry/ui/diagram.yaml"]),
    );
    mockYamlLoad.mockReturnValue(toolFixtures["/registry/ui/diagram.yaml"]);

    const response = await searchTools("generate diagram", 1, 0);

    expect(response).toMatchObject({
      source: "serena",
      totalCount: 1,
      results: [
        {
          score: 1,
          tool: { name: "diagram-generator" },
          matchContext: expect.stringContaining("generate-diagram.yaml"),
        },
      ],
    });
    expect(callTool).toHaveBeenNthCalledWith(1, {
      name: "activate_project",
      arguments: { project: expect.stringContaining("registry") },
    });
    expect(callTool).toHaveBeenNthCalledWith(2, {
      name: "search_for_pattern",
      arguments: expect.objectContaining({
        substring_pattern: "(?=.*generate)(?=.*diagram).*",
        relative_path: ".",
      }),
    });
  });

  it("paginates Serena results and stops loading at requested limit", async () => {
    const callTool = vi
      .fn()
      .mockResolvedValueOnce({ content: [] })
      .mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: [
              "ui/gemini/generate-diagram.yaml: description: Generate diagrams",
              "code-nav/serena/search-code.yaml: description: Search code",
            ].join("\n"),
          },
        ],
      });
    mockClient.mockImplementationOnce(function () {
      return {
        connect: vi.fn().mockResolvedValue(undefined),
        callTool,
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as Client;
    });
    mockReadFile.mockImplementation(async (path) => {
      if (String(path).includes("generate-diagram")) {
        return JSON.stringify(toolFixtures["/registry/ui/diagram.yaml"]);
      }
      return JSON.stringify(toolFixtures["/registry/code-nav/search.yaml"]);
    });
    mockYamlLoad.mockImplementation(
      (content: string) => JSON.parse(content) as ToolFixture,
    );

    const response = await searchTools("tool", 1, 0);

    expect(response.source).toBe("serena");
    expect(response.results).toHaveLength(1);
    expect(response.results[0].tool.name).toBe("diagram-generator");
    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });

  it("uses local search when Serena returns no content", async () => {
    const callTool = vi
      .fn()
      .mockResolvedValueOnce({ content: [] })
      .mockResolvedValueOnce({ content: [] });
    mockClient.mockImplementationOnce(function () {
      return {
        connect: vi.fn().mockResolvedValue(undefined),
        callTool,
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as Client;
    });
    mockInitBM25.mockReturnValue(undefined);
    mockIsBM25Ready.mockReturnValue(false);
    mockSearchBM25.mockReturnValue([]);
    mockGlob.mockResolvedValue(["/registry/ui/diagram.yaml"] as string[]);
    mockReadFile.mockResolvedValue(
      JSON.stringify(toolFixtures["/registry/ui/diagram.yaml"]),
    );
    mockYamlLoad.mockReturnValue(toolFixtures["/registry/ui/diagram.yaml"]);

    const response = await searchTools("diagram", 5, 0);

    expect(response.source).toBe("local");
    expect(response.fallbackReason).toBe(
      "No semantic matches - using text search",
    );
    expect(response.results[0].tool.name).toBe("diagram-generator");
  });

  it("escapes single-term Serena search patterns", async () => {
    const callTool = vi
      .fn()
      .mockResolvedValueOnce({ content: [] })
      .mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: "ui/gemini/generate-diagram.yml: description: Generate diagrams",
          },
        ],
      });
    mockClient.mockImplementationOnce(function () {
      return {
        connect: vi.fn().mockResolvedValue(undefined),
        callTool,
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as Client;
    });
    mockReadFile.mockResolvedValue(
      JSON.stringify(toolFixtures["/registry/ui/diagram.yaml"]),
    );
    mockYamlLoad.mockReturnValue(toolFixtures["/registry/ui/diagram.yaml"]);

    const response = await searchTools("a+b", 1, 0);

    expect(response.source).toBe("serena");
    expect(callTool).toHaveBeenNthCalledWith(2, {
      name: "search_for_pattern",
      arguments: expect.objectContaining({
        substring_pattern: "a\\+b",
      }),
    });
  });

  it("uses BM25 local results before text scoring", async () => {
    mockIsBM25Ready.mockReturnValue(true);
    mockSearchBM25.mockReturnValue([
      toolFixtures["/registry/code-nav/search.yaml"],
      toolFixtures["/registry/ui/diagram.yaml"],
    ]);

    const response = await searchTools("code search", 5, 0);

    expect(response.source).toBe("local");
    expect(response.results).toEqual([
      {
        tool: toolFixtures["/registry/code-nav/search.yaml"],
        score: 1,
      },
      {
        tool: toolFixtures["/registry/ui/diagram.yaml"],
        score: 0.99,
      },
    ]);
    expect(response.totalCount).toBe(2);
    expect(mockGlob).not.toHaveBeenCalled();
  });

  it("sorts local text results and applies pagination", async () => {
    mockInitBM25.mockReturnValue(undefined);
    mockIsBM25Ready.mockReturnValue(false);
    mockSearchBM25.mockReturnValue([]);
    mockGlob.mockResolvedValue([
      "/registry/ui/diagram.yaml",
      "/registry/code-nav/search.yaml",
    ] as string[]);
    mockReadFile.mockImplementation(async (path) => {
      return JSON.stringify(toolFixtures[path as keyof typeof toolFixtures]);
    });
    mockYamlLoad.mockImplementation(
      (content: string) => JSON.parse(content) as ToolFixture,
    );

    const response = await searchTools("diagram code", 2, 0);

    expect(response.source).toBe("local");
    expect(response.totalCount).toBe(2);
    expect(response.results).toHaveLength(2);
    expect(response.results[0]).toMatchObject({
      tool: { name: "code-search" },
      score: 2,
    });
    expect(response.results[1]).toMatchObject({
      tool: { name: "diagram-generator" },
      score: 1.5,
    });
  });

  it("paginates local text results after scoring", async () => {
    mockInitBM25.mockReturnValue(undefined);
    mockIsBM25Ready.mockReturnValue(false);
    mockSearchBM25.mockReturnValue([]);
    mockGlob.mockResolvedValue([
      "/registry/ui/diagram.yaml",
      "/registry/code-nav/search.yaml",
    ] as string[]);
    mockReadFile.mockImplementation(async (path) => {
      return JSON.stringify(toolFixtures[path as keyof typeof toolFixtures]);
    });
    mockYamlLoad.mockImplementation(
      (content: string) => JSON.parse(content) as ToolFixture,
    );

    const response = await searchTools("diagram code", 1, 1);

    expect(response.source).toBe("local");
    expect(response.totalCount).toBe(2);
    expect(response.results).toHaveLength(1);
    expect(response.results[0].tool.name).toBe("diagram-generator");
  });

  it("returns suggestions when nothing local matches", async () => {
    mockInitBM25.mockReturnValue(undefined);
    mockIsBM25Ready.mockReturnValue(false);
    mockSearchBM25.mockReturnValue([]);

    mockGlob.mockImplementation(async () => ["/registry/ui/diagram.yaml"]);
    mockReadFile.mockImplementation(async () =>
      JSON.stringify(toolFixtures["/registry/ui/diagram.yaml"]),
    );
    mockYamlLoad.mockImplementation(() => ({
      ...toolFixtures["/registry/ui/diagram.yaml"],
      description: "Generate diagrams from prompts",
    }));

    const response = await searchTools("non-matching query");

    expect(response.source).toBe("local");
    expect(response.results).toEqual([]);
    expect(response.fallbackReason).toBe(
      "Serena unavailable - using text search",
    );
    expect(response.suggestion).toContain("Try broader terms");
    expect(response.totalCount).toBe(0);
  });
});

describe("search module helpers", () => {
  it("returns categories from registry root", async () => {
    mockGlob.mockResolvedValue(["ui/", "code-nav/"] as string[]);

    const categories = await getCategories();

    expect(categories).toEqual(["ui", "code-nav"]);
    expect(mockGlob).toHaveBeenCalledWith("*/", {
      cwd: expect.stringContaining("registry"),
    });
  });

  it("lists tools in a category", async () => {
    mockGlob.mockResolvedValue(["/registry/ui/diagram.yaml"] as string[]);
    mockReadFile.mockResolvedValue(
      JSON.stringify(toolFixtures["/registry/ui/diagram.yaml"]),
    );
    mockYamlLoad.mockReturnValue(toolFixtures["/registry/ui/diagram.yaml"]);

    const tools = await listToolsInCategory("ui");

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("diagram-generator");
    expect(mockGlob).toHaveBeenCalledWith("**/*.{yaml,yml}", {
      cwd: expect.stringContaining("registry/ui"),
      absolute: true,
    });
  });

  it("gets a tool by name", async () => {
    mockGlob.mockResolvedValue([
      "/registry/ui/diagram.yaml",
      "/registry/code-nav/search.yaml",
    ] as string[]);
    mockReadFile.mockImplementation(async (path) => {
      return JSON.stringify(toolFixtures[path as keyof typeof toolFixtures]);
    });
    mockYamlLoad.mockImplementation(
      (content: string) => JSON.parse(content) as ToolFixture,
    );

    const tool = await getToolByName("code-search");

    expect(tool).toMatchObject({
      name: "code-search",
      server: "serena",
    });
    expect(mockGlob).toHaveBeenCalledWith("**/*.{yaml,yml}", {
      cwd: expect.stringContaining("registry"),
      absolute: true,
    });
  });

  it("returns null for missing tool names", async () => {
    mockGlob.mockResolvedValue(["/registry/ui/diagram.yaml"] as string[]);
    mockReadFile.mockResolvedValue("{}");
    mockYamlLoad.mockReturnValue({} as ToolFixture);

    const tool = await getToolByName("missing");

    expect(tool).toBeNull();
  });

  it("disconnects the registry Serena client without error", async () => {
    await expect(disconnectRegistrySerena()).resolves.toBeUndefined();
  });
});

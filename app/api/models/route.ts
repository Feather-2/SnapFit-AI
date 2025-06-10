import { OpenAICompatibleClient } from "@/lib/openai-client"

export async function POST(req: Request) {
  try {
    const { baseUrl, apiKey } = await req.json()

    if (!baseUrl || !apiKey) {
      return Response.json({ error: "Base URL and API Key are required" }, { status: 400 })
    }

    // 创建客户端
    const client = new OpenAICompatibleClient(baseUrl, apiKey)

    // 获取模型列表
    const modelList = await client.listModels()

    return Response.json(modelList)
  } catch (error) {
    return Response.json(
      { error: "Failed to fetch models", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

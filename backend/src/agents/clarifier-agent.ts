// backend/src/agents/clarifier-agent.ts
import { ChatGroq } from "@langchain/groq"; // Changed from @langchain/openai
import { ChatPromptTemplate } from "@langchain/core/prompts";

export class ClarifierAgent {
  private llm: ChatGroq; // Changed from ChatOpenAI

  constructor() {
    console.log("ClarifierAgent initialized with Groq LLM");
    // This assumes you have GROQ_API_KEY in your .env file
    // We'll use llama3-70b for this high-level reasoning task.
    this.llm = new ChatGroq({ model: "llama3-70b-8192", temperature: 0 });
  }

  async clarify(initialPrompt: string): Promise<string> {
    console.log("ClarifierAgent: Starting clarification for prompt:", initialPrompt);

    const systemPrompt = `
      You are an expert at refining project objectives. Your goal is to take a user's initial objective and rephrase it into a single, clear, concise, and actionable task for a team of AI agents.

      CRITICAL OUTPUT REQUIREMENT:
      Your entire response MUST BE ONLY a valid JSON object with a single key: "objective".
      The value of the "objective" key should be the refined objective string.
      Do NOT include any other text, explanations, or markdown formatting.

      Example Input: 'Write a blog post about AI in education'
      Example Output:
      {{
        "objective": "Generate a comprehensive blog post detailing the advantages of implementing Artificial Intelligence in the modern educational sector, covering topics such as personalized learning, administrative efficiency, and future trends."
      }}
    `;

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["human", "{input}"],
    ]);

    const chain = prompt.pipe(this.llm);

    try {
      const result = await chain.invoke({ input: initialPrompt });
      const responseContent = result.content.toString();

      // --- NEW: PARSE THE JSON RESPONSE ---
      const parsedJson = JSON.parse(responseContent);
      const clarifiedObjective = parsedJson.objective;

      if (!clarifiedObjective) {
        throw new Error("LLM returned valid JSON but was missing the 'objective' key.");
      }
      
      console.log(`Clarified objective: ${clarifiedObjective}`);
      return clarifiedObjective;

    } catch (error) {
      console.error("Error during clarification or JSON parsing:", error);
      throw new Error("Failed to clarify the objective. The LLM may have returned an invalid JSON format.");
    }
  }
}
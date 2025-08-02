// backend/src/agents/planner-agent.ts
import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";

export type AgentPlan = {
  name: string; // e.g., "Market Researcher", "Content Writer"
  role: string; // A description of what the agent does
  task: string; // The specific task for this agent in the plan
};

export class PlannerAgent {
  private llm: ChatGroq;

  constructor() {
    console.log("PlannerAgent initialized with Groq LLM");
    // Use a powerful model for this complex planning and JSON generation task
    this.llm = new ChatGroq({ model: "moonshotai/kimi-k2-instruct", temperature: 0 });
  }

  async generatePlan(clarifiedObjective: string): Promise<AgentPlan[]> {
    console.log("PlannerAgent: Generating a plan for the objective.");

    const systemPrompt = `
      You are a world-class AI project manager. Your job is to take a user's objective and break it down into a sequential, multi-agent plan.

      For the given objective, define a team of 2 to 6 specialized agents that will work in sequence to achieve it.
      The output MUST be a valid JSON array of objects. Each object in the array represents one agent and must have the following three keys:
      1. "name": A short, descriptive name for the agent (e.g., "Data Analyst", "Technical Writer").
      2. "role": A concise sentence describing the agent's expertise and function.
      3. "task": The specific, single task this agent will perform. The task for each subsequent agent should build upon the output of the previous one.

      CRITICAL: Your entire response must be ONLY the JSON array, with no introductory text, explanations, or markdown formatting.

      Objective: "{objective}"
    `;

    const prompt = ChatPromptTemplate.fromMessages([["system", systemPrompt]]);
    const chain = prompt.pipe(this.llm);

    try {
      const result = await chain.invoke({ objective: clarifiedObjective });
      const planJson = result.content.toString();
      
      // We must parse the string output to ensure it's valid JSON
      const plan = JSON.parse(planJson) as AgentPlan[];
      console.log("PlannerAgent: Plan generated successfully.");
      return plan;
    } catch (error) {
      console.error("Error generating or parsing agent plan:", error);
      throw new Error("Failed to generate a valid agent plan. The LLM may have returned an invalid JSON format.");
    }
  }
}
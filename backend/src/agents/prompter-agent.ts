// backend/src/agents/prompter-agent.ts
import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";

// Re-using the AgentConfig type definition from AgentManager for consistency
type AgentConfig = {
  id: number;
  name: string;
  role: string;
  task: string;
  selectedChatbot: string;
};

export class PrompterAgent {
  private llm: ChatGroq;

  constructor() {
    console.log("PrompterAgent initialized with Groq LLM");
    this.llm = new ChatGroq({ model: "deepseek-r1-distill-llama-70b", temperature: 0.1 });
  }

  async generatePrompt(clarifiedObjective: string, agentConfig: AgentConfig): Promise<string> {
    console.log(`PrompterAgent: Generating system prompt for role: "${agentConfig.role}"`);

    const systemPrompt = `
      You are an expert prompt engineer. Your sole task is to generate a system prompt for another AI agent based on a role and an objective.

      CRITICAL OUTPUT REQUIREMENT FOR YOU:
      Your output MUST BE ONLY the raw text of the system prompt itself. Do NOT include any conversational text, introductions, explanations, or markdown formatting.

      ---
      INSTRUCTIONS FOR THE PROMPT YOU ARE GENERATING:
      The prompt you generate must be for a specialized AI agent. It needs to be precise and direct.
      Crucially, it MUST contain a clear instruction that the agent's final output should ONLY be the direct result of its task (e.g., the document, the code, the analysis), NOT a description of its actions, its thought process, or a summary of what it did.

      ---
      CONTEXT FOR THE AGENT's PROMPT:
      - Overall Objective: {objective}
      - Agent's Role: {role}
      - Agent's Specific Task: {task}
      ---
      
      Now, based on all the instructions and context above, generate the system prompt for the agent.
    `;
    
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
    ]);

    const chain = prompt.pipe(this.llm);

    try {
      const result = await chain.invoke({ 
        objective: clarifiedObjective,
        role: agentConfig.role,
        task: agentConfig.task,
       });

       let rawOutput = result.content.toString();
    
       // Use a regular expression to remove the <think> block and then trim whitespace.
       // [\s\S]*? matches any character including newlines, in a non-greedy way.
       const cleanedPrompt = rawOutput.replace(/<think>[\s\S]*?<\/think>/, '').trim();
      
      console.log(`Generated System Prompt for ${agentConfig.name}.`);
      return cleanedPrompt;

    } catch (error) {
      console.error("Error during system prompt generation with Groq:", error);
      throw new Error(`Failed to generate system prompt for agent ${agentConfig.name}.`);
    }
  }
}
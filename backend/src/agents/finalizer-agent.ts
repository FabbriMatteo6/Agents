// backend/src/agents/finalizer-agent.ts
import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";

export class FinalizerAgent {
  private llm: ChatGroq;

  constructor() {
    console.log("FinalizerAgent initialized with Groq LLM");
    // Using a powerful model for high-quality summarization.
    this.llm = new ChatGroq({ model: "llama3-70b-8192", temperature: 0.2 });
  }

  async finalize(finalOutput: string): Promise<string> {
    console.log("FinalizerAgent: Generating final polished summary.");

    const systemPrompt = `
      You are a professional editor and summarizer. Your task is to take the final raw output from an AI agent workflow and transform it into a well-structured, polished, and professional summary.

      The output should be clean, easy to read, and presented in a format that is ready for a final report. Use Markdown for formatting (e.g., headings, bullet points, bold text) to improve clarity.

      CRITICAL: Your entire response must be ONLY the final, polished summary. Do not include any conversational text, introductions, or explanations about what you did.

      Raw Output to process:
      ---
      {final_output}
      ---
    `;

    const prompt = ChatPromptTemplate.fromMessages([["system", systemPrompt]]);
    const chain = prompt.pipe(this.llm);

    try {
      const result = await chain.invoke({ final_output: finalOutput });
      const polishedSummary = result.content.toString();
      console.log("FinalizerAgent: Polished summary generated successfully.");
      return polishedSummary;
    } catch (error) {
      console.error("Error generating final summary:", error);
      throw new Error("Failed to generate the final polished summary.");
    }
  }
}
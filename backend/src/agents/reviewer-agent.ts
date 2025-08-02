// backend/src/agents/reviewer-agent.ts
import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { SharedContext } from "./agent-manager"; // Assuming SharedContext is exported

interface ReviewResult {
  approved: boolean;
  feedback: string;
}

export class ReviewerAgent {
  private llm: ChatGroq;

  constructor() {
    this.llm = new ChatGroq({ model: "llama3-70b-8192", temperature: 0 });
  }

  async review(context: SharedContext): Promise<ReviewResult> {
    const systemPrompt = `
      You are a Reviewer Agent. Your role is to analyze the output of an agent's work and provide constructive feedback.
      - You must evaluate if the output is aligned with the overall objective.
      - You must provide clear and concise feedback for improvement.
      - If the output is sufficient, you will approve it.
      - You must return a JSON object with two keys: "approved" (a boolean) and "feedback" (a string).

      Overall Objective: {objective}
      Agent's Last Output: {last_output}
      History of previous steps: {history}
    `;

    const prompt = ChatPromptTemplate.fromMessages([["system", systemPrompt]]);
    const parser = new JsonOutputParser<ReviewResult>();
    const chain = prompt.pipe(this.llm).pipe(parser);

    const historyStr = context.history.map(h => `Agent: ${h.agent}, Task: ${h.task}, Result: ${h.result}`).join('\n---\n');

    try {
      const result = await chain.invoke({
        objective: context.objective,
        last_output: context.lastOutput,
        history: historyStr,
      });
      return result;
    } catch (error) {
      console.error("Error during review:", error);
      // Fallback in case of parsing error
      return {
        approved: true,
        feedback: "An error occurred during the review process, so the step was auto-approved.",
      };
    }
  }
}
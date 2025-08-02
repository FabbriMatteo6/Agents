// backend/src/agents/formatter-agent.ts

export class FormatterAgent {
    constructor() {
      console.log("FormatterAgent initialized");
    }
  
    /**
     * Cleans a string by removing Markdown-style links and citations.
     * e.g., "This is some text [1](http://example.com)" becomes "This is some text [1]"
     * @param text The input text to clean.
     * @returns The cleaned text.
     */
    public clean(text: string): string {
      console.log("FormatterAgent: Cleaning text of Markdown links...");
      // This regex matches the pattern [text](url) and replaces it with just [text]
      const cleanedText = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '[$1]');
      console.log("FormatterAgent: Text cleaned successfully.");
      return cleanedText;
    }
  }